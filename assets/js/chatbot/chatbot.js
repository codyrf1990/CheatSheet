import { createChatbotUI } from './chatbot-ui.js';
import { ChatbotApiManager, getProviderCatalog } from './chatbot-api.js';
import { ChatbotContextProcessor } from './chatbot-context.js';
import { ChatbotRagEngine } from './chatbot-rag.js';
import {
  loadPrompts,
  savePrompts,
  loadSettings,
  saveSettings,
  loadConversations,
  saveConversations,
  createConversation,
  generateMessageId,
  obfuscateKey,
  revealKey,
  DEFAULT_PROMPTS,
  DEFAULT_SETTINGS
} from './chatbot-storage.js';

const STATUS_READY = 'ready';
const STATUS_THINKING = 'thinking';
const STATUS_ERROR = 'error';
const SIDEBAR_NAMES = ['conversations', 'settings'];
const MODE_PACKAGE = 'package';
const MODE_GENERAL = 'general';
const MODE_DEFS = {
  [MODE_PACKAGE]: {
    id: MODE_PACKAGE,
    label: 'Package Assistant',
    title: 'SolidCAM Package Architect',
    subtitle: 'Guide reps through packages, maintenance, and dongles',
    placeholder: 'Ask about SolidCAM packages, maintenance SKUs, or dongles...'
  },
  [MODE_GENERAL]: {
    id: MODE_GENERAL,
    label: 'General Assistant',
    title: 'SolidCAM Enterprise Assistant',
    subtitle: 'Support the team with research, communication, and policy',
    placeholder: 'Ask the SolidCAM team assistant anything internal...'
  }
};
const MODE_LIST = [MODE_PACKAGE, MODE_GENERAL];
const PROVIDER_CATALOG = getProviderCatalog();
const PROVIDER_MAP = new Map(PROVIDER_CATALOG.map(provider => [provider.id, provider]));
const SUPPORTED_PROVIDER_IDS = PROVIDER_CATALOG.map(provider => provider.id);
const DEFAULT_PROVIDER_ID = PROVIDER_MAP.has(DEFAULT_SETTINGS.provider)
  ? DEFAULT_SETTINGS.provider
  : PROVIDER_CATALOG[0]?.id || 'google';

export function initializeChatbot() {
  const container = document.querySelector('[data-chatbot-container]');
  if (!container) {
    return;
  }

  const apiManager = new ChatbotApiManager();
  const contextProcessor = new ChatbotContextProcessor();
  const ragEngine = new ChatbotRagEngine();

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
    debug: null
  };

  ensureProviderMaps(state.settings);
  if (!SUPPORTED_PROVIDER_IDS.includes(state.settings.provider)) {
    state.settings.provider = DEFAULT_PROVIDER_ID;
  }
  ensureProviderModel(state.settings, state.settings.provider);

  ensureConversationsForModes(state);
  state.activeMode = sanitizeMode(state.settings.activeMode) || MODE_PACKAGE;
  const startingConversation = ensureConversationForMode(state, state.activeMode, { createIfMissing: true });
  state.activeConversationId = startingConversation?.id || null;

  const ui = createChatbotUI({
    container,
    modes: MODE_LIST.map(mode => ({
      id: mode,
      label: MODE_DEFS[mode].label
    })),
    onSend: handleSend,
    onNewConversation: handleNewConversation,
    onSelectConversation: handleSelectConversation,
    onCopyConversation: handleCopyConversation,
    onModeChange: handleModeChange,
    onProviderChange: handleProviderChange,
    onModelChange: handleModelChange,
    onSettingsSave: handleSettingsSave,
    onSettingsClose: handleSettingsClose,
    onClearApiKey: handleClearApiKey,
    onSidebarWidthChange: handleSidebarWidthChange,
    onPromptReset: handlePromptReset,
    onToggleDebug: handleToggleDebug
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
    state.contextSnapshot = snapshot;
    ragEngine.ingest(snapshot);
    if (state.settings.showDebugPanel) {
      updateDebugPanel();
    }
  };

  contextProcessor.onUpdate('snapshot', handleSnapshot);
  if (state.activeMode === MODE_PACKAGE) {
    contextProcessor.start();
    state.contextSnapshot = contextProcessor.getSnapshot();
    ragEngine.ingest(state.contextSnapshot);
  }

  function handleSend(text) {
    if (state.sending) {
      ui.showBanner('Please wait for the current response to finish.', 'warning');
      return;
    }

    const providerId = state.settings.provider;
    const providerLabel = getProviderLabelById(providerId);
    const modelId = ensureProviderModel(state.settings, providerId);
    const apiKeyPlain = getPlainApiKey(state.settings, providerId);
    if (!apiKeyPlain) {
      ui.showBanner(`Add a ${providerLabel} API key in Settings before sending messages.`, 'warning');
      return;
    }

    if (!modelId) {
      ui.showBanner(`Select a model for ${providerLabel} before sending messages.`, 'warning');
      return;
    }

    const conversation = ensureActiveConversation();
    if (!conversation) {
      ui.showBanner('Unable to locate the active conversation. Start a new chat.', 'error');
      return;
    }

    const prompt = getPromptForMode(state.prompts, state.activeMode);

    const userMessage = {
      id: generateMessageId('user'),
      role: 'user',
      content: text,
      createdAt: Date.now(),
      references: []
    };
    conversation.messages.push(userMessage);
    conversation.updatedAt = Date.now();

    ui.appendMessage(userMessage);
    ui.clearInput();
    persistConversations();
    refreshConversationList();

    const historyMessages = conversation.messages
      .filter(message => message.role !== 'system' || message.content)
      .map(({ role, content }) => ({ role, content }));

    let context = null;
    let ragResults = [];
    if (state.activeMode === MODE_PACKAGE) {
      const snapshot = state.contextSnapshot || contextProcessor.getSnapshot();
      context = snapshot;
      ragEngine.ingest(snapshot);
      ragResults = ragEngine.search(text);
    } else {
      context = null;
      ragResults = buildConversationReferences(conversation.messages);
    }

    state.lastRagResults = ragResults;

    const assistantMessage = {
      id: generateMessageId('assistant'),
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      references: []
    };
    conversation.messages.push(assistantMessage);
    ui.appendMessage(assistantMessage);

    state.sending = true;
    ui.hideBanner();
    ui.setStatus(STATUS_THINKING);
    ui.setStreaming(true);

    const startTime = Date.now();

    apiManager
      .sendMessage({
        messages: historyMessages,
        prompt,
        provider: providerId,
        model: modelId,
        apiKey: apiKeyPlain,
        context,
        ragResults,
        onToken: chunk => {
          assistantMessage.content = chunk;
          ui.updateMessage(assistantMessage.id, { content: chunk, streaming: true });
        }
      })
      .then(result => {
        const finalText =
          typeof result.text === 'string' && result.text.trim().length
            ? result.text
            : assistantMessage.content;
        assistantMessage.content =
          finalText && finalText.trim().length
            ? finalText
            : 'The provider returned an empty response. Try rephrasing or switching models.';
          const rawReferences = result.ragResults || ragResults;
          const shouldDisplayReferences = conversation.mode === MODE_PACKAGE;
          const displayReferences = shouldDisplayReferences ? buildReferences(rawReferences) : [];
          state.lastRagResults = rawReferences;
          assistantMessage.references = displayReferences;
          conversation.updatedAt = Date.now();
          ensureConversationTitle(conversation);
          ui.updateMessage(assistantMessage.id, {
            content: assistantMessage.content,
            references: assistantMessage.references,
            streaming: false,
            error: false
          });
          state.sending = false;
          ui.setStreaming(false);
          ui.setStatus(STATUS_READY);
          ui.focusInput();
          persistConversations();
          refreshConversationList();
          persistSettings({
            lastConversationIds: {
              ...state.settings.lastConversationIds,
              [state.activeMode]: conversation.id
            }
          });
          logProviderRun({
            providerId,
            modelId,
            mode: state.activeMode,
            durationMs: Date.now() - startTime,
            textLength: assistantMessage.content.length,
            ragCount: rawReferences.length
          });
          updateDebugPanel({
            lastResponseLength: assistantMessage.content.length,
            ragUsed: displayReferences.length > 0
          });
      })
      .catch(error => {
        const message = friendlyErrorMessage(error);
        assistantMessage.content = message;
        assistantMessage.error = true;
        conversation.updatedAt = Date.now();
        ui.updateMessage(assistantMessage.id, {
          content: assistantMessage.content,
          streaming: false,
          error: true
        });
        state.sending = false;
        ui.setStreaming(false);
        ui.setStatus(STATUS_ERROR);
        delayStatusReset();
        ui.showBanner(message, 'error');
        persistConversations();
        refreshConversationList();
        logProviderRun({
          providerId,
          modelId,
          mode: state.activeMode,
          durationMs: Date.now() - startTime,
          textLength: 0,
          ragCount: ragResults.length,
          error: message
        });
        updateDebugPanel({ lastResponseLength: 0, ragUsed: false, error: message });
      });
  }

  function handleNewConversation() {
    const conversation = createConversation({ mode: state.activeMode });
    state.conversations.unshift(conversation);
    state.activeConversationId = conversation.id;
    persistConversations();
    refreshConversationList();
    ui.setMessages(conversation.messages);
    ui.focusInput();
    persistSettings({
      lastConversationIds: {
        ...state.settings.lastConversationIds,
        [state.activeMode]: conversation.id
      }
    });
    if (state.settings.showDebugPanel) {
      updateDebugPanel();
    }
  }

  function handleSelectConversation(conversationId) {
    const conversation = findConversation(state, conversationId);
    if (!conversation) return;
    if (conversation.mode !== state.activeMode) {
      handleModeChange(conversation.mode, { conversationId });
      return;
    }
    state.activeConversationId = conversation.id;
    persistSettings({
      lastConversationIds: {
        ...state.settings.lastConversationIds,
        [state.activeMode]: conversation.id
      }
    });
    ui.setMessages(conversation.messages);
    refreshConversationList();
    ui.focusInput();
    if (state.settings.showDebugPanel) {
      updateDebugPanel();
    }
  }

  function handleCopyConversation() {
    const conversation = findConversation(state, state.activeConversationId);
    if (!conversation) {
      ui.showBanner('No conversation available to copy.', 'warning');
      setTimeout(() => ui.hideBanner(), 2500);
      return;
    }

    const lines = [];
    const modeMeta = MODE_DEFS[conversation.mode] || null;
    if (modeMeta) {
      lines.push(`${modeMeta.label}`);
    }
    lines.push(`Provider: ${getProviderLabelById(state.settings.provider)}`);
    lines.push(`Model: ${ensureProviderModel(state.settings, state.settings.provider)}`);

    conversation.messages.forEach(message => {
      const role = message.role === 'user' ? 'You' : message.role === 'assistant' ? 'Assistant' : (message.role || 'System');
      const content = (message.content || '').trim();
      const block = `${role}:\n${content}`;
      lines.push(block.trimEnd());
    });

    const payload = lines.join('\n\n').trim();
    if (!payload) {
      ui.showBanner('Conversation is empty.', 'info');
      setTimeout(() => ui.hideBanner(), 2500);
      return;
    }

    copyToClipboard(payload)
      .then(() => {
        ui.showBanner('Conversation copied to clipboard.', 'success');
        setTimeout(() => ui.hideBanner(), 2500);
      })
      .catch(() => {
        ui.showBanner('Unable to copy conversation. Check browser permissions.', 'error');
      });
  }

  function handleModeChange(mode, options = {}) {
    const nextMode = sanitizeMode(mode);
    if (!nextMode || nextMode === state.activeMode) {
      return;
    }

    if (state.activeMode === MODE_PACKAGE) {
      contextProcessor.stop();
    }

    state.activeMode = nextMode;
    state.settings.activeMode = nextMode;
    persistSettings({ activeMode: nextMode });

    let conversation = null;
    if (options.conversationId) {
      const existing = findConversation(state, options.conversationId);
      if (existing && existing.mode === nextMode) {
        conversation = existing;
      }
    }
    if (!conversation) {
      conversation = ensureConversationForMode(state, nextMode, { createIfMissing: true });
    }
    state.activeConversationId = conversation ? conversation.id : null;

    if (nextMode === MODE_PACKAGE) {
      contextProcessor.start();
      state.contextSnapshot = contextProcessor.getSnapshot();
      ragEngine.ingest(state.contextSnapshot);
    } else {
      contextProcessor.stop();
      state.contextSnapshot = null;
      ragEngine.reset([]);
    }

    refreshConversationList();
    ui.setMode(state.activeMode, MODE_DEFS[state.activeMode]);
    ui.setMessages(conversation ? conversation.messages : []);
    if (state.settings.showDebugPanel) {
      updateDebugPanel();
    }
  }

  function handleProviderChange(providerId) {
    if (!SUPPORTED_PROVIDER_IDS.includes(providerId)) {
      ui.showSettingsNotification('Unsupported provider selected.', 'warning');
      return;
    }
    const previousProvider = state.settings.provider;
    state.settings.provider = providerId;
    ensureProviderModel(state.settings, providerId);
    if (previousProvider !== providerId) {
      persistSettings({
        provider: providerId,
        providerModels: { ...state.settings.providerModels }
      });
    }
    ui.setSettings({
      provider: state.settings.provider,
      apiKeys: createPlainApiKeyMap(state.settings),
      showDebugPanel: state.settings.showDebugPanel
    });
    syncModelDropdown();

    // Only focus main input and close settings if we have a valid API key for this provider
    const apiKey = getPlainApiKey(state.settings, providerId);
    if (apiKey && apiKey.trim()) {
      ui.focusInput();
      ui.showSettingsNotification(`Switched to ${getProviderLabelById(providerId)}.`, 'success');
    } else {
      ui.showSettingsNotification(`Switched to ${getProviderLabelById(providerId)}. Please enter an API key.`, 'info');
      // Keep settings open so user can enter the API key
    }

    if (state.settings.showDebugPanel) {
      updateDebugPanel();
    }
  }

  function handleModelChange(modelId) {
    const providerId = state.settings.provider;
    const models = getProviderModels(providerId);
    if (!models.length) {
      return;
    }
    const match = models.find(model => model.value === modelId);
    if (!match) {
      syncModelDropdown();
      ui.showSettingsNotification('Selected model is not available for this provider.', 'warning');
      return;
    }
    if (state.settings.providerModels[providerId] === modelId) {
      return;
    }
    state.settings.providerModels[providerId] = modelId;
    persistSettings({ providerModels: { ...state.settings.providerModels } });
    syncModelDropdown();
    ui.showSettingsNotification(`Model switched to ${match.label || modelId}.`, 'success');
    if (state.settings.showDebugPanel) {
      updateDebugPanel();
    }
  }

  function handleSettingsSave({ provider, apiKey, prompts, showDebugPanel }) {
    let providerId = SUPPORTED_PROVIDER_IDS.includes(provider) ? provider : state.settings.provider;
    if (!SUPPORTED_PROVIDER_IDS.includes(providerId)) {
      providerId = DEFAULT_PROVIDER_ID;
    }
    state.settings.provider = providerId;

    if (typeof apiKey === 'string') {
      setEncryptedApiKey(state.settings, providerId, apiKey);
    }

    ensureProviderModel(state.settings, providerId);

    if (prompts && typeof prompts === 'object') {
      let changed = false;
      MODE_LIST.forEach(modeKey => {
        const current = state.prompts[modeKey];
        const incoming = prompts[modeKey];
        if (!incoming || typeof incoming !== 'object') {
          return;
        }
        if (typeof incoming.name === 'string') {
          const trimmedName = incoming.name.trim();
          if (trimmedName && trimmedName !== current.name) {
            state.prompts[modeKey] = {
              ...state.prompts[modeKey],
              name: trimmedName
            };
            changed = true;
          }
        }
        if (typeof incoming.content === 'string') {
          const trimmedContent = incoming.content.trim();
          if (trimmedContent && trimmedContent !== current.content) {
            state.prompts[modeKey] = {
              ...state.prompts[modeKey],
              content: trimmedContent
            };
            changed = true;
          }
        }
      });
      if (changed) {
        savePrompts(state.prompts);
        ui.setPrompts(state.prompts);
      }
    }

    if (typeof showDebugPanel === 'boolean') {
      state.settings.showDebugPanel = showDebugPanel;
      ui.setDebugVisibility(showDebugPanel);
    }

    saveSettings(state.settings);

    // Check if we have a valid API key for the selected provider
    const currentApiKey = getPlainApiKey(state.settings, providerId);
    if (currentApiKey && currentApiKey.trim()) {
      ui.showSettingsNotification('Settings saved.', 'success');
      ui.focusInput(); // Close settings and focus main input
    } else {
      ui.showSettingsNotification('Settings saved. Please enter an API key to start chatting.', 'info');
      // Keep settings open so user can enter API key
    }

    ui.setSettings({
      provider: state.settings.provider,
      apiKeys: createPlainApiKeyMap(state.settings),
      showDebugPanel: state.settings.showDebugPanel
    });
    syncModelDropdown();
    if (state.settings.showDebugPanel) {
      updateDebugPanel();
    }
  }

  function handleSettingsClose() {
    ui.hideBanner();
    ui.hideSettingsNotification();
  }

  function handleClearApiKey(providerId = state.settings.provider) {
    let targetProvider = SUPPORTED_PROVIDER_IDS.includes(providerId) ? providerId : state.settings.provider;
    if (!SUPPORTED_PROVIDER_IDS.includes(targetProvider)) {
      targetProvider = DEFAULT_PROVIDER_ID;
    }
    setEncryptedApiKey(state.settings, targetProvider, '');
    saveSettings(state.settings);
    ui.setSettings({
      provider: state.settings.provider,
      apiKeys: createPlainApiKeyMap(state.settings),
      showDebugPanel: state.settings.showDebugPanel
    });
    syncModelDropdown();
    const label = getProviderLabelById(targetProvider);
    ui.showSettingsNotification(`${label} API key cleared.`, 'info');
  }

  function handleSidebarWidthChange(name, width) {
    if (!SIDEBAR_NAMES.includes(name)) {
      return;
    }
    const nextSidebarWidths = {
      ...(state.settings.sidebarWidths && typeof state.settings.sidebarWidths === 'object'
        ? state.settings.sidebarWidths
        : {})
    };
    const numericWidth = Number(width);
    let changed = false;
    if (Number.isFinite(numericWidth) && numericWidth > 0) {
      const rounded = Math.round(numericWidth);
      if (nextSidebarWidths[name] !== rounded) {
        nextSidebarWidths[name] = rounded;
        changed = true;
      }
    } else if (Object.prototype.hasOwnProperty.call(nextSidebarWidths, name)) {
      delete nextSidebarWidths[name];
      changed = true;
    }
    if (!changed) {
      return;
    }
    persistSettings({ sidebarWidths: nextSidebarWidths });
  }

  function handlePromptReset(mode) {
    const normalized = sanitizeMode(mode);
    if (!normalized) return;
    const defaults = ensurePrompts(DEFAULT_PROMPTS);
    state.prompts[normalized] = { ...defaults[normalized] };
    savePrompts(state.prompts);
    ui.setPrompts(state.prompts);
    ui.showSettingsNotification(`${MODE_DEFS[normalized].label} prompt reset to default.`, 'info');
    if (state.settings.showDebugPanel) {
      updateDebugPanel();
    }
  }

  function handleToggleDebug(show) {
    const next = Boolean(show);
    if (state.settings.showDebugPanel === next) {
      return;
    }
    state.settings.showDebugPanel = next;
    persistSettings({ showDebugPanel: next });
    ui.setDebugVisibility(next);
    if (next) {
      updateDebugPanel();
    }
  }

  function syncModelDropdown() {
    const providerId = state.settings.provider;
    const models = getProviderModels(providerId);
    const activeModel = ensureProviderModel(state.settings, providerId);
    ui.setModels(providerId, models, activeModel);
  }

  function ensureActiveConversation() {
    let conversation = findConversation(state, state.activeConversationId);
    if (conversation && conversation.mode === state.activeMode) {
      return conversation;
    }
    conversation = ensureConversationForMode(state, state.activeMode, { createIfMissing: true });
    state.activeConversationId = conversation ? conversation.id : null;
    persistSettings({
      lastConversationIds: {
        ...state.settings.lastConversationIds,
        [state.activeMode]: conversation ? conversation.id : null
      }
    });
    refreshConversationList();
    return conversation;
  }

  function refreshConversationList() {
    state.conversations.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const summaries = mapConversationSummaries(state.conversations, state.activeMode);
    ui.setConversations(summaries, state.activeConversationId);
    ui.setMode(state.activeMode, MODE_DEFS[state.activeMode]);
  }

  function persistConversations() {
    saveConversations(state.conversations);
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
    if (!ui || !state.settings.showDebugPanel) {
      state.debug = null;
      return;
    }
    const providerId = state.settings.provider;
    const modelId = ensureProviderModel(state.settings, providerId);
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
      ragTitles: state.lastRagResults.map(entry => entry.document?.title).filter(Boolean).join(', '),
      ...extra
    };
    state.debug = debugData;
    ui.setDebugData(debugData);
  }
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
  const encrypted = settings.apiKeys && typeof settings.apiKeys === 'object' ? settings.apiKeys[providerId] : '';
  return revealKey(typeof encrypted === 'string' ? encrypted : '');
}

function setEncryptedApiKey(settings, providerId, plainKey) {
  if (!settings || typeof settings !== 'object') {
    return;
  }
  if (!settings.apiKeys || typeof settings.apiKeys !== 'object') {
    settings.apiKeys = {};
  }
  const trimmed = typeof plainKey === 'string' ? plainKey.trim() : '';
  settings.apiKeys[providerId] = trimmed ? obfuscateKey(trimmed) : '';
}

function buildReferences(results = []) {
  if (!Array.isArray(results) || !results.length) return [];
  return results.map(entry => ({
    title: entry.document?.title || 'Reference',
    snippet: (entry.document?.content || '').split('\n').find(Boolean) || ''
  }));
}

function buildConversationReferences(messages = []) {
  if (!Array.isArray(messages) || !messages.length) return [];
  const trimmed = messages.filter(msg => msg.role !== 'system' && msg.content);
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
  if (error.type === 'API_HTTP_ERROR') {
    return `Provider returned status ${error.details?.status || 'unknown'}. Check the logs for details.`;
  }
  return error.message || 'Unexpected error while contacting the provider.';
}

function sanitizeMode(mode) {
  return mode === MODE_GENERAL ? MODE_GENERAL : MODE_PACKAGE;
}
