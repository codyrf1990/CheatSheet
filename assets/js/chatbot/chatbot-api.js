const MAX_API_ATTEMPTS = 4;
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;
const REQUEST_TIMEOUT_MS = 30000;
const EPSILON = 1e-9;
const STREAM_TERMINATOR = '[DONE]';

export class ChatbotApiManager {
  constructor(options = {}) {
    this.fetchImpl =
      (typeof options.fetch === 'function' && options.fetch) ||
      (typeof fetch === 'function' ? fetch.bind(typeof window !== 'undefined' ? window : null) : null);
    this.rateLimiter =
      options.rateLimiter instanceof HybridRateLimiter
        ? options.rateLimiter
        : new HybridRateLimiter({
            tokensPerMinute: Number.isFinite(options.tokensPerMinute)
              ? Math.max(1, options.tokensPerMinute)
              : 20,
            burstSize: Number.isFinite(options.burstSize) ? Math.max(1, options.burstSize) : 3
          });
    this.onLimiterUpdate = typeof options.onLimiterUpdate === 'function' ? options.onLimiterUpdate : null;
  }

  async sendMessage({
    messages = [],
    prompt,
    provider = 'google',
    model,
    apiKey,
    context,
    ragResults = [],
    onToken
  }) {
    const providerId = PROVIDERS[provider] ? provider : DEFAULT_PROVIDER_ID;
    const config = PROVIDERS[providerId];
    const targetModel = resolveModel(config, model);

    if (!this.fetchImpl) {
      return buildFallbackResponse(messages, prompt, providerId, targetModel, context, ragResults, onToken);
    }

    if (!apiKey) {
      throw new ChatbotApiError('API_KEY_MISSING', 'No API key configured for provider.');
    }

    let limiterStatus = null;
    if (this.rateLimiter) {
      const limiterResult = this.rateLimiter.consume();
      limiterStatus = limiterResult.status || null;
      if (this.onLimiterUpdate && limiterStatus) {
        this.onLimiterUpdate(limiterStatus);
      }
      if (!limiterResult.allowed) {
        throw new ChatbotApiError('RATE_LIMITED', 'Request limit reached. Please wait before trying again.', {
          retryInMs: limiterResult.retryInMs,
          limiterStatus
        });
      }
    }

    const payload = config.buildPayload({ messages, prompt, context, ragResults, model: targetModel });
    const url =
      typeof config.resolveEndpoint === 'function'
        ? config.resolveEndpoint(apiKey, targetModel)
        : config.endpoint;

    const requestInit = {
      method: 'POST',
      headers: config.headers(apiKey, targetModel),
      body: JSON.stringify(payload)
    };

    let attempt = 0;
    let backoffMs = BASE_BACKOFF_MS;
    let lastError;

    while (attempt < MAX_API_ATTEMPTS) {
      const controller = createAbortController();
      const attemptInit = {
        ...requestInit,
        signal: controller?.signal
      };

      const timeoutId = setTimeout(() => {
        if (controller) {
          const timeoutReason = typeof DOMException === 'function'
            ? new DOMException('Request timed out', 'AbortError')
            : Object.assign(new Error('Request timed out'), { name: 'AbortError' });
          controller.abort(timeoutReason);
        }
      }, REQUEST_TIMEOUT_MS);

      try {
        const response = await this.fetchImpl(url, attemptInit);
        clearTimeout(timeoutId);

        if (!response.ok) {
          const bodyText = await safeReadResponseText(response);
          const error = new ChatbotApiError('API_HTTP_ERROR', `Provider responded with status ${response.status}`, {
            status: response.status,
            body: bodyText
          });

          lastError = error;
          if (shouldRetryStatus(response.status) && attempt < MAX_API_ATTEMPTS - 1) {
            const retryAfter = extractRetryAfterMillis(response.headers);
            const delayMs = retryAfter ?? calculateBackoffWithJitter(backoffMs);
            await delay(delayMs);
            attempt += 1;
            backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
            continue;
          }

          throw error;
        }

        if (config.streaming && response.body) {
          const text = await streamResponse(response, chunk => {
            if (typeof onToken === 'function') {
              onToken(chunk);
            }
          });
          if (this.rateLimiter && this.onLimiterUpdate) {
            this.onLimiterUpdate(this.rateLimiter.getStatus());
          }
          console.debug('[SolidCAM Chat API]', {
            provider: providerId,
            model: targetModel,
            streaming: true,
            length: text?.length || 0
          });
          return {
            text,
            ragResults
          };
        }

        const data = await response.json();
        const text = config.extractText(data);
        if (typeof onToken === 'function') {
          onToken(text);
        }
        if (this.rateLimiter && this.onLimiterUpdate) {
          this.onLimiterUpdate(this.rateLimiter.getStatus());
        }
        console.debug('[SolidCAM Chat API]', {
          provider: providerId,
          model: targetModel,
          streaming: false,
          length: text?.length || 0
        });
        return {
          text,
          ragResults
        };
      } catch (error) {
        clearTimeout(timeoutId);

        const normalizedError =
          error instanceof ChatbotApiError
            ? error
            : new ChatbotApiError('API_REQUEST_FAILED', error?.message || 'Unknown error', { error });

        if (normalizedError.type !== 'RATE_LIMITED' && this.rateLimiter && this.onLimiterUpdate) {
          this.onLimiterUpdate(this.rateLimiter.getStatus());
        }

        lastError = normalizedError;
        const retryAllowed = shouldRetryError(normalizedError) && attempt < MAX_API_ATTEMPTS - 1;
        if (retryAllowed) {
          const delayMs = calculateBackoffWithJitter(backoffMs);
          await delay(delayMs);
          attempt += 1;
          backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
          continue;
        }

        throw normalizedError;
      }
    }

    throw lastError || new ChatbotApiError('API_REQUEST_FAILED', 'Unknown API failure');
  }

  getLimiterStatus() {
    if (!this.rateLimiter) {
      return null;
    }
    return this.rateLimiter.getStatus();
  }
}

class ChatbotApiError extends Error {
  constructor(type, message, details) {
    super(message);
    this.name = 'ChatbotApiError';
    this.type = type;
    this.details = details;
  }
}

const GOOGLE_BASE_URL = 'https://generativelanguage.googleapis.com/v1alpha';

const PROVIDERS = {
  google: {
    id: 'google',
    label: 'Google Gemini',
    description: 'Direct Google Gemini API access (free tier friendly).',
    defaultModel: 'gemini-2.0-flash',
    models: [
      { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (default, free)', tier: 'free' },
      { value: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash Experimental', tier: 'preview' },
      { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', tier: 'standard' },
      { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', tier: 'standard' },
      { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite (preview)', tier: 'preview' },
      { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (preview)', tier: 'preview' },
      {
        value: 'gemini-2.5-flash-image-preview',
        label: 'Gemini 2.5 Flash Image Preview',
        tier: 'preview'
      }
    ],
    streaming: true,
    buildPayload({ messages, prompt, context, ragResults }) {
      const composed = composeMessages({ messages, prompt, context, ragResults }).map(msg => ({
        role: mapGoogleRole(msg.role),
        parts: [{ text: msg.content }]
      }));
      return { contents: composed };
    },
    resolveEndpoint(apiKey, model) {
      const encodedModel = encodeURIComponent(model);
      return `${GOOGLE_BASE_URL}/models/${encodedModel}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;
    },
    headers() {
      return {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream'
      };
    },
    extractText(data) {
      const candidates = data?.candidates || [];
      const first = candidates[0]?.content?.parts?.[0]?.text;
      return first || '';
    }
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    description: 'Meta-provider offering frontier and community models.',
    defaultModel: 'anthropic/claude-3.5-sonnet',
    models: [
      { value: 'google/gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', tier: 'premium' },
      { value: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet', tier: 'premium' },
      { value: 'openai/gpt-4o', label: 'GPT-4o', tier: 'premium' },
      { value: 'meta-llama/llama-3.1-405b', label: 'Llama 3.1 405B', tier: 'premium' },
      { value: 'qwen/qwen3-235b-a22b', label: 'Qwen 3 235B A22B', tier: 'premium' },
      { value: 'google/gemini-flash-1.5', label: 'Gemini Flash 1.5 (free)', tier: 'free' },
      { value: 'microsoft/wizardlm-2-8x22b', label: 'WizardLM 2 8x22B (free)', tier: 'free' },
      { value: 'meta-llama/llama-3.2-3b-instruct', label: 'Llama 3.2 3B Instruct (free)', tier: 'free' },
      { value: 'qwen/qwen2.5-7b', label: 'Qwen 2.5 7B (free)', tier: 'free' },
      { value: 'deepseek/deepseek-chat', label: 'DeepSeek Chat (free)', tier: 'free' }
    ],
    streaming: true,
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    buildPayload({ messages, prompt, context, ragResults, model }) {
      return {
        model,
        stream: true,
        temperature: 0.2,
        messages: composeMessages({ messages, prompt, context, ragResults })
      };
    },
    headers(apiKey) {
      return {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        'HTTP-Referer': getRefererHeader(),
        'X-Title': 'SolidCAM Assistant'
      };
    },
    extractText(data) {
      return data?.choices?.[0]?.message?.content || '';
    }
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    description: 'DeepSeek API with chat, reasoning, and coding models.',
    defaultModel: 'deepseek-chat',
    models: [
      { value: 'deepseek-chat', label: 'DeepSeek Chat', tier: 'standard' },
      { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner', tier: 'standard' },
      { value: 'deepseek-coder', label: 'DeepSeek Coder', tier: 'standard' }
    ],
    streaming: true,
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    buildPayload({ messages, prompt, context, ragResults, model }) {
      return {
        model,
        stream: true,
        temperature: 0.2,
        messages: composeMessages({ messages, prompt, context, ragResults })
      };
    },
    headers(apiKey) {
      return {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream'
      };
    },
    extractText(data) {
      return data?.choices?.[0]?.message?.content || '';
    }
  }
};

const DEFAULT_PROVIDER_ID = 'google';

function resolveModel(config, requestedModel) {
  if (!config) {
    return typeof requestedModel === 'string' && requestedModel.trim() ? requestedModel.trim() : '';
  }
  const available = Array.isArray(config.models) ? config.models : [];
  const trimmed = typeof requestedModel === 'string' ? requestedModel.trim() : '';
  if (trimmed && available.some(option => option.value === trimmed)) {
    return trimmed;
  }
  if (config.defaultModel) {
    return config.defaultModel;
  }
  return available[0]?.value || '';
}

function resolveModelLabel(config, value) {
  if (!config) return value;
  const match = config.models?.find(option => option.value === value);
  if (match?.label) return match.label;
  return value || config.defaultModel || '';
}

export function getProviderCatalog() {
  return Object.values(PROVIDERS).map(provider => ({
    id: provider.id,
    label: provider.label,
    description: provider.description,
    defaultModel: provider.defaultModel,
    models: provider.models.map(model => ({ ...model }))
  }));
}

export function getProviderDefaultModel(providerId) {
  const provider = PROVIDERS[providerId] || PROVIDERS[DEFAULT_PROVIDER_ID];
  return resolveModel(provider);
}

export function getProviderLabel(providerId) {
  const provider = PROVIDERS[providerId] || null;
  return provider?.label || providerId || 'Provider';
}

export function getProviderModelOptions(providerId) {
  const provider = PROVIDERS[providerId] || null;
  if (!provider) return [];
  return provider.models.map(model => ({ ...model }));
}

export function getSupportedProviderIds() {
  return Object.keys(PROVIDERS);
}

function composeMessages({ messages = [], prompt, context, ragResults }) {
  const systemSections = [];

  if (prompt?.content) {
    systemSections.push(prompt.content.trim());
  }

  const contextSummary = buildContextSummary(context);
  if (contextSummary) {
    systemSections.push(`Context summary:\n${contextSummary}`);
  }

  const ragSummary = buildRagSummary(ragResults, true);
  if (ragSummary) {
    systemSections.push(`Reference snippets:\n${ragSummary}`);
  }

  const composed = [];
  if (systemSections.length) {
    composed.push({ role: 'system', content: systemSections.join('\n\n') });
  }

  messages.forEach(message => {
    composed.push({ role: message.role, content: message.content || '' });
  });

  return composed;
}

async function streamResponse(response, onToken) {
  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    if (typeof onToken === 'function') {
      onToken(text);
    }
    return text;
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      if (buffer) {
        fullText = processSseBuffer(buffer, fullText, onToken);
      }
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const boundary = buffer.lastIndexOf('\n\n');
    if (boundary !== -1) {
      const chunk = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      fullText = processSseBuffer(chunk, fullText, onToken);
    }
  }

  return fullText;
}

function processSseBuffer(source, currentText, onToken) {
  let updatedText = currentText;
  const events = source.split('\n\n');
  events.forEach(eventBlock => {
    if (!eventBlock) return;
    const lines = eventBlock.split('\n');
    lines.forEach(line => {
      if (!line.startsWith('data:')) return;
      const payload = line.slice(5).trim();
      if (!payload || payload === STREAM_TERMINATOR) return;
      try {
        const parsed = JSON.parse(payload);
        const nextText = extractStreamText(parsed, updatedText);
        if (typeof nextText === 'string' && nextText !== updatedText) {
          updatedText = nextText;
          if (typeof onToken === 'function') {
            onToken(updatedText);
          }
        }
      } catch (error) {
        // Ignore malformed chunks
      }
    });
  });
  return updatedText;
}

function extractStreamText(parsed, currentText) {
  if (!parsed || typeof parsed !== 'object') {
    return currentText;
  }

  const delta = parsed?.choices?.[0]?.delta?.content;
  if (typeof delta === 'string' && delta.length) {
    return mergeChunk(currentText, delta);
  }

  const candidate = Array.isArray(parsed?.candidates) ? parsed.candidates[0] : null;
  if (candidate) {
    if (Array.isArray(candidate?.content?.parts)) {
      const addition = candidate.content.parts.map(part => part?.text || '').join('');
      if (addition) {
        return mergeChunk(currentText, addition);
      }
    }
    if (Array.isArray(candidate?.content)) {
      const addition = candidate.content.map(part => part?.text || '').join('');
      if (addition) {
        return mergeChunk(currentText, addition);
      }
    }
    if (typeof candidate?.content?.text === 'string' && candidate.content.text) {
      return mergeChunk(currentText, candidate.content.text);
    }
    if (typeof candidate?.output === 'string' && candidate.output) {
      return mergeChunk(currentText, candidate.output);
    }
  }

  const choiceMessage = parsed?.choices?.[0]?.message?.content;
  if (typeof choiceMessage === 'string' && choiceMessage.length) {
    return mergeChunk(currentText, choiceMessage);
  }

  return currentText;
}

function mergeChunk(current, addition) {
  if (!addition) return current;
  if (!current) return addition;
  if (addition === current) return current;
  if (addition.startsWith(current)) return addition;
  if (current.endsWith(addition)) return current;
  if (current.includes(addition)) return current;
  if (addition.includes(current)) return addition;
  return `${current}${addition}`;
}

function delay(ms) {
  return new Promise(resolve => {
    if (typeof window !== 'undefined' && typeof window.setTimeout === 'function') {
      window.setTimeout(resolve, ms);
    } else {
      setTimeout(resolve, ms);
    }
  });
}

class HybridRateLimiter {
  constructor({ tokensPerMinute = 20, burstSize = 3, windowMs = 60000 } = {}) {
    this.perMinuteLimit = Math.max(1, Math.floor(tokensPerMinute));
    this.maxTokens = Math.max(1, burstSize);
    this.windowMs = Math.max(windowMs, 1000);
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
    this.tokenRatePerMs = this.perMinuteLimit / this.windowMs;
    this.requestLog = [];
  }

  consume(now = Date.now()) {
    this.refill(now);
    this.cleanupRequestLog(now);

    const statusSnapshot = () => this.buildStatus(now);

    if (this.tokens + EPSILON < 1) {
      return {
        allowed: false,
        retryInMs: this.timeUntilNextToken(now),
        status: statusSnapshot()
      };
    }

    if (this.requestLog.length >= this.perMinuteLimit) {
      return {
        allowed: false,
        retryInMs: this.timeUntilWindowReset(now),
        status: statusSnapshot()
      };
    }

    this.tokens = Math.max(0, this.tokens - 1);
    this.requestLog.push(now);

    return {
      allowed: true,
      retryInMs: 0,
      status: statusSnapshot()
    };
  }

  getStatus(now = Date.now()) {
    this.refill(now);
    this.cleanupRequestLog(now);
    return this.buildStatus(now);
  }

  refill(now) {
    if (this.tokens >= this.maxTokens) {
      this.lastRefill = now;
      return;
    }
    const elapsed = Math.max(0, now - this.lastRefill);
    if (elapsed <= 0) {
      return;
    }
    const tokensToAdd = elapsed * this.tokenRatePerMs;
    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  cleanupRequestLog(now) {
    while (this.requestLog.length && now - this.requestLog[0] >= this.windowMs) {
      this.requestLog.shift();
    }
  }

  timeUntilNextToken(now) {
    if (this.tokens >= 1 - EPSILON) {
      return 0;
    }
    if (this.tokenRatePerMs <= 0) {
      return this.windowMs;
    }
    const deficit = 1 - this.tokens;
    return Math.max(0, Math.ceil(deficit / this.tokenRatePerMs));
  }

  timeUntilWindowReset(now) {
    if (!this.requestLog.length) {
      return 0;
    }
    return Math.max(0, this.windowMs - (now - this.requestLog[0]));
  }

  buildStatus(now) {
    const nextTokenInMs = this.timeUntilNextToken(now);
    const windowResetInMs = this.timeUntilWindowReset(now);
    return {
      tokens: Math.max(0, Math.floor(this.tokens)),
      tokensExact: Number(this.tokens.toFixed(3)),
      maxTokens: this.maxTokens,
      requestsInWindow: this.requestLog.length,
      perMinuteLimit: this.perMinuteLimit,
      windowMs: this.windowMs,
      nextTokenInMs,
      windowResetInMs,
      remainingWindowRequests: Math.max(0, this.perMinuteLimit - this.requestLog.length)
    };
  }
}

function createAbortController() {
  if (typeof AbortController === 'function') {
    return new AbortController();
  }
  return null;
}

function shouldRetryStatus(status) {
  if (!status) return false;
  if (status === 408 || status === 425 || status === 429) return true;
  if (status >= 500 && status < 600) return true;
  return false;
}

function shouldRetryError(error) {
  if (!(error instanceof ChatbotApiError)) {
    return false;
  }
  const status = error?.details?.status;
  if (typeof status === 'number') {
    return shouldRetryStatus(status);
  }

  const underlying = error?.details?.error;
  if (underlying) {
    if (underlying.name === 'AbortError') {
      return true;
    }
    if (underlying.name === 'TypeError' || underlying.name === 'NetworkError') {
      return true;
    }
  }

  return false;
}

function calculateBackoffWithJitter(base) {
  const clampedBase = Math.min(base, MAX_BACKOFF_MS);
  const jitterMultiplier = 0.5 + Math.random() * 0.5;
  return Math.min(Math.round(clampedBase * jitterMultiplier), MAX_BACKOFF_MS);
}

function extractRetryAfterMillis(headers) {
  if (!headers || typeof headers.get !== 'function') {
    return null;
  }
  const retryAfter = headers.get('retry-after');
  if (!retryAfter) {
    return null;
  }

  const numericDelay = Number(retryAfter);
  if (Number.isFinite(numericDelay)) {
    return Math.max(0, numericDelay * 1000);
  }

  const parsedDate = Date.parse(retryAfter);
  if (Number.isFinite(parsedDate)) {
    const now = Date.now();
    return Math.max(0, parsedDate - now);
  }

  return null;
}

async function safeReadResponseText(response) {
  try {
    return await response.text();
  } catch (error) {
    return `<<unavailable: ${error?.message || 'failed to read response'}>>`;
  }
}

function buildFallbackResponse(messages, prompt, providerId, model, context, ragResults, onToken) {
  const lastUserMessage = [...messages].reverse().find(entry => entry.role === 'user');
  const promptTitle = prompt?.name || 'SolidCAM Assistant';
  const providerConfig = PROVIDERS[providerId] || PROVIDERS[DEFAULT_PROVIDER_ID];
  const providerLabel = providerConfig?.label || (providerId ? providerId.toUpperCase() : 'LOCAL');
  const modelLabel = resolveModelLabel(providerConfig, model);
  const contextNote = buildContextSummary(context) || 'No context available.';
  const ragNote = buildRagSummary(ragResults) || 'No references available.';

  const acknowledgement = lastUserMessage?.content
    ? `You said: "${lastUserMessage.content}".`
    : 'I did not receive any question.';

  const text = [
    `[${promptTitle} | ${providerLabel}${modelLabel ? ` (${modelLabel})` : ''}]`,
    acknowledgement,
    contextNote,
    ragNote,
    'Streaming fallback: unable to reach provider from this environment.'
  ].join(' ');

  if (typeof onToken === 'function') {
    onToken(text);
  }

  console.debug('[SolidCAM Chat API]', {
    provider: providerId,
    model,
    streaming: false,
    length: text?.length || 0,
    note: 'fallback-response'
  });

  return {
    text,
    ragResults
  };
}

function buildContextSummary(context) {
  if (!context) return '';
  const lines = [];
  const selections = Array.isArray(context.selections?.packages) ? context.selections.packages : [];

  if (selections.length) {
    lines.push('Package selections:');
    selections.forEach(pkg => {
      const headline = pkg.name ? `${pkg.code} (${pkg.name})` : pkg.code;
      const detailParts = [];
      if (Array.isArray(pkg.looseBits) && pkg.looseBits.length) {
        detailParts.push(`Loose bits: ${pkg.looseBits.join(', ')}`);
      }
      if (Array.isArray(pkg.masterGroups)) {
        pkg.masterGroups.forEach(group => {
          if (group.label && Array.isArray(group.items) && group.items.length) {
            detailParts.push(`${group.label}: ${group.items.join(', ')}`);
          }
        });
      }
      if (Array.isArray(pkg.notes) && pkg.notes.length) {
        detailParts.push(`Notes: ${pkg.notes.join(', ')}`);
      }
      lines.push(`- ${headline}${detailParts.length ? ` -> ${detailParts.join('; ')}` : ''}`);
    });
  } else {
    const packages = Array.isArray(context.packages) ? context.packages : [];
    if (packages.length) {
      lines.push('Observed packages:');
      packages.slice(0, 5).forEach(pkg => {
        const headline = pkg.name ? `${pkg.code} (${pkg.name})` : pkg.code;
        const highlights = Array.isArray(pkg.looseBits) ? pkg.looseBits.slice(0, 3) : [];
        lines.push(`- ${headline}${highlights.length ? ` | Loose bits: ${highlights.join(', ')}` : ''}`);
      });
    }
  }

  if (context.templates?.activeId) {
    lines.push(`Active email template: ${context.templates.activeId}`);
  }

  return lines.join('\n');
}

function buildRagSummary(results = [], forSystem = false) {
  if (!Array.isArray(results) || results.length === 0) {
    return forSystem ? 'No references matched for this prompt.' : '';
  }

  const parts = results.slice(0, 3).map((entry, index) => {
    const title = entry.document?.title || `Reference ${index + 1}`;
    const snippet = (entry.document?.content || '').split('\n').find(Boolean) || '';
    const cleanSnippet = snippet.trim();
    if (forSystem) {
      return cleanSnippet ? `- ${title}: ${cleanSnippet}` : `- ${title}`;
    }
    return cleanSnippet ? `${title}: ${cleanSnippet}` : `${title}`;
  });

  return forSystem ? parts.join('\n') : parts.join(' | ');
}

function mapGoogleRole(role) {
  if (role === 'assistant') return 'model';
  if (role === 'system') return 'user';
  return role;
}

function getRefererHeader() {
  if (typeof window !== 'undefined' && window.location) {
    return window.location.origin;
  }
  return 'https://solidcam-assistant.local';
}
