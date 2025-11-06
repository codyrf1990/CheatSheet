import { createChatbotUI } from './chatbot-ui.js';
import { ChatbotApiManager, getProviderCatalog } from './chatbot-api.js';
import { ChatbotContextProcessor } from './chatbot-context.js';
import { ChatbotRagEngine } from './chatbot-rag.js';
import { messageArchive } from '../message-archive.js';
import { ChatbotConversationManager } from './chatbot-conversation-manager.js';
import { ChatbotModeManager } from './chatbot-mode-manager.js';
import { createChatbotEventHandlers } from './chatbot-event-handlers.js';
import { ChatbotStateManager } from './chatbot-state-manager.js';
import {
  MODE_DEFS,
  MODE_GENERAL,
  MODE_LIST,
  MODE_PACKAGE,
  SIDEBAR_NAMES,
  STATUS_READY,
  sanitizeMode
} from './chatbot-constants.js';
import {
  loadPrompts,
  savePrompts,
  loadSettings,
  saveSettings,
  loadConversations,
  saveConversations,
  cleanupOldConversations,
  createConversation,
  generateMessageId,
  DEFAULT_PROMPTS,
  DEFAULT_SETTINGS
} from './chatbot-storage.js';

const PROVIDER_CATALOG = getProviderCatalog();
const PROVIDER_MAP = new Map(PROVIDER_CATALOG.map(provider => [provider.id, provider]));
const SUPPORTED_PROVIDER_IDS = PROVIDER_CATALOG.map(provider => provider.id);
const DEFAULT_PROVIDER_ID = PROVIDER_MAP.has(DEFAULT_SETTINGS.provider)
  ? DEFAULT_SETTINGS.provider
  : PROVIDER_CATALOG[0]?.id || 'google';

const isSupportedProvider = providerId => SUPPORTED_PROVIDER_IDS.includes(providerId);
const getDefaultProviderId = () => DEFAULT_PROVIDER_ID;
const isSidebarName = name => SIDEBAR_NAMES.includes(name);

let modeManager = null;
let conversationManager = null;
let stateManager = null;

export function initializeChatbot() {
  const container = document.querySelector('[data-chatbot-container]');
  if (!container) {
    return;
  }

  const apiManager = new ChatbotApiManager({
    tokensPerMinute: 20,
    burstSize: 3,
    onLimiterUpdate: status => {
      if (stateManager) {
        stateManager.setRateLimitStatus(status);
      } else {
        state.rateLimitStatus = status;
        if (state.settings.showDebugPanel) {
          updateDebugPanel();
        }
      }
    }
  });
  const contextProcessor = new ChatbotContextProcessor();
  const ragEngine = new ChatbotRagEngine();
  messageArchive.init().catch(error => {
    console.warn('[Chatbot] Message archive initialization failed.', error);
  });

  modeManager = new ChatbotModeManager({
    contextProcessor,
    ragEngine,
    buildConversationReferences
  });

  const state = {
    prompts: ensurePrompts(loadPrompts()),
    settings: ensureSettings(loadSettings()),
    conversations: loadConversations(),
    activeMode: null,
    activeConversationId: null,
    statusTimeoutId: null,
    contextSnapshot: null,
    sending: false,
    lastRagResults: [],
    debug: null,
    rateLimitStatus: null
  };

  conversationManager = new ChatbotConversationManager({
    state,
    messageArchive,
    persistConversations,
    refreshConversationList,
    persistSettings,
    ensureConversationTitle,
    createConversation,
    generateMessageId
  });

  stateManager = new ChatbotStateManager({
    state,
    saveSettings,
    savePrompts,
    persistConversations,
    updateDebugPanel
  });

  const getSettings = () =>
    stateManager ? stateManager.settings : state.settings;

  const updateSettingsSafe = partial => {
    if (stateManager) {
      stateManager.updateSettings(partial);
    } else {
      persistSettings(partial);
    }
  };

  const setSending = flag => {
    if (stateManager) {
      stateManager.sending = flag;
    } else {
      state.sending = Boolean(flag);
    }
  };

  const setLastRagResults = results => {
    if (stateManager) {
      stateManager.lastRagResults = Array.isArray(results) ? results : [];
    } else {
      state.lastRagResults = Array.isArray(results) ? results : [];
    }
  };

  const getLastRagResults = () =>
    stateManager
      ? stateManager.lastRagResults
      : state.lastRagResults;

  if (conversationManager) {
    conversationManager.persistSettings = updateSettingsSafe;
  }

  ensureProviderMaps(state.settings);
  if (!SUPPORTED_PROVIDER_IDS.includes(state.settings.provider)) {
    state.settings.provider = DEFAULT_PROVIDER_ID;
  }
  ensureProviderModel(state.settings, state.settings.provider);

  ensureConversationsForModes(state);
  state.activeMode = sanitizeMode(state.settings.activeMode) || MODE_PACKAGE;
  const startingConversation = ensureConversationForMode(state, state.activeMode, { createIfMissing: true });
  state.activeConversationId = startingConversation?.id || null;

  let eventHandlers;

  const ui = createChatbotUI({
    container,
    modes: MODE_LIST.map(mode => ({
      id: mode,
      label: MODE_DEFS[mode].label
    })),
    providers: PROVIDER_CATALOG,
    onSend: text => eventHandlers.handleSend(text),
    onNewConversation: () => eventHandlers.handleNewConversation(),
    onSelectConversation: id => eventHandlers.handleSelectConversation(id),
    onCopyConversation: () => eventHandlers.handleCopyConversation(),
    onModeChange: mode => eventHandlers.handleModeChange(mode),
    onProviderChange: providerId => eventHandlers.handleProviderChange(providerId),
    onModelChange: modelId => eventHandlers.handleModelChange(modelId),
    onSettingsSave: payload => eventHandlers.handleSettingsSave(payload),
    onSettingsClose: () => eventHandlers.handleSettingsClose(),
    onClearApiKey: providerId => eventHandlers.handleClearApiKey(providerId),
    onSidebarWidthChange: (name, width) =>
      eventHandlers.handleSidebarWidthChange(name, width),
    onPromptReset: mode => eventHandlers.handlePromptReset(mode),
    onToggleDebug: show => eventHandlers.handleToggleDebug(show)
  });

  let isDestroyed = false;
  const teardownCallbacks = [];

  eventHandlers = createChatbotEventHandlers({
    state,
    ui,
    apiManager,
    contextProcessor,
    ragEngine,
    modeManager,
    conversationManager,
    stateManager,
    messageArchive,
    helpers: {
      getSettings,
      updateSettingsSafe,
      setSending,
      setLastRagResults,
      getLastRagResults,
      refreshConversationList,
      persistConversations,
      ensureConversationForMode,
      ensureConversationTitle,
      findConversation,
      createConversation,
      generateMessageId,
      buildConversationReferences,
      buildReferences,
      friendlyErrorMessage,
      getPromptForMode,
      createPlainApiKeyMap,
      ensureProviderModel,
      getProviderModels,
      getProviderLabelById,
      setEncryptedApiKey,
      getPlainApiKey,
      ensurePrompts,
      DEFAULT_PROMPTS,
      delayStatusReset,
      logProviderRun,
      updateDebugPanel,
      copyToClipboard,
      saveSettings,
      savePrompts,
      syncModelDropdown,
      isSupportedProvider,
      getDefaultProviderId,
      isSidebarName
    }
  });

  ui.setSidebarWidths(state.settings.sidebarWidths);
  ui.setMode(state.activeMode, MODE_DEFS[state.activeMode]);
  ui.setPrompts(state.prompts);
  ui.setSettings({
    provider: state.settings.provider,
    apiKeys: createPlainApiKeyMap(state.settings),
    showDebugPanel: state.settings.showDebugPanel
  });
  syncModelDropdown();
  refreshConversationList();

  const activeMessages = findConversation(state, state.activeConversationId)?.messages || [];
  ui.setMessages(activeMessages);
  updateDebugPanel();

  const handleSnapshot = snapshot => {
    if (state.activeMode !== MODE_PACKAGE) {
      return;
    }
    if (modeManager) {
      modeManager.updateSnapshot(snapshot);
    }
    state.contextSnapshot = snapshot || null;
    if (snapshot) {
      ragEngine.ingest(snapshot);
    } else {
      ragEngine.reset([]);
    }
    if (getSettings().showDebugPanel) {
      updateDebugPanel();
    }
  };

  contextProcessor.onUpdate('snapshot', handleSnapshot);
  if (modeManager) {
    const activation = modeManager.activate(state.activeMode);
    state.contextSnapshot = activation.snapshot || null;
  } else if (state.activeMode === MODE_PACKAGE) {
    contextProcessor.start();
    state.contextSnapshot = contextProcessor.getSnapshot();
    ragEngine.ingest(state.contextSnapshot);
  }

  const performCleanup = () => {
    if (isDestroyed) {
      return;
    }
    isDestroyed = true;

    while (teardownCallbacks.length) {
      const callback = teardownCallbacks.pop();
      try {
        callback();
      } catch (error) {
        console.warn('[Chatbot] Cleanup callback failed.', error);
      }
    }

    if (modeManager) {
      modeManager.cleanup();
      modeManager = null;
    } else {
      contextProcessor.stop();
    }
    conversationManager = null;
    stateManager = null;
    contextProcessor.removeListener('snapshot');

    if (ui && typeof ui.teardown === 'function') {
      ui.teardown();
    }
  };

  const registerWindowCleanup = () => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleBeforeUnload = () => {
      performCleanup();
    };
    const handlePageHide = () => {
      performCleanup();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);

    teardownCallbacks.push(() => window.removeEventListener('beforeunload', handleBeforeUnload));
    teardownCallbacks.push(() => window.removeEventListener('pagehide', handlePageHide));
  };

  registerWindowCleanup();

  function syncModelDropdown() {
    const providerId = getSettings().provider;
    const models = getProviderModels(providerId);
    const activeModel = ensureProviderModel(getSettings(), providerId);
    ui.setModels(providerId, models, activeModel);
  }

  function refreshConversationList() {
    state.conversations.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const summaries = mapConversationSummaries(state.conversations, state.activeMode);
    ui.setConversations(summaries, state.activeConversationId);
    ui.setMode(state.activeMode, MODE_DEFS[state.activeMode]);
  }

  function persistConversations() {
    const result = saveConversations(state.conversations);
    if (!result || result.success) {
      return true;
    }

    if (result.error === 'InvalidPayload') {
      console.warn('[Chatbot] Failed to save conversations: invalid payload.');
      return false;
    }

    if (result.error === 'QuotaExceededError') {
      const trimmed = cleanupOldConversations(state.conversations);
      if (trimmed.length < state.conversations.length) {
        state.conversations = trimmed;
        if (!trimmed.some(conversation => conversation.id === state.activeConversationId)) {
          state.activeConversationId = trimmed[0]?.id || null;
        }
        const retry = saveConversations(state.conversations);
        if (retry?.success) {
          refreshConversationList();
          return true;
        }
      }

      if (ui && typeof ui.showBanner === 'function') {
        ui.showBanner('Storage is full. Clear older conversations to continue.', 'warning');
      }
      return false;
    }

    if (ui && typeof ui.showBanner === 'function') {
      ui.showBanner('Failed to save conversation changes.', 'error');
    }
    return false;
  }

  function persistSettings(partial) {
    if (partial && typeof partial === 'object') {
      state.settings = {
        ...state.settings,
        ...partial,
        lastConversationIds: {
          ...state.settings.lastConversationIds,
          ...(partial.lastConversationIds || {})
        },
        providerModels: {
          ...state.settings.providerModels,
          ...(partial.providerModels || {})
        },
        sidebarWidths: {
          ...state.settings.sidebarWidths,
          ...(partial.sidebarWidths || {})
        }
      };
    }
    saveSettings(state.settings);
  }

  function delayStatusReset() {
    if (state.statusTimeoutId) {
      clearTimeout(state.statusTimeoutId);
    }
    state.statusTimeoutId = setTimeout(() => {
      ui.setStatus(STATUS_READY);
      state.statusTimeoutId = null;
    }, 2600);
  }

  function updateDebugPanel(extra = {}) {
    const settingsRef = getSettings();
    if (!ui || !settingsRef.showDebugPanel) {
      state.debug = null;
      return;
    }
    const providerId = settingsRef.provider;
    const modelId = ensureProviderModel(settingsRef, providerId);
    const prompt = getPromptForMode(state.prompts, state.activeMode);
    const conversation = findConversation(state, state.activeConversationId);
    const debugData = {
      mode: state.activeMode,
      modeLabel: MODE_DEFS[state.activeMode].label,
      provider: providerId,
      model: modelId,
      promptName: prompt.name,
      promptPreview: truncate(prompt.content, 240),
      messages: conversation ? conversation.messages.length : 0,
      lastUpdated: conversation
        ? new Date(conversation.updatedAt || conversation.createdAt).toLocaleString()
        : 'N/A',
      contextSummary:
        state.activeMode === MODE_PACKAGE
          ? summarizeContext(state.contextSnapshot)
          : 'Conversation history only',
      ragTitles: getLastRagResults()
        .map(entry => entry.document?.title)
        .filter(Boolean)
        .join(', '),
      rateLimit: state.rateLimitStatus
        ? {
            tokensExact: state.rateLimitStatus.tokensExact,
            burstRemaining: state.rateLimitStatus.tokens,
            burstCapacity: state.rateLimitStatus.maxTokens,
            perMinuteLimit: state.rateLimitStatus.perMinuteLimit,
            remainingWindowRequests: state.rateLimitStatus.remainingWindowRequests,
            nextTokenInMs: state.rateLimitStatus.nextTokenInMs,
            windowResetInMs: state.rateLimitStatus.windowResetInMs
          }
        : null,
      ...extra
    };
    state.debug = debugData;
    ui.setDebugData(debugData);
  }

  return {
    destroy: performCleanup
  };
}

function mapConversationSummaries(conversations, mode) {
  return conversations
    .filter(conversation => conversation.mode === mode)
    .map(conversation => ({
      id: conversation.id,
      title: conversation.title || 'Conversation',
      updatedAt: conversation.updatedAt,
      snippet: buildConversationSnippet(conversation)
    }));
}

function ensureConversationTitle(conversation) {
  if (conversation.title && conversation.title !== 'New Conversation') {
    return;
  }
  const firstUser = conversation.messages.find(msg => msg.role === 'user' && msg.content.trim());
  if (!firstUser) return;
  conversation.title = truncate(firstUser.content.trim(), 60);
}

function buildConversationSnippet(conversation) {
  const latest = [...conversation.messages]
    .reverse()
    .find(msg => msg.role !== 'system' && msg.content && msg.content.trim());
  return latest ? truncate(latest.content.trim(), 160) : '';
}

function truncate(text, length) {
  if (!text) return '';
  if (text.length <= length) return text;
  return `${text.slice(0, length - 3)}...`;
}

function findConversation(state, id) {
  if (!id) return null;
  return state.conversations.find(conversation => conversation.id === id) || null;
}

function getPromptForMode(prompts, mode) {
  const normalized = sanitizeMode(mode);
  const fallback = ensurePrompts(DEFAULT_PROMPTS)[normalized];
  if (!prompts || typeof prompts !== 'object') {
    return { ...fallback };
  }
  const entry = prompts[normalized];
  if (!entry) {
    return { ...fallback };
  }
  return {
    id: fallback.id,
    name: entry.name || fallback.name,
    content: entry.content || fallback.content
  };
}

function ensurePrompts(prompts) {
  const defaults = {
    [MODE_PACKAGE]: { ...DEFAULT_PROMPTS.package },
    [MODE_GENERAL]: { ...DEFAULT_PROMPTS.general }
  };
  if (!prompts || typeof prompts !== 'object') {
    return defaults;
  }
  return {
    [MODE_PACKAGE]: normalizePrompt(prompts.package, defaults.package),
    [MODE_GENERAL]: normalizePrompt(prompts.general, defaults.general)
  };
}

function normalizePrompt(entry, fallback) {
  if (!entry || typeof entry !== 'object') {
    return { ...fallback };
  }
  const name =
    typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : fallback.name;
  const content =
    typeof entry.content === 'string' && entry.content.trim() ? entry.content.trim() : fallback.content;
  return {
    id: fallback.id,
    name,
    content
  };
}

function ensureConversationsForModes(state) {
  MODE_LIST.forEach(mode => {
    const existing = state.conversations.some(conversation => conversation.mode === mode);
    if (!existing) {
      const conversation = createConversation({ mode });
      state.conversations.push(conversation);
    }
  });
}

function ensureConversationForMode(state, mode, options = {}) {
  const normalized = sanitizeMode(mode);
  if (!normalized) return null;
  const lastId = state.settings.lastConversationIds?.[normalized];
  if (lastId) {
    const match = findConversation(state, lastId);
    if (match && match.mode === normalized) {
      return match;
    }
  }
  const existing = state.conversations.find(conversation => conversation.mode === normalized);
  if (existing) {
    return existing;
  }
  if (options.createIfMissing) {
    const created = createConversation({ mode: normalized });
    state.conversations.unshift(created);
    saveConversations(state.conversations);
    return created;
  }
  return null;
}

function ensureSettings(settings) {
  const merged = {
    ...DEFAULT_SETTINGS,
    ...(settings && typeof settings === 'object' ? settings : {})
  };
  merged.sidebarWidths = sanitizeSidebarWidths(merged.sidebarWidths);
  ensureProviderMaps(merged);
  if (!SUPPORTED_PROVIDER_IDS.includes(merged.provider)) {
    merged.provider = DEFAULT_PROVIDER_ID;
  }
  ensureProviderModel(merged, merged.provider);
  merged.activeMode = sanitizeMode(merged.activeMode) || MODE_PACKAGE;
  merged.lastConversationIds = {
    package: typeof merged.lastConversationIds?.package === 'string' ? merged.lastConversationIds.package : null,
    general: typeof merged.lastConversationIds?.general === 'string' ? merged.lastConversationIds.general : null
  };
  merged.showDebugPanel = Boolean(merged.showDebugPanel);
  return merged;
}

function sanitizeSidebarWidths(value) {
  if (!value || typeof value !== 'object') {
    return {};
  }
  const result = {};
  SIDEBAR_NAMES.forEach(name => {
    const numeric = Number(value[name]);
    if (Number.isFinite(numeric) && numeric > 0) {
      result[name] = Math.round(numeric);
    }
  });
  return result;
}

function getProviderMeta(providerId) {
  return PROVIDER_MAP.get(providerId) || null;
}

function getProviderLabelById(providerId) {
  const meta = getProviderMeta(providerId);
  return meta?.label || providerId || 'Provider';
}

function getProviderModels(providerId) {
  const meta = getProviderMeta(providerId);
  return Array.isArray(meta?.models) ? meta.models : [];
}

function ensureProviderMaps(settings) {
  if (!settings || typeof settings !== 'object') {
    return;
  }
  if (!settings.apiKeys || typeof settings.apiKeys !== 'object') {
    settings.apiKeys = {};
  }
  if (!settings.providerModels || typeof settings.providerModels !== 'object') {
    settings.providerModels = {};
  }
  PROVIDER_CATALOG.forEach(provider => {
    if (typeof settings.apiKeys[provider.id] !== 'string') {
      settings.apiKeys[provider.id] = '';
    }
    const models = getProviderModels(provider.id);
    if (!models.length) {
      settings.providerModels[provider.id] = '';
    } else {
      const current = settings.providerModels[provider.id];
      if (typeof current !== 'string' || !models.some(model => model.value === current)) {
        settings.providerModels[provider.id] = provider.defaultModel || models[0].value;
      }
    }
  });
}

function ensureProviderModel(settings, providerId) {
  if (!settings || typeof settings !== 'object') {
    return '';
  }
  ensureProviderMaps(settings);
  const models = getProviderModels(providerId);
  if (!models.length) {
    settings.providerModels[providerId] = '';
    return '';
  }
  const current = settings.providerModels[providerId];
  if (current && models.some(model => model.value === current)) {
    return current;
  }
  const meta = getProviderMeta(providerId);
  const fallback = meta?.defaultModel || models[0].value;
  settings.providerModels[providerId] = fallback;
  return fallback;
}

function createPlainApiKeyMap(settings) {
  const result = {};
  PROVIDER_CATALOG.forEach(provider => {
    result[provider.id] = getPlainApiKey(settings, provider.id);
  });
  return result;
}

function getPlainApiKey(settings, providerId) {
  if (!settings || typeof settings !== 'object') {
    return '';
  }
  const apiKey = settings.apiKeys && typeof settings.apiKeys === 'object' ? settings.apiKeys[providerId] : '';
  return typeof apiKey === 'string' ? apiKey : '';
}

function setEncryptedApiKey(settings, providerId, plainKey) {
  if (!settings || typeof settings !== 'object') {
    return;
  }
  if (!settings.apiKeys || typeof settings.apiKeys !== 'object') {
    settings.apiKeys = {};
  }
  const trimmed = typeof plainKey === 'string' ? plainKey.trim() : '';
  settings.apiKeys[providerId] = trimmed;
}

function buildReferences(results = []) {
  if (!Array.isArray(results) || !results.length) return [];
  return results.map(entry => ({
    title: entry.document?.title || 'Reference',
    snippet: (entry.document?.content || '').split('\n').find(Boolean) || ''
  }));
}

async function buildConversationReferences(conversationId, messages = []) {
  const baseMessages = Array.isArray(messages) ? messages : [];
  let combined = baseMessages;
  if (conversationId) {
    try {
      combined = await messageArchive.getAllMessages(conversationId, baseMessages);
    } catch (error) {
      console.warn('[Chatbot] Failed to combine archived messages for references.', error);
    }
  }
  const trimmed = combined.filter(msg => msg.role !== 'system' && msg.content);
  if (!trimmed.length) return [];
  const recent = trimmed.slice(-6);
  return recent
    .map((message, index) => ({
      document: {
        title: message.role === 'user' ? 'User message' : 'Assistant reply',
        content: truncate(message.content, 360)
      },
      score: (recent.length - index) / recent.length
    }))
    .reverse();
}

function logProviderRun(details) {
  const payload = {
    provider: details.providerId,
    model: details.modelId,
    mode: details.mode,
    durationMs: details.durationMs,
    responseChars: details.textLength,
    ragCount: details.ragCount,
    error: details.error || null
  };
  console.log('[SolidCAM Assistant Call]', payload);
}

function summarizeContext(snapshot) {
  if (!snapshot) {
    return 'No package context captured.';
  }
  const packages = Array.isArray(snapshot.packages) ? snapshot.packages.length : 0;
  const selections = Array.isArray(snapshot.selections?.packages) ? snapshot.selections.packages.length : 0;
  return `Packages observed: ${packages}. Packages with selections: ${selections}.`;
}

function copyToClipboard(text) {
  if (!text) {
    return Promise.reject(new Error('Nothing to copy'));
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    return navigator.clipboard.writeText(text);
  }
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Clipboard unavailable'));
      return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (success) {
        resolve();
      } else {
        reject(new Error('execCommand failed'));
      }
    } catch (error) {
      document.body.removeChild(textarea);
      reject(error);
    }
  });
}

function friendlyErrorMessage(error) {
  if (!error) return 'The provider could not process the request.';

  if (error.type === 'API_KEY_MISSING') {
    return 'No API key configured. Add a key in Settings and try again.';
  }

  if (error.type === 'RATE_LIMITED') {
    const retryInMs = Number(error.details?.retryInMs) || 0;
    const seconds = Math.max(1, Math.ceil(retryInMs / 1000));
    return `You are sending messages too quickly. Try again in about ${seconds} second${seconds === 1 ? '' : 's'}.`;
  }

  if (error.type === 'API_HTTP_ERROR') {
    const status = Number(error.details?.status);
    if (status === 401 || status === 403) {
      return 'The provider rejected the request. Check your API key and model permissions.';
    }
    if (status === 429) {
      return 'The provider rate limit was reached. Please wait a bit before trying again.';
    }
    if (status >= 500) {
      return 'The provider is experiencing issues. Please retry in a moment.';
    }
    return `Provider returned status ${status || 'unknown'}. Check the logs for details.`;
  }

  if (error.type === 'API_REQUEST_FAILED') {
    return 'The request could not be completed. Check your network connection and try again.';
  }

  return error.message || 'Unexpected error while contacting the provider.';
}
