import {
  MAX_EFFECTIVE_MESSAGES,
  MIN_REQUIRED_MESSAGE_CAPACITY,
  MODE_DEFS,
  MODE_LIST,
  MODE_PACKAGE,
  STATUS_ERROR,
  STATUS_READY,
  STATUS_THINKING,
  sanitizeMode
} from './chatbot-constants.js';

export function createChatbotEventHandlers({
  state,
  ui,
  apiManager,
  contextProcessor,
  ragEngine,
  modeManager,
  conversationManager,
  stateManager,
  messageArchive,
  helpers
}) {
  const getSettings = helpers.getSettings;
  const updateSettingsSafe = helpers.updateSettingsSafe;
  const setSending = helpers.setSending;
  const setLastRagResults = helpers.setLastRagResults;
  const getLastRagResults = helpers.getLastRagResults;
  const refreshConversationList = helpers.refreshConversationList;
  const persistConversations = helpers.persistConversations;
  const ensureConversationForMode = helpers.ensureConversationForMode;
  const ensureConversationTitle = helpers.ensureConversationTitle;
  const findConversation = helpers.findConversation;
  const createConversation = helpers.createConversation;
  const generateMessageId = helpers.generateMessageId;
  const buildConversationReferences = helpers.buildConversationReferences;
  const buildReferences = helpers.buildReferences;
  const friendlyErrorMessage = helpers.friendlyErrorMessage;
  const getPromptForMode = helpers.getPromptForMode;
  const createPlainApiKeyMap = helpers.createPlainApiKeyMap;
  const ensureProviderModel = helpers.ensureProviderModel;
  const getProviderModels = helpers.getProviderModels;
  const getProviderLabelById = helpers.getProviderLabelById;
  const setEncryptedApiKey = helpers.setEncryptedApiKey;
  const getPlainApiKey = helpers.getPlainApiKey;
  const ensurePrompts = helpers.ensurePrompts;
  const defaultPrompts = helpers.DEFAULT_PROMPTS;
  const delayStatusReset = helpers.delayStatusReset;
  const logProviderRun = helpers.logProviderRun;
  const updateDebugPanel = helpers.updateDebugPanel;
  const copyToClipboard = helpers.copyToClipboard;
  const saveSettings = helpers.saveSettings;
  const savePrompts = helpers.savePrompts;
  const syncModelDropdown = helpers.syncModelDropdown;
  const isSupportedProvider = helpers.isSupportedProvider;
  const getDefaultProviderId = helpers.getDefaultProviderId;
  const isSidebarName = helpers.isSidebarName;

  function isSending() {
    return stateManager
      ? stateManager.sending
      : state.sending;
  }

  function ensureActiveConversation(mode = state.activeMode) {
    if (conversationManager) {
      return conversationManager.ensureActiveConversation(mode);
    }
    let conversation = findConversation(state, state.activeConversationId);
    if (conversation && conversation.mode === state.activeMode) {
      return conversation;
    }
    conversation = ensureConversationForMode(state, mode, { createIfMissing: true });
    state.activeConversationId = conversation ? conversation.id : null;
    updateSettingsSafe({
      lastConversationIds: {
        ...getSettings().lastConversationIds,
        [state.activeMode]: conversation ? conversation.id : null
      }
    });
    refreshConversationList();
    return conversation;
  }

  function computeCapacity(conversation) {
    if (conversationManager) {
      return conversationManager.computeCapacity(conversation);
    }
    const effectiveCount = messageArchive.getEffectiveCount(
      conversation.id,
      conversation.messages
    );
    const remainingCapacity = MAX_EFFECTIVE_MESSAGES - effectiveCount;
    return {
      hasCapacity: remainingCapacity >= MIN_REQUIRED_MESSAGE_CAPACITY,
      effectiveCount,
      remainingCapacity,
      maxMessages: MAX_EFFECTIVE_MESSAGES
    };
  }

  async function appendMessage(conversation, message, options = {}) {
    if (conversationManager) {
      return conversationManager.appendMessage(conversation, message, options);
    }
    const activeMessages = Array.isArray(conversation.messages)
      ? conversation.messages
      : [];
    try {
      conversation.messages = await messageArchive.addMessage(
        conversation.id,
        message,
        activeMessages
      );
    } catch (error) {
      console.warn('[Chatbot] Failed to archive message. Falling back to in-memory only.', error);
      conversation.messages = [...activeMessages, message];
    }
    if (options.updateTimestamp !== false) {
      conversation.updatedAt = Date.now();
    }
    if (options.ensureTitle) {
      ensureConversationTitle?.(conversation);
    }
    if (options.persist !== false) {
      persistConversations();
    }
    if (options.refresh !== false) {
      refreshConversationList();
    }
    return message;
  }

  function createMessage(role, content = '', overrides = {}) {
    if (conversationManager) {
      return conversationManager.createMessage(role, content, overrides);
    }
    return {
      id: generateMessageId(role),
      role,
      content,
      createdAt: Date.now(),
      references: [],
      ...overrides
    };
  }

  async function handleSend(text) {
    if (isSending()) {
      ui.showBanner('Please wait for the current response to finish.', 'warning');
      return;
    }

    const settings = getSettings();
    const providerId = settings.provider;
    const providerLabel = getProviderLabelById(providerId);
    const modelId = ensureProviderModel(settings, providerId);
    const apiKeyPlain = getPlainApiKey(settings, providerId);

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

    const capacityInfo = computeCapacity(conversation);
    if (!capacityInfo.hasCapacity) {
      ui.showBanner('Conversation is too long. Start a new one to continue.', 'warning');
      console.warn(
        `[Chatbot] Max active messages (${capacityInfo.maxMessages}) reached for conversation ${conversation.id}`
      );
      return;
    }

    const prompt = getPromptForMode(state.prompts, state.activeMode);
    const previousUpdatedAt = conversation.updatedAt;

    const userMessage = createMessage('user', text);
    await appendMessage(conversation, userMessage, {
      persist: true,
      refresh: true,
      updateTimestamp: true
    });

    const capacityAfterUser = computeCapacity(conversation);
    if (!capacityAfterUser.hasCapacity) {
      ui.showBanner('Conversation limit reached. Unable to continue this chat.', 'warning');
      console.warn(
        `[Chatbot] Max active messages reached after enqueuing user message for conversation ${conversation.id}`
      );
      conversation.messages = conversation.messages.filter(msg => msg.id !== userMessage.id);
      conversation.updatedAt = previousUpdatedAt;
      refreshConversationList();
      return;
    }

    ui.appendMessage(userMessage);
    ui.clearInput();
    if (!(conversationManager)) {
      persistConversations();
      refreshConversationList();
    }

    const historyMessages = conversation.messages
      .filter(message => message.role !== 'system' || message.content)
      .map(({ role, content }) => ({ role, content }));

    let context = null;
    let ragResults = [];
    let shouldDisplayReferences = conversation.mode === MODE_PACKAGE;

    if (modeManager) {
      const contextData = await modeManager.buildContextForSend({
        mode: state.activeMode,
        text,
        conversation,
        fallbackSnapshot: state.contextSnapshot
      });
      context = contextData.context || null;
      ragResults = Array.isArray(contextData.ragResults) ? contextData.ragResults : [];
      shouldDisplayReferences = Boolean(contextData.shouldDisplayReferences);
      if (state.activeMode === MODE_PACKAGE) {
        state.contextSnapshot = context || modeManager.getSnapshot() || null;
      } else {
        state.contextSnapshot = null;
      }
    } else if (state.activeMode === MODE_PACKAGE) {
      const snapshot = state.contextSnapshot || contextProcessor.getSnapshot();
      context = snapshot;
      ragEngine.ingest(snapshot);
      ragResults = ragEngine.search(text);
    } else {
      context = null;
      ragResults = await buildConversationReferences(conversation.id, conversation.messages);
    }

    setLastRagResults(ragResults);

    const assistantMessage = createMessage('assistant', '', { references: [] });
    await appendMessage(conversation, assistantMessage, {
      persist: false,
      refresh: false,
      updateTimestamp: false
    });
    ui.appendMessage(assistantMessage);

    setSending(true);
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
        const displayReferences = shouldDisplayReferences ? buildReferences(rawReferences) : [];
        setLastRagResults(rawReferences);

        if (conversationManager) {
          conversationManager.updateMessage(conversation, assistantMessage.id, {
            content: assistantMessage.content,
            references: displayReferences,
            error: false
          });
        } else {
          conversation.updatedAt = Date.now();
          ensureConversationTitle?.(conversation);
          persistConversations();
          refreshConversationList();
        }

        assistantMessage.references = displayReferences;

        ui.updateMessage(assistantMessage.id, {
          content: assistantMessage.content,
          references: assistantMessage.references,
          streaming: false,
          error: false
        });

        setSending(false);
        ui.setStreaming(false);
        ui.setStatus(STATUS_READY);
        ui.focusInput();

        updateSettingsSafe({
          lastConversationIds: {
            ...getSettings().lastConversationIds,
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

        if (conversationManager) {
          conversationManager.updateMessage(conversation, assistantMessage.id, {
            content: assistantMessage.content,
            error: true
          });
        } else {
          conversation.updatedAt = Date.now();
          persistConversations();
          refreshConversationList();
        }

        ui.updateMessage(assistantMessage.id, {
          content: assistantMessage.content,
          streaming: false,
          error: true
        });

        setSending(false);
        ui.setStreaming(false);
        ui.setStatus(STATUS_ERROR);
        delayStatusReset();
        ui.showBanner(message, 'error');

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
    let conversation;
    if (conversationManager) {
      conversation = conversationManager.createNewConversation(state.activeMode);
    } else {
      conversation = createConversation({ mode: state.activeMode });
      state.conversations.unshift(conversation);
      state.activeConversationId = conversation.id;
      persistConversations();
      refreshConversationList();
      updateSettingsSafe({
        lastConversationIds: {
          ...getSettings().lastConversationIds,
          [state.activeMode]: conversation.id
        }
      });
    }
    if (!conversation) {
      return;
    }
    ui.setMessages(conversation.messages);
    ui.focusInput();
    if (getSettings().showDebugPanel) {
      updateDebugPanel();
    }
  }

  function handleSelectConversation(conversationId) {
    if (!conversationId) return;
    if (conversationManager) {
      const conversation = conversationManager.findConversation(conversationId);
      if (!conversation) return;
      if (conversation.mode !== state.activeMode) {
        handleModeChange(conversation.mode, { conversationId });
        return;
      }
      conversationManager.selectConversation(conversation.id);
      ui.setMessages(conversation.messages);
      ui.focusInput();
      if (getSettings().showDebugPanel) {
        updateDebugPanel();
      }
      return;
    }

    const conversation = findConversation(state, conversationId);
    if (!conversation) return;
    if (conversation.mode !== state.activeMode) {
      handleModeChange(conversation.mode, { conversationId });
      return;
    }
    state.activeConversationId = conversation.id;
    updateSettingsSafe({
      lastConversationIds: {
        ...getSettings().lastConversationIds,
        [state.activeMode]: conversation.id
      }
    });
    ui.setMessages(conversation.messages);
    refreshConversationList();
    ui.focusInput();
    if (getSettings().showDebugPanel) {
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

    const settings = getSettings();
    const lines = [];
    const modeMeta = MODE_DEFS[conversation.mode] || null;
    if (modeMeta) {
      lines.push(`${modeMeta.label}`);
    }
    lines.push(`Provider: ${getProviderLabelById(settings.provider)}`);
    lines.push(`Model: ${ensureProviderModel(settings, settings.provider)}`);

    conversation.messages.forEach(message => {
      const role =
        message.role === 'user'
          ? 'You'
          : message.role === 'assistant'
          ? 'Assistant'
          : message.role || 'System';
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

    const previousMode = state.activeMode;
    if (modeManager) {
      const activation = modeManager.activate(nextMode);
      state.contextSnapshot = activation.snapshot || null;
    } else if (previousMode === MODE_PACKAGE) {
      contextProcessor.stop();
    }

    state.activeMode = nextMode;
    updateSettingsSafe({ activeMode: nextMode });

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

    if (modeManager) {
      if (nextMode !== MODE_PACKAGE) {
        state.contextSnapshot = null;
      }
    } else if (nextMode === MODE_PACKAGE) {
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
    if (getSettings().showDebugPanel) {
      updateDebugPanel();
    }
  }

  function handleProviderChange(providerId) {
    if (!isSupportedProvider(providerId)) {
      ui.showSettingsNotification('Unsupported provider selected.', 'warning');
      return;
    }
    const settings = getSettings();
    const previousProvider = settings.provider;
    settings.provider = providerId;
    ensureProviderModel(settings, providerId);
    if (previousProvider !== providerId) {
      updateSettingsSafe({
        provider: providerId,
        providerModels: { ...settings.providerModels }
      });
    }
    ui.setSettings({
      provider: settings.provider,
      apiKeys: createPlainApiKeyMap(settings),
      showDebugPanel: settings.showDebugPanel
    });
    syncModelDropdown();

    const apiKey = getPlainApiKey(settings, providerId);
    if (apiKey && apiKey.trim()) {
      ui.focusInput();
      ui.showSettingsNotification(`Switched to ${getProviderLabelById(providerId)}.`, 'success');
    } else {
      ui.showSettingsNotification(
        `Switched to ${getProviderLabelById(providerId)}. Please enter an API key.`,
        'info'
      );
    }

    if (settings.showDebugPanel) {
      updateDebugPanel();
    }
  }

  function handleModelChange(modelId) {
    const settings = getSettings();
    const providerId = settings.provider;
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
    if (settings.providerModels[providerId] === modelId) {
      return;
    }
    settings.providerModels[providerId] = modelId;
    updateSettingsSafe({ providerModels: { ...settings.providerModels } });
    syncModelDropdown();
    ui.showSettingsNotification(`Model switched to ${match.label || modelId}.`, 'success');
    if (settings.showDebugPanel) {
      updateDebugPanel();
    }
  }

  function handleSettingsSave({ provider, apiKey, targetProvider, prompts, showDebugPanel }) {
    const settings = getSettings();
    let providerId = settings.provider;
    if (provider && isSupportedProvider(provider)) {
      if (provider !== settings.provider) {
        settings.provider = provider;
      }
      providerId = provider;
    } else if (!isSupportedProvider(providerId)) {
      providerId = getDefaultProviderId();
      settings.provider = providerId;
    }

    const apiTargetId = isSupportedProvider(targetProvider) ? targetProvider : providerId;

    if (typeof apiKey === 'string') {
      if (stateManager) {
        stateManager.setApiKey(apiTargetId, apiKey, setEncryptedApiKey);
      } else {
        setEncryptedApiKey(settings, apiTargetId, apiKey);
        saveSettings(settings);
      }
    }

    ensureProviderModel(settings, providerId);

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
        if (stateManager) {
          stateManager.prompts = { ...state.prompts };
        } else {
        savePrompts(state.prompts);
        }
        ui.setPrompts(state.prompts);
      }
    }

    if (typeof showDebugPanel === 'boolean') {
      if (stateManager) {
        stateManager.setDebugPanel(showDebugPanel);
      } else {
        settings.showDebugPanel = showDebugPanel;
        saveSettings(settings);
      }
      ui.setDebugVisibility(showDebugPanel);
    }

    if (!(stateManager)) {
      saveSettings(settings);
    } else {
      stateManager.updateSettings({
        provider: settings.provider,
        providerModels: settings.providerModels,
        showDebugPanel: settings.showDebugPanel
      });
    }

    ui.setSettings({
      provider: settings.provider,
      apiKeys: createPlainApiKeyMap(settings),
      showDebugPanel: settings.showDebugPanel
    });
    syncModelDropdown();
    if (settings.showDebugPanel) {
      updateDebugPanel();
    }
  }

  function handleSettingsClose() {
    ui.hideBanner();
    ui.hideSettingsNotification();
  }

  function handleClearApiKey(providerId = getSettings().provider) {
    const settings = getSettings();
    let targetProvider = isSupportedProvider(providerId) ? providerId : settings.provider;
    if (!isSupportedProvider(targetProvider)) {
      targetProvider = getDefaultProviderId();
    }
    if (stateManager) {
      stateManager.setApiKey(targetProvider, '', setEncryptedApiKey);
    } else {
      setEncryptedApiKey(settings, targetProvider, '');
      saveSettings(settings);
    }
    ui.setSettings({
      provider: settings.provider,
      apiKeys: createPlainApiKeyMap(settings),
      showDebugPanel: settings.showDebugPanel
    });
    syncModelDropdown();
    const label = getProviderLabelById(targetProvider);
    ui.showSettingsNotification(`${label} API key cleared.`, 'info');
  }

  function handleSidebarWidthChange(name, width) {
    if (!isSidebarName(name)) {
      return;
    }
    if (stateManager) {
      stateManager.setSidebarWidth(name, width);
      ui.setSidebarWidths(stateManager.settings.sidebarWidths);
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
    updateSettingsSafe({ sidebarWidths: nextSidebarWidths });
    ui.setSidebarWidths(nextSidebarWidths);
  }

  function handlePromptReset(mode) {
    const normalized = sanitizeMode(mode);
    if (!normalized) return;
    const defaults = ensurePrompts(defaultPrompts);
    state.prompts[normalized] = { ...defaults[normalized] };
    if (stateManager) {
      stateManager.prompts = { ...state.prompts };
    } else {
      savePrompts(state.prompts);
    }
    ui.setPrompts(state.prompts);
    ui.showSettingsNotification(`${MODE_DEFS[normalized].label} prompt reset to default.`, 'info');
    if (getSettings().showDebugPanel) {
      updateDebugPanel();
    }
  }

  function handleToggleDebug(show) {
    const next = Boolean(show);
    const settings = getSettings();
    if (settings.showDebugPanel === next) {
      return;
    }
    if (stateManager) {
      stateManager.setDebugPanel(next);
    } else {
      settings.showDebugPanel = next;
      updateSettingsSafe({ showDebugPanel: next });
    }
    ui.setDebugVisibility(next);
    if (next) {
      updateDebugPanel();
    }
  }

  return {
    handleSend,
    handleNewConversation,
    handleSelectConversation,
    handleCopyConversation,
    handleModeChange,
    handleProviderChange,
    handleModelChange,
    handleSettingsSave,
    handleSettingsClose,
    handleClearApiKey,
    handleSidebarWidthChange,
    handlePromptReset,
    handleToggleDebug
  };
}
