const FLYOUT_NAMES = ['conversations', 'settings'];

const DEFAULT_MESSAGE_META = {
  user: 'You',
  assistant: 'Assistant',
  system: 'System'
};

export function createChatbotUI(options = {}) {
  const ui = new ChatbotUI(options);
  return ui.init();
}

class ChatbotUI {
  constructor(options) {
    this.container = options.container;
    this.callbacks = {
      onSend: options.onSend || (() => {}),
      onNewConversation: options.onNewConversation || (() => {}),
      onSelectConversation: options.onSelectConversation || (() => {}),
      onExport: options.onExport || (() => {}),
      onPromptChange: options.onPromptChange || (() => {}),
      onPromptEditorSelect: options.onPromptEditorSelect || (() => {}),
      onPromptSave: options.onPromptSave || (() => {}),
      onPromptUpdate: options.onPromptUpdate || (() => {}),
      onPromptReset: options.onPromptReset || (() => {}),
      onSettingsSave: options.onSettingsSave || (() => {}),
      onSettingsClose: options.onSettingsClose || (() => {}),
      onClearApiKey: options.onClearApiKey || null
    };

    this.ids = {
      promptSelect: createUid('chatbot-prompt'),
      settingsPromptSelect: createUid('chatbot-settings-prompt')
    };

    this.messageElements = new Map();
    this.currentFlyout = null;
    this.previousFocus = null;
    this.streaming = false;
    this.status = 'ready';
    this.handlersBound = false;
    this.handleDocumentKeydown = this.handleDocumentKeydown.bind(this);
  }

  init() {
    if (!this.container) {
      console.warn('ChatbotUI: container not provided');
      return buildNullApi();
    }
    this.render();
    this.bindEvents();
    return this.buildApi();
  }

  render() {
    this.container.innerHTML = `
      <div class="chatbot-card" data-chatbot-card>
        <div class="chatbot-banner" data-chatbot-banner hidden></div>
        <header class="chatbot-header">
          <div class="chatbot-header__meta">
            <div class="chatbot-header__text">
              <h3 class="chatbot-header__title">SolidCAM Assistant</h3>
              <p class="chatbot-header__subtitle">Chat with live package context & references</p>
            </div>
          </div>
          <div class="chatbot-header__actions">
            <button type="button" class="chatbot-button" data-action="toggle-conversations" aria-haspopup="dialog" aria-expanded="false">Conversations</button>
            <button type="button" class="chatbot-button" data-action="toggle-settings" aria-haspopup="dialog" aria-expanded="false">Settings</button>
            <button type="button" class="chatbot-button" data-action="new-conversation">New Conversation</button>
            <button type="button" class="chatbot-button" data-action="export">Export</button>
          </div>
        </header>
        <div class="chatbot-body">
          <div class="chatbot-messages" data-chatbot-messages role="log" aria-live="polite"></div>
          <div class="chatbot-input">
            <div class="chatbot-input__prompt">
              <label for="${this.ids.promptSelect}">Prompt</label>
              <div class="chatbot-input__prompt-select">
                <select id="${this.ids.promptSelect}" data-prompt-select></select>
              </div>
            </div>
            <div class="chatbot-input__composer">
              <textarea data-input rows="1" placeholder="Ask about packages, maintenance, pricing moves, or SolidWorks context..." aria-label="Chatbot message"></textarea>
              <button type="button" class="chatbot-button chatbot-button--primary" data-action="send" disabled>Send</button>
            </div>
            <p class="chatbot-input__hint">Enter to send - Shift+Enter for newline</p>
          </div>
        </div>
        <div class="chatbot-flyout-backdrop" data-flyout-backdrop hidden></div>
        <aside class="chatbot-flyout" data-flyout="conversations" aria-hidden="true" role="dialog" aria-modal="true" aria-label="Conversation list">
          <header class="chatbot-flyout__header">
            <h4>Conversations</h4>
            <button type="button" class="chatbot-button chatbot-button--icon" data-action="close-flyout" aria-label="Close conversations">&times;</button>
          </header>
          <div class="chatbot-flyout__body">
            <button type="button" class="chatbot-button chatbot-button--primary" data-action="new-conversation-inline">Start New Conversation</button>
            <div class="chatbot-conversation-list" data-conversation-list role="list"></div>
          </div>
        </aside>
        <aside class="chatbot-flyout" data-flyout="settings" aria-hidden="true" role="dialog" aria-modal="true" aria-label="Chatbot settings">
          <header class="chatbot-flyout__header">
            <h4>Settings & Prompts</h4>
            <button type="button" class="chatbot-button chatbot-button--icon" data-action="close-flyout" aria-label="Close settings">&times;</button>
          </header>
          <div class="chatbot-flyout__body">
            <form data-settings-form>
              <section class="chatbot-settings__group">
                <h5>Connection</h5>
                <label>
                  <span>Provider</span>
                  <select data-settings-provider>
                    <option value="google">Google Gemini 2.0 Flash</option>
                    <option value="openrouter">OpenRouter</option>
                    <option value="deepseek">DeepSeek Chat</option>
                  </select>
                </label>
                <label>
                  <span>API Key</span>
                  <input type="password" data-settings-api-key placeholder="Paste provider key" autocomplete="off">
                </label>
                <div class="chatbot-settings__actions">
                  <button type="submit" class="chatbot-button chatbot-button--primary" data-action="save-settings">Save Settings</button>
                  <button type="button" class="chatbot-button" data-action="clear-key">Clear Key</button>
                </div>
              </section>
              <section class="chatbot-settings__group">
                <h5>Prompt Library</h5>
                <label>
                  <span>Active Prompt</span>
                  <select id="${this.ids.settingsPromptSelect}" data-settings-prompt-select></select>
                </label>
                <label>
                  <span>Prompt Name</span>
                  <input type="text" data-prompt-name placeholder="Prompt name">
                </label>
                <label>
                  <span>Prompt Content</span>
                  <textarea rows="6" data-prompt-content placeholder="System instructions for the assistant"></textarea>
                </label>
                <div class="chatbot-settings__prompt-actions">
                  <button type="button" class="chatbot-button chatbot-button--primary" data-action="prompt-save-as">Save As New</button>
                  <button type="button" class="chatbot-button" data-action="prompt-update">Update Prompt</button>
                  <button type="button" class="chatbot-button chatbot-button--ghost" data-action="prompt-reset">Reset Defaults</button>
                </div>
              </section>
            </form>
            <div class="chatbot-settings__foot">
              <p class="chatbot-settings__note">Settings are stored locally. API keys use simple obfuscation and stay on this device.</p>
            </div>
          </div>
        </aside>
      </div>
    `;

    const card = this.container.querySelector('[data-chatbot-card]');
    this.refs = {
      card,
      banner: card.querySelector('[data-chatbot-banner]'),
      messages: card.querySelector('[data-chatbot-messages]'),
      input: card.querySelector('[data-input]'),
      sendButton: card.querySelector('[data-action="send"]'),
      promptSelect: card.querySelector('[data-prompt-select]'),
      flyoutBackdrop: card.querySelector('[data-flyout-backdrop]'),
      conversationFlyout: card.querySelector('[data-flyout="conversations"]'),
      conversationList: card.querySelector('[data-conversation-list]'),
      settingsFlyout: card.querySelector('[data-flyout="settings"]'),
      settingsForm: card.querySelector('[data-settings-form]'),
      providerSelect: card.querySelector('[data-settings-provider]'),
      apiKeyInput: card.querySelector('[data-settings-api-key]'),
      settingsPromptSelect: card.querySelector('[data-settings-prompt-select]'),
      promptNameInput: card.querySelector('[data-prompt-name]'),
      promptContentInput: card.querySelector('[data-prompt-content]'),
      promptSaveButton: card.querySelector('[data-action="prompt-save-as"]'),
      promptUpdateButton: card.querySelector('[data-action="prompt-update"]'),
      promptResetButton: card.querySelector('[data-action="prompt-reset"]')
    };
  }

  bindEvents() {
    if (this.handlersBound) return;
    this.handlersBound = true;

    this.refs.card.addEventListener('click', event => {
      const actionEl = event.target.closest('[data-action]');
      if (!actionEl) return;
      const action = actionEl.dataset.action;
      switch (action) {
        case 'toggle-conversations':
          this.toggleFlyout('conversations', !this.isFlyoutOpen('conversations'));
          break;
        case 'toggle-settings':
          this.toggleFlyout('settings', !this.isFlyoutOpen('settings'));
          break;
        case 'new-conversation':
        case 'new-conversation-inline':
          this.closeFlyouts();
          this.callbacks.onNewConversation();
          break;
        case 'export':
          this.callbacks.onExport();
          break;
        case 'close-flyout':
          this.closeFlyouts();
          break;
        case 'prompt-save-as':
          this.handlePromptSave();
          break;
        case 'prompt-update':
          this.handlePromptUpdate();
          break;
        case 'prompt-reset':
          this.callbacks.onPromptReset();
          break;
        case 'clear-key':
          this.refs.apiKeyInput.value = '';
          if (typeof this.callbacks.onClearApiKey === 'function') {
            this.callbacks.onClearApiKey();
          }
          break;
        case 'send':
          this.requestSend();
          break;
        default:
          break;
      }
    });

    this.refs.promptSelect.addEventListener('change', event => {
      this.callbacks.onPromptChange(event.target.value);
    });

    this.refs.settingsPromptSelect.addEventListener('change', event => {
      this.callbacks.onPromptEditorSelect(event.target.value);
    });

    this.refs.settingsForm.addEventListener('submit', event => {
      event.preventDefault();
      this.handleSettingsSave();
    });

    this.refs.conversationList.addEventListener('click', event => {
      const button = event.target.closest('[data-conversation-id]');
      if (!button) return;
      const id = button.dataset.conversationId;
      this.closeFlyouts();
      this.callbacks.onSelectConversation(id);
    });

    this.refs.flyoutBackdrop.addEventListener('click', () => {
      this.closeFlyouts();
    });

    this.refs.input.addEventListener('input', () => this.handleInputChange());
    this.refs.input.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        this.requestSend();
      }
    });

    document.addEventListener('keydown', this.handleDocumentKeydown);
    autoResize(this.refs.input);
  }

  handleDocumentKeydown(event) {
    if (event.key === 'Escape' && this.currentFlyout) {
      this.closeFlyouts();
    }
  }

  buildApi() {
    return {
      setStatus: status => this.setStatus(status),
      setStreaming: isStreaming => this.setStreaming(isStreaming),
      setConversations: (items, activeId) => this.renderConversations(items, activeId),
      setMessages: messages => this.renderMessages(messages),
      appendMessage: message => this.appendMessage(message),
      updateMessage: (id, patch) => this.updateMessage(id, patch),
      attachReferences: (id, references) => this.attachReferences(id, references),
      focusInput: () => this.focusInput(),
      clearInput: () => this.clearInput(),
      setInputDisabled: disabled => this.setInputDisabled(disabled),
      setPrompts: (prompts, activeId) => this.setPrompts(prompts, activeId),
      setSettingsPrompt: (promptId, prompt) => this.setPromptEditorState(promptId, prompt),
      setSettings: settings => this.setSettings(settings),
      showBanner: (message, tone) => this.showBanner(message, tone),
      hideBanner: () => this.hideBanner(),
      closeFlyouts: () => this.closeFlyouts()
    };
  }

  requestSend() {
    if (this.streaming) return;
    const text = (this.refs.input.value || '').trim();
    if (!text) return;
    this.callbacks.onSend(text);
  }

  handleInputChange() {
    const value = (this.refs.input.value || '').trim();
    this.refs.sendButton.disabled = !value || this.streaming;
    autoResize(this.refs.input);
  }

  handleSettingsSave() {
    const provider = this.refs.providerSelect.value;
    const apiKey = this.refs.apiKeyInput.value.trim();
    const activePromptId = this.refs.settingsPromptSelect.value;
    this.callbacks.onSettingsSave({ provider, apiKey, activePromptId });
  }

  handlePromptSave() {
    const name = this.refs.promptNameInput.value.trim();
    const content = this.refs.promptContentInput.value.trim();
    if (!content) {
      this.showBanner('Prompt content is required.', 'warning');
      return;
    }
    this.callbacks.onPromptSave({ name, content });
  }

  handlePromptUpdate() {
    const id = this.refs.settingsPromptSelect.value;
    const name = this.refs.promptNameInput.value.trim();
    const content = this.refs.promptContentInput.value.trim();
    this.callbacks.onPromptUpdate({ id, name, content });
  }

  setStatus(status) {
    this.status = status;
    if (this.refs.card) {
      this.refs.card.dataset.status = status;
    }
  }

  setStreaming(isStreaming) {
    this.streaming = isStreaming;
    this.refs.sendButton.disabled = isStreaming || !(this.refs.input.value || '').trim();
    this.refs.input.disabled = isStreaming;
  }

  setInputDisabled(disabled) {
    this.refs.input.disabled = disabled;
    this.refs.sendButton.disabled = disabled || !(this.refs.input.value || '').trim();
  }

  focusInput() {
    focusElement(this.refs.input, { preventScroll: true });
  }

  clearInput() {
    this.refs.input.value = '';
    this.refs.sendButton.disabled = true;
    autoResize(this.refs.input);
  }

  renderMessages(messages = []) {
    this.messageElements.clear();
    this.refs.messages.innerHTML = '';
    messages.forEach(message => this.appendMessage(message));
    this.scrollMessagesToBottom();
  }

  appendMessage(message) {
    const element = this.createMessageElement(message);
    this.refs.messages.appendChild(element.root);
    this.messageElements.set(message.id, element);
    this.scrollMessagesToBottom();
  }

  updateMessage(id, patch = {}) {
    const element = this.messageElements.get(id);
    if (!element) return;
    if (typeof patch.content === 'string') {
      renderContent(element.contentEl, patch.content);
    }
    if (typeof patch.error === 'boolean') {
      element.root.classList.toggle('chatbot-message--error', patch.error);
    }
    if (typeof patch.streaming === 'boolean') {
      element.root.classList.toggle('chatbot-message--streaming', patch.streaming);
    }
    if (Array.isArray(patch.references)) {
      this.attachReferences(id, patch.references);
    }
    this.scrollMessagesToBottom();
  }

  attachReferences(id, references = []) {
    const element = this.messageElements.get(id);
    if (!element || !element.referencesEl) return;
    if (!Array.isArray(references) || references.length === 0) {
      element.referencesEl.hidden = true;
      element.referencesEl.innerHTML = '';
      return;
    }
    element.referencesEl.hidden = false;
    const list = document.createElement('ul');
    list.className = 'chatbot-references__list';
    references.forEach(ref => {
      const item = document.createElement('li');
      item.className = 'chatbot-references__item';
      const title = document.createElement('strong');
      title.textContent = ref.title || 'Reference';
      item.appendChild(title);
      if (ref.snippet) {
        const snippet = document.createElement('p');
        snippet.textContent = ref.snippet;
        item.appendChild(snippet);
      }
      list.appendChild(item);
    });
    element.referencesEl.innerHTML = '';
    element.referencesEl.appendChild(list);
  }

  renderConversations(conversations = [], activeId) {
    if (!conversations.length) {
      this.refs.conversationList.innerHTML = '';
      const empty = document.createElement('p');
      empty.className = 'chatbot-empty-state';
      empty.textContent = 'No conversations yet. Start a new chat to begin.';
      empty.setAttribute('role', 'note');
      this.refs.conversationList.appendChild(empty);
      return;
    }
    const fragment = document.createDocumentFragment();
    conversations.forEach(conversation => {
      const wrapper = document.createElement('div');
      wrapper.className = 'chatbot-conversation-item';
      wrapper.setAttribute('role', 'listitem');

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chatbot-conversation';
      button.dataset.conversationId = conversation.id;
      if (conversation.id === activeId) {
        button.classList.add('is-active');
      }
      const title = document.createElement('div');
      title.className = 'chatbot-conversation__title';
      title.textContent = conversation.title || 'Conversation';
      button.appendChild(title);

      const meta = document.createElement('div');
      meta.className = 'chatbot-conversation__meta';
      const snippet = truncate(conversation.snippet || '', 120);
      const timestamp = conversation.updatedAt ? formatTimestamp(conversation.updatedAt) : '';
      const metaParts = [timestamp, snippet].filter(Boolean);
      meta.textContent = metaParts.join(' - ');
      const ariaParts = [conversation.title || 'Conversation'];
      if (timestamp) ariaParts.push(`Updated ${timestamp}`);
      if (snippet) ariaParts.push(`Last message ${snippet}`);
      button.setAttribute('aria-label', ariaParts.join('. '));
      button.appendChild(meta);

      wrapper.appendChild(button);
      fragment.appendChild(wrapper);
    });
    this.refs.conversationList.innerHTML = '';
    this.refs.conversationList.appendChild(fragment);
  }

  setPrompts(prompts = [], activeId) {
    renderSelectOptions(this.refs.promptSelect, prompts, activeId);
    renderSelectOptions(this.refs.settingsPromptSelect, prompts, activeId);
    if (activeId) {
      this.refs.promptSelect.value = activeId;
      this.refs.settingsPromptSelect.value = activeId;
    }
  }

  setSettings(settings = {}) {
    if (settings.provider) {
      this.refs.providerSelect.value = settings.provider;
    }
    if (typeof settings.apiKey === 'string') {
      this.refs.apiKeyInput.value = settings.apiKey;
    }
    if (settings.activePromptId) {
      this.refs.promptSelect.value = settings.activePromptId;
      this.refs.settingsPromptSelect.value = settings.activePromptId;
    }
  }

  setPromptEditorState(promptId, prompt) {
    if (!prompt) return;
    this.refs.settingsPromptSelect.value = promptId;
    this.refs.promptNameInput.value = prompt.name || '';
    this.refs.promptContentInput.value = prompt.content || '';
    const isReadOnly = Boolean(prompt.readOnly);
    this.refs.promptUpdateButton.disabled = isReadOnly;
  }

  showBanner(message, tone = 'info') {
    if (!this.refs.banner) return;
    this.refs.banner.textContent = message;
    this.refs.banner.dataset.tone = tone;
    this.refs.banner.hidden = false;
  }

  hideBanner() {
    if (!this.refs.banner) return;
    this.refs.banner.hidden = true;
    this.refs.banner.textContent = '';
    delete this.refs.banner.dataset.tone;
  }

  toggleFlyout(name, shouldOpen) {
    if (!FLYOUT_NAMES.includes(name)) return;
    if (shouldOpen === false) {
      this.closeFlyouts();
      return;
    }
    if (this.currentFlyout === name) {
      this.closeFlyouts();
      return;
    }
    this.closeFlyouts();
    const flyout = name === 'conversations' ? this.refs.conversationFlyout : this.refs.settingsFlyout;
    if (!flyout) return;
    this.currentFlyout = name;
    this.previousFocus = document.activeElement;
    if (this.refs.card) {
      this.refs.card.classList.add('chatbot-card--flyout-open');
      this.refs.card.setAttribute('data-flyout', name);
    }
    flyout.classList.add('is-open');
    flyout.setAttribute('aria-hidden', 'false');
    this.refs.flyoutBackdrop.hidden = false;
    toggleHeaderButton(this.refs.card, name, true);
    const focusable = getFirstFocusable(flyout);
    if (focusable) {
      const scrollState = getScrollOffsets();
      focusElement(focusable);
      restoreScroll(scrollState);
    }
  }

  closeFlyouts() {
    const wasSettingsOpen = this.currentFlyout === 'settings';
    FLYOUT_NAMES.forEach(name => {
      const flyout = name === 'conversations' ? this.refs.conversationFlyout : this.refs.settingsFlyout;
      if (!flyout) return;
      flyout.classList.remove('is-open');
      flyout.setAttribute('aria-hidden', 'true');
      toggleHeaderButton(this.refs.card, name, false);
    });
    this.refs.flyoutBackdrop.hidden = true;
    this.currentFlyout = null;
    if (this.refs.card) {
      this.refs.card.classList.remove('chatbot-card--flyout-open');
      this.refs.card.removeAttribute('data-flyout');
    }
    const scrollState = getScrollOffsets();
    focusElement(this.previousFocus);
    restoreScroll(scrollState);
    this.previousFocus = null;
    if (wasSettingsOpen && typeof this.callbacks.onSettingsClose === 'function') {
      this.callbacks.onSettingsClose();
    }
  }

  isFlyoutOpen(name) {
    return this.currentFlyout === name;
  }

  createMessageElement(message) {
    const root = document.createElement('article');
    root.className = `chatbot-message chatbot-message--${message.role || 'user'}`;
    root.dataset.messageId = message.id;
    if (message.error) {
      root.classList.add('chatbot-message--error');
    }
    const bubble = document.createElement('div');
    bubble.className = 'chatbot-message__bubble';
    root.appendChild(bubble);

    const contentEl = document.createElement('div');
    contentEl.className = 'chatbot-message__content';
    renderContent(contentEl, message.content || '');
    bubble.appendChild(contentEl);

    const meta = document.createElement('div');
    meta.className = 'chatbot-message__meta';
    meta.textContent = DEFAULT_MESSAGE_META[message.role] || 'Message';
    if (message.createdAt) {
      const time = document.createElement('time');
      time.dateTime = new Date(message.createdAt).toISOString();
      time.textContent = formatTimeOfDay(message.createdAt);
      meta.appendChild(document.createTextNode(' • '));
      meta.appendChild(time);
    }
    bubble.appendChild(meta);

    let referencesEl = null;
    if (message.role === 'assistant') {
      referencesEl = document.createElement('div');
      referencesEl.className = 'chatbot-message__references';
      referencesEl.hidden = !Array.isArray(message.references) || message.references.length === 0;
      if (message.references?.length) {
        const list = document.createElement('ul');
        list.className = 'chatbot-references__list';
        message.references.forEach(ref => {
          const item = document.createElement('li');
          item.className = 'chatbot-references__item';
          const title = document.createElement('strong');
          title.textContent = ref.title || 'Reference';
          item.appendChild(title);
          if (ref.snippet) {
            const snippet = document.createElement('p');
            snippet.textContent = ref.snippet;
            item.appendChild(snippet);
          }
          list.appendChild(item);
        });
        referencesEl.appendChild(list);
      }
      root.appendChild(referencesEl);
    }

    return {
      root,
      contentEl,
      referencesEl
    };
  }

  scrollMessagesToBottom() {
    this.refs.messages.scrollTop = this.refs.messages.scrollHeight;
  }
}

function renderSelectOptions(select, prompts, activeId) {
  if (!select) return;
  select.innerHTML = '';
  if (!Array.isArray(prompts) || !prompts.length) return;
  prompts.forEach(prompt => {
    const option = document.createElement('option');
    option.value = prompt.id;
    option.textContent = prompt.name || 'Prompt';
    option.dataset.readOnly = prompt.readOnly ? 'true' : 'false';
    select.appendChild(option);
  });
  if (activeId) {
    select.value = activeId;
  }
}

function renderContent(element, text) {
  if (!element) return;
  element.innerHTML = '';
  const lines = String(text).split('\n');
  lines.forEach((line, index) => {
    element.appendChild(document.createTextNode(line));
    if (index < lines.length - 1) {
      element.appendChild(document.createElement('br'));
    }
  });
}

function autoResize(textarea) {
  if (!textarea) return;
  textarea.style.height = 'auto';
  const max = 240;
  const height = Math.min(max, textarea.scrollHeight + 2);
  textarea.style.height = `${height}px`;
}

function createUid(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function truncate(value, length) {
  if (!value) return '';
  if (value.length <= length) return value;
  return `${value.slice(0, length - 3)}...`;
}

function formatTimestamp(timestamp) {
  try {
    const date = new Date(timestamp);
    return date.toLocaleString([], { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' });
  } catch (error) {
    return '';
  }
}

function formatTimeOfDay(timestamp) {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch (error) {
    return '';
  }
}

function toggleHeaderButton(card, name, expanded) {
  const button =
    name === 'conversations'
      ? card.querySelector('[data-action="toggle-conversations"]')
      : card.querySelector('[data-action="toggle-settings"]');
  if (button) {
    button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  }
}

function focusElement(element, options = {}) {
  if (!element || typeof element.focus !== 'function') return;
  const settings = { preventScroll: true, ...options };
  try {
    element.focus(settings);
  } catch (error) {
    element.focus();
  }
}

function getScrollOffsets() {
  if (typeof window === 'undefined') {
    return { x: 0, y: 0 };
  }
  const x =
    typeof window.pageXOffset === 'number'
      ? window.pageXOffset
      : typeof window.scrollX === 'number'
        ? window.scrollX
        : 0;
  const y =
    typeof window.pageYOffset === 'number'
      ? window.pageYOffset
      : typeof window.scrollY === 'number'
        ? window.scrollY
        : 0;
  return { x, y };
}

function restoreScroll(offsets) {
  if (typeof window === 'undefined' || !offsets) return;
  const { x = 0, y = 0 } = offsets;
  window.scrollTo(x, y);
}

function getFirstFocusable(root) {
  const selectors = [
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ];
  return root.querySelector(selectors.join(', '));
}

function buildNullApi() {
  const noop = () => {};
  return {
    setStatus: noop,
    setStreaming: noop,
    setConversations: noop,
    setMessages: noop,
    appendMessage: noop,
    updateMessage: noop,
    attachReferences: noop,
    focusInput: noop,
    clearInput: noop,
    setInputDisabled: noop,
    setPrompts: noop,
    setSettingsPrompt: noop,
    setSettings: noop,
    showBanner: noop,
    hideBanner: noop,
    closeFlyouts: noop
  };
}
