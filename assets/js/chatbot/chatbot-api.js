const RETRY_DELAYS = [500, 1200, 2500];
const STREAM_TERMINATOR = '[DONE]';

export class ChatbotApiManager {
  constructor(options = {}) {
    this.fetchImpl =
      (typeof options.fetch === 'function' && options.fetch) ||
      (typeof fetch === 'function' ? fetch.bind(typeof window !== 'undefined' ? window : null) : null);
  }

  async sendMessage({
    messages = [],
    prompt,
    provider = 'deepseek',
    apiKey,
    context,
    ragResults = [],
    onToken
  }) {
    const config = PROVIDERS[provider] || PROVIDERS.deepseek;

    if (!this.fetchImpl) {
      return buildFallbackResponse(messages, prompt, provider, context, ragResults, onToken);
    }

    if (!apiKey) {
      throw new ChatbotApiError('API_KEY_MISSING', 'No API key configured for provider.');
    }

    const payload = config.buildPayload({ messages, prompt, context, ragResults });
    const url =
      typeof config.resolveEndpoint === 'function' ? config.resolveEndpoint(apiKey) : config.endpoint;

    const requestInit = {
      method: 'POST',
      headers: config.headers(apiKey),
      body: JSON.stringify(payload)
    };

    let lastError;
    for (let attempt = 0; attempt < RETRY_DELAYS.length; attempt += 1) {
      try {
        const response = await this.fetchImpl(url, requestInit);

        if (!response.ok) {
          const bodyText = await response.text();
          throw new ChatbotApiError('API_HTTP_ERROR', `Provider responded with status ${response.status}`, {
            status: response.status,
            body: bodyText
          });
        }

        if (payload.stream && response.body) {
          const text = await streamResponse(response, chunk => {
            if (typeof onToken === 'function') {
              onToken(chunk);
            }
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
        return {
          text,
          ragResults
        };
      } catch (error) {
        lastError =
          error instanceof ChatbotApiError
            ? error
            : new ChatbotApiError('API_REQUEST_FAILED', error.message || 'Unknown error', { error });

        if (attempt < RETRY_DELAYS.length - 1) {
          await delay(RETRY_DELAYS[attempt]);
          continue;
        }
        throw lastError;
      }
    }

    throw lastError || new ChatbotApiError('API_REQUEST_FAILED', 'Unknown API failure');
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

const PROVIDERS = {
  deepseek: {
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat',
    buildPayload({ messages, prompt, context, ragResults }) {
      return {
        model: this.model,
        stream: true,
        temperature: 0.2,
        messages: composeMessages({ messages, prompt, context, ragResults })
      };
    },
    headers(key) {
      return {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream'
      };
    },
    extractText(data) {
      return data?.choices?.[0]?.message?.content || '';
    }
  },
  openrouter: {
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'google/gemini-2.0-flash',
    buildPayload({ messages, prompt, context, ragResults }) {
      return {
        model: this.model,
        stream: true,
        temperature: 0.2,
        messages: composeMessages({ messages, prompt, context, ragResults })
      };
    },
    headers(key) {
      return {
        Authorization: `Bearer ${key}`,
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
  google: {
    endpoint: 'https://generativelanguage.googleapis.com/v1alpha/models/gemini-2.0-flash:streamGenerateContent',
    model: 'models/gemini-2.0-flash',
    buildPayload({ messages, prompt, context, ragResults }) {
      const composed = composeMessages({ messages, prompt, context, ragResults }).map(msg => ({
        role: mapGoogleRole(msg.role),
        parts: [{ text: msg.content }]
      }));
      return {
        contents: composed
      };
    },
    resolveEndpoint(apiKey) {
      const separator = this.endpoint.includes('?') ? '&' : '?';
      return `${this.endpoint}${separator}alt=sse&key=${encodeURIComponent(apiKey)}`;
    },
    headers(key) {
      return {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        'x-goog-api-key': key
      };
    },
    extractText(data) {
      const candidates = data?.candidates || [];
      const first = candidates[0]?.content?.parts?.[0]?.text;
      return first || '';
    }
  }
};

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

  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let fullText = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';

    for (const event of events) {
      const lines = event.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === STREAM_TERMINATOR) {
          continue;
        }
        try {
          const parsed = JSON.parse(payload);
          const delta = parsed?.choices?.[0]?.delta?.content;
          if (delta) {
            fullText += delta;
            if (typeof onToken === 'function') {
              onToken(fullText);
            }
          }
        } catch (error) {
          // Ignore malformed chunks
        }
      }
    }
  }

  return fullText;
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

function buildFallbackResponse(messages, prompt, provider, context, ragResults, onToken) {
  const lastUserMessage = [...messages].reverse().find(entry => entry.role === 'user');
  const promptTitle = prompt?.name || 'SolidCAM Assistant';
  const providerLabel = provider ? provider.toUpperCase() : 'LOCAL';
  const contextNote = buildContextSummary(context) || 'No context available.';
  const ragNote = buildRagSummary(ragResults) || 'No references available.';

  const acknowledgement = lastUserMessage?.content
    ? `You said: "${lastUserMessage.content}".`
    : 'I did not receive any question.';

  const text = [
    `[${promptTitle} | ${providerLabel}]`,
    acknowledgement,
    contextNote,
    ragNote,
    'Streaming fallback: unable to reach provider from this environment.'
  ].join(' ');

  if (typeof onToken === 'function') {
    onToken(text);
  }

  return {
    text,
    ragResults
  };
}

function buildContextSummary(context) {
  if (!context) return '';
  const packageCount = Array.isArray(context.packages) ? context.packages.length : 0;
  const checked = Array.isArray(context.selections?.checkedPackages) ? context.selections.checkedPackages.length : 0;
  const templateInfo = context.templates?.activeId
    ? `Active template: ${context.templates.activeId}`
    : 'No email template active.';

  return `Observed ${packageCount} packages (${checked} selected). ${templateInfo}`;
}

function buildRagSummary(results = [], forSystem = false) {
  if (!Array.isArray(results) || results.length === 0) {
    return forSystem ? 'No references matched for this prompt.' : '';
  }

  const parts = results.slice(0, 3).map((entry, index) => {
    const title = entry.document?.title || `Reference ${index + 1}`;
    const snippet = (entry.document?.content || '').split('\n').find(Boolean) || '';
    if (forSystem) {
      return `- ${title}: ${snippet}`;
    }
    return `${title}: ${snippet}`;
  });

  return forSystem ? parts.join('\n') : `Relevant references -> ${parts.join(' | ')}`;
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
