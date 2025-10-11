import { createChatbotUI } from './chatbot-ui.js';
import { ChatbotApiManager } from './chatbot-api.js';
import { ChatbotContextProcessor } from './chatbot-context.js';
import { ChatbotRagEngine } from './chatbot-rag.js';
import {
  loadPrompts,
  savePrompts,
  resetPrompts,
  loadSettings,
  saveSettings,
  loadConversations,
  saveConversations,
  createConversation,
  generateMessageId,
  obfuscateKey,
  revealKey,
  mergePrompts,
  sanitizePrompt,
  DEFAULT_PROMPTS,
  DEFAULT_SETTINGS
} from './chatbot-storage.js';

const STATUS_READY = 'ready';
const STATUS_THINKING = 'thinking';
const STATUS_ERROR = 'error';

export function initializeChatbot() {
  const container = document.querySelector('[data-chatbot-container]');
  if (!container) {
    return;
  }

  const apiManager = new ChatbotApiManager();
  const contextProcessor = new ChatbotContextProcessor();
  const ragEngine = new ChatbotRagEngine();

  const state = {
    prompts: mergePrompts(loadPrompts()),
    settings: ensureSettings(loadSettings()),
    conversations: loadConversations(),
    activeConversationId: null,
    statusTimeoutId: null,
    contextSnapshot: null,
    sending: false
  };

  if (!state.conversations.length) {
    const conversation = createConversation({ promptId: state.settings.activePromptId });
    state.conversations.push(conversation);
  }

  if (!state.settings.activePromptId) {
    state.settings.activePromptId = DEFAULT_PROMPTS[0]?.id || DEFAULT_SETTINGS.activePromptId;
  }

  const activeConversation =
    findConversation(state, state.settings.lastConversationId) || state.conversations[0];
  state.activeConversationId = activeConversation?.id || state.conversations[0]?.id;

  const ui = createChatbotUI({
    container,
    onSend: handleSend,
    onNewConversation: handleNewConversation,
    onSelectConversation: handleSelectConversation,
    onExport: handleExportConversation,
    onPromptChange: handlePromptChange,
    onPromptEditorSelect: handlePromptEditorSelect,
    onPromptSave: handlePromptSave,
    onPromptUpdate: handlePromptUpdate,
    onPromptReset: handlePromptReset,
    onSettingsSave: handleSettingsSave,
    onSettingsClose: handleSettingsClose,
    onClearApiKey: handleClearApiKey
  });

  ui.setPrompts(state.prompts, state.settings.activePromptId);
  ui.setSettings({
    provider: state.settings.provider,
    apiKey: revealKey(state.settings.apiKey),
    activePromptId: state.settings.activePromptId
  });

  const promptForEditor = findPrompt(state.prompts, state.settings.activePromptId);
  if (promptForEditor) {
    ui.setSettingsPrompt(promptForEditor.id, promptForEditor);
  }

  ui.setConversations(mapConversationSummaries(state.conversations), state.activeConversationId);
  const activeMessages = findConversation(state, state.activeConversationId)?.messages || [];
  ui.setMessages(activeMessages);
  contextProcessor.onUpdate('snapshot', snapshot => {
    state.contextSnapshot = snapshot;
    ragEngine.ingest(snapshot);
  });
  contextProcessor.start();

  function handleSend(text) {
    if (state.sending) {
      ui.showBanner('Please wait for the current response to finish.', 'warning');
      return;
    }

    const apiKeyPlain = revealKey(state.settings.apiKey);
    if (!apiKeyPlain) {
      ui.showBanner('Add an API key in Settings before sending messages.', 'warning');
      return;
    }

    const conversation = ensureActiveConversation();
    if (!conversation) return;

    const prompt = findPrompt(state.prompts, conversation.promptId) || DEFAULT_PROMPTS[0];

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

    const snapshot = state.contextSnapshot || contextProcessor.getSnapshot();
    ragEngine.ingest(snapshot);
    const ragResults = ragEngine.search(text);

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

    apiManager
      .sendMessage({
        messages: historyMessages,
        prompt,
        provider: state.settings.provider,
        apiKey: apiKeyPlain,
        context: snapshot,
        ragResults,
        onToken: chunk => {
          assistantMessage.content = chunk;
          ui.updateMessage(assistantMessage.id, { content: chunk, streaming: true });
        }
      })
      .then(result => {
        assistantMessage.content = result.text || assistantMessage.content;
        assistantMessage.references = buildReferences(result.ragResults || ragResults);
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
        persistSettings({ lastConversationId: conversation.id });
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
      });
  }

  function handleNewConversation() {
    const conversation = createConversation({ promptId: state.settings.activePromptId });
    state.conversations.unshift(conversation);
    state.activeConversationId = conversation.id;
    ui.setMessages(conversation.messages);
    refreshConversationList();
    persistConversations();
    persistSettings({ lastConversationId: conversation.id });
    ui.focusInput();
  }

  function handleSelectConversation(conversationId) {
    const conversation = findConversation(state, conversationId);
    if (!conversation) return;
    state.activeConversationId = conversation.id;
    ensureConversationPrompt(conversation);
    ui.setMessages(conversation.messages);
    ui.setConversations(mapConversationSummaries(state.conversations), state.activeConversationId);
    if (conversation.promptId && state.settings.activePromptId !== conversation.promptId) {
      state.settings.activePromptId = conversation.promptId;
      const prompt = findPrompt(state.prompts, conversation.promptId);
      ui.setPrompts(state.prompts, conversation.promptId);
      if (prompt) {
        ui.setSettingsPrompt(prompt.id, prompt);
      }
      persistSettings({ activePromptId: state.settings.activePromptId, lastConversationId: conversation.id });
    } else {
      persistSettings({ lastConversationId: conversation.id });
    }
    ui.focusInput();
  }

  function handleExportConversation() {
    const conversation = findConversation(state, state.activeConversationId);
    if (!conversation) return;
    const prompt = findPrompt(state.prompts, conversation.promptId);
    const payload = {
      id: conversation.id,
      title: conversation.title,
      prompt: prompt ? { id: prompt.id, name: prompt.name } : null,
      provider: state.settings.provider,
      messages: conversation.messages.map(message => ({
        role: message.role,
        content: message.content,
        references: message.references || []
      }))
    };
    console.log('[SolidCAM Chatbot Export]', payload);
    ui.showBanner('Conversation exported to console.', 'info');
    setTimeout(() => ui.hideBanner(), 2500);
  }

  function handlePromptChange(promptId) {
    const prompt = findPrompt(state.prompts, promptId);
    if (!prompt) return;
    state.settings.activePromptId = prompt.id;
    const conversation = ensureActiveConversation();
    if (conversation) {
      conversation.promptId = prompt.id;
      persistConversations();
    }
    persistSettings({ activePromptId: prompt.id });
    ui.setSettingsPrompt(prompt.id, prompt);
  }

  function handlePromptEditorSelect(promptId) {
    const prompt = findPrompt(state.prompts, promptId);
    if (!prompt) return;
    ui.setSettingsPrompt(prompt.id, prompt);
  }

  function handlePromptSave({ name, content }) {
    const id = generateMessageId('prompt');
    const prompt = sanitizePrompt({
      id,
      name: name || `Custom Prompt`,
      content,
      readOnly: false,
      updatedAt: Date.now()
    });
    state.prompts.push(prompt);
    savePrompts(state.prompts);
    state.settings.activePromptId = prompt.id;
    const conversation = ensureActiveConversation();
    if (conversation) {
      conversation.promptId = prompt.id;
      persistConversations();
    }
    persistSettings({ activePromptId: prompt.id });
    ui.setPrompts(state.prompts, prompt.id);
    ui.setSettingsPrompt(prompt.id, prompt);
    ui.showBanner('Prompt saved.', 'success');
    setTimeout(() => ui.hideBanner(), 2500);
  }

  function handlePromptUpdate({ id, name, content }) {
    const prompt = findPrompt(state.prompts, id);
    if (!prompt) return;
    if (prompt.readOnly) {
      ui.showBanner('Default prompts are read-only. Use Save As to create a copy.', 'warning');
      return;
    }
    prompt.name = name || prompt.name;
    prompt.content = content || prompt.content;
    prompt.updatedAt = Date.now();
    savePrompts(state.prompts);
    ui.setPrompts(state.prompts, state.settings.activePromptId);
    ui.setSettingsPrompt(prompt.id, prompt);
    ui.showBanner('Prompt updated.', 'success');
    setTimeout(() => ui.hideBanner(), 2500);
  }

  function handlePromptReset() {
    if (!window.confirm('Reset prompt library to defaults? Your custom prompts will be removed.')) {
      return;
    }
    resetPrompts();
    state.prompts = mergePrompts(loadPrompts());
    state.settings.activePromptId = DEFAULT_PROMPTS[0]?.id || DEFAULT_SETTINGS.activePromptId;
    persistSettings({ activePromptId: state.settings.activePromptId });
    const conversation = ensureActiveConversation();
    if (conversation) {
      conversation.promptId = state.settings.activePromptId;
      persistConversations();
      ui.setMessages(conversation.messages);
    }
    ui.setPrompts(state.prompts, state.settings.activePromptId);
    const prompt = findPrompt(state.prompts, state.settings.activePromptId);
    if (prompt) {
      ui.setSettingsPrompt(prompt.id, prompt);
    }
    ui.showBanner('Prompt library reset.', 'info');
    setTimeout(() => ui.hideBanner(), 2500);
  }

  function handleSettingsSave({ provider, apiKey, activePromptId }) {
    if (provider) {
      state.settings.provider = provider;
    }
    if (typeof apiKey === 'string') {
      state.settings.apiKey = obfuscateKey(apiKey);
    }
    if (activePromptId && findPrompt(state.prompts, activePromptId)) {
      state.settings.activePromptId = activePromptId;
      const conversation = ensureActiveConversation();
      if (conversation) {
        conversation.promptId = activePromptId;
        persistConversations();
      }
    }
    saveSettings(state.settings);
    ui.showBanner('Settings saved.', 'success');
    setTimeout(() => ui.hideBanner(), 2000);
    ui.setSettings({
      provider: state.settings.provider,
      apiKey: revealKey(state.settings.apiKey),
      activePromptId: state.settings.activePromptId
    });
  }

  function handleSettingsClose() {
    ui.hideBanner();
  }

  function handleClearApiKey() {
    state.settings.apiKey = '';
    saveSettings(state.settings);
    ui.showBanner('API key cleared.', 'info');
    setTimeout(() => ui.hideBanner(), 1500);
  }

  function ensureActiveConversation() {
    const conversation = findConversation(state, state.activeConversationId);
    if (conversation) return conversation;
    if (!state.conversations.length) {
      const created = createConversation({ promptId: state.settings.activePromptId });
      state.conversations.push(created);
      state.activeConversationId = created.id;
      refreshConversationList();
      persistConversations();
      return created;
    }
    state.activeConversationId = state.conversations[0].id;
    return state.conversations[0];
  }

  function refreshConversationList() {
    state.conversations.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    ui.setConversations(mapConversationSummaries(state.conversations), state.activeConversationId);
  }

  function persistConversations() {
    saveConversations(state.conversations);
  }

  function persistSettings(partial) {
    if (partial && typeof partial === 'object') {
      state.settings = {
        ...state.settings,
        ...partial
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

  function ensureConversationPrompt(conversation) {
    if (!conversation.promptId) {
      conversation.promptId = state.settings.activePromptId;
      persistConversations();
    }
  }
}

function mapConversationSummaries(conversations) {
  return conversations.map(conversation => ({
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

function findPrompt(prompts, id) {
  if (!id) return null;
  return prompts.find(prompt => prompt.id === id) || null;
}

function ensureSettings(settings) {
  const merged = {
    ...DEFAULT_SETTINGS,
    ...(settings && typeof settings === 'object' ? settings : {})
  };
  if (!merged.provider) {
    merged.provider = DEFAULT_SETTINGS.provider;
  }
  return merged;
}

function buildReferences(results = []) {
  if (!Array.isArray(results)) return [];
  return results.map(entry => ({
    title: entry.document?.title || 'Reference',
    snippet: (entry.document?.content || '').split('\n').find(Boolean) || ''
  }));
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
