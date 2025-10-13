const FLYOUT_NAMES = ['conversations', 'settings'];
const MODE_TOGGLE_ACTIVE_CLASS = 'chatbot-mode-toggle__button--active';
const ICON_SPECS = {
  conversations: [
    { el: 'path', attrs: { d: 'M5 5.5h14v8H13l-4 4v-4H5z' } },
    { el: 'line', attrs: { x1: 7, y1: 9, x2: 17, y2: 9 } },
    { el: 'line', attrs: { x1: 7, y1: 12, x2: 14.5, y2: 12 } }
  ],
  settings: [
    { el: 'line', attrs: { x1: 5, y1: 8, x2: 19, y2: 8 } },
    { el: 'circle', attrs: { cx: 10, cy: 8, r: 1.6 } },
    { el: 'line', attrs: { x1: 5, y1: 12, x2: 19, y2: 12 } },
    { el: 'circle', attrs: { cx: 15, cy: 12, r: 1.6 } },
    { el: 'line', attrs: { x1: 5, y1: 16, x2: 19, y2: 16 } },
    { el: 'circle', attrs: { cx: 8, cy: 16, r: 1.6 } }
  ],
  newConversation: [
    { el: 'circle', attrs: { cx: 12, cy: 12, r: 7.2 } },
    { el: 'line', attrs: { x1: 12, y1: 8.5, x2: 12, y2: 15.5 } },
    { el: 'line', attrs: { x1: 8.5, y1: 12, x2: 15.5, y2: 12 } }
  ],
  export: [
    { el: 'line', attrs: { x1: 12, y1: 5, x2: 12, y2: 15 } },
    { el: 'polyline', attrs: { points: '8 11 12 15 16 11' } },
    { el: 'line', attrs: { x1: 6, y1: 19, x2: 18, y2: 19 } }
  ],
  copy: [
    { el: 'rect', attrs: { x: 8.5, y: 7, width: 10, height: 12, rx: 1.6 } },
    { el: 'rect', attrs: { x: 5.5, y: 5, width: 10, height: 12, rx: 1.6 } },
    { el: 'line', attrs: { x1: 9.5, y1: 11, x2: 15.5, y2: 11 } },
    { el: 'line', attrs: { x1: 9.5, y1: 14, x2: 15.5, y2: 14 } }
  ],
  debug: [
    { el: 'circle', attrs: { cx: 12, cy: 12, r: 7 } },
    { el: 'circle', attrs: { cx: 12, cy: 12, r: 2.4 } },
    { el: 'line', attrs: { x1: 12, y1: 7, x2: 12, y2: 9.5 } },
    { el: 'line', attrs: { x1: 12, y1: 14.5, x2: 12, y2: 17 } },
    { el: 'line', attrs: { x1: 7, y1: 12, x2: 9.5, y2: 12 } },
    { el: 'line', attrs: { x1: 14.5, y1: 12, x2: 17, y2: 12 } }
  ],
  provider: [
    { el: 'rect', attrs: { x: 5, y: 8, width: 14, height: 4.5, rx: 1.4 } },
    { el: 'rect', attrs: { x: 7, y: 14, width: 10, height: 4, rx: 1.4 } },
    { el: 'circle', attrs: { cx: 9.2, cy: 10.2, r: 0.9, fill: 'currentColor', stroke: 'none' } },
    { el: 'circle', attrs: { cx: 11.8, cy: 16, r: 0.9, fill: 'currentColor', stroke: 'none' } }
  ],
  close: [
    { el: 'line', attrs: { x1: 8, y1: 8, x2: 16, y2: 16 } },
    { el: 'line', attrs: { x1: 16, y1: 8, x2: 8, y2: 16 } }
  ],
  send: [
    { el: 'line', attrs: { x1: 5, y1: 12, x2: 19, y2: 12 } },
    { el: 'polyline', attrs: { points: '13 6 19 12 13 18' } }
  ]
};
const SVG_NS = 'http://www.w3.org/2000/svg';

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
    this.modes = Array.isArray(options.modes) ? options.modes : [];
    this.callbacks = {
      onSend: options.onSend || (() => {}),
      onNewConversation: options.onNewConversation || (() => {}),
      onSelectConversation: options.onSelectConversation || (() => {}),
      onCopyConversation: options.onCopyConversation || (() => {}),
      onModeChange: options.onModeChange || (() => {}),
      onProviderChange: options.onProviderChange || (() => {}),
      onModelChange: options.onModelChange || (() => {}),
      onSettingsSave: options.onSettingsSave || (() => {}),
      onSettingsClose: options.onSettingsClose || (() => {}),
      onClearApiKey: options.onClearApiKey || null,
      onSidebarWidthChange: options.onSidebarWidthChange || (() => {}),
      onPromptReset: options.onPromptReset || (() => {}),
      onToggleDebug: options.onToggleDebug || (() => {})
    };

    this.ids = {
      modelSelect: createUid('chatbot-model')
    };

    this.messageElements = new Map();
    this.modeButtons = new Map();
    this.promptEditors = {
      package: null,
      general: null
    };

    this.currentMode = null;
    this.currentFlyout = null;
    this.previousFocus = null;
    this.streaming = false;
    this.status = 'ready';
    this.handlersBound = false;
    this.providerApiKeys = {};
    this.sidebarWidths = {
      conversations: null,
      settings: null
    };
    this.modelOptions = [];
    this.currentModelProvider = null;
    this.scrollToBottomRaf = null;
    this.debugVisible = false;
    this.refs = {};
    this.toastTimers = new Map();

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
    this.modeButtons.clear();

    const card = createElem('div', {
      className: 'chatbot-card',
      dataset: { chatbotCard: '' }
    });

    const banner = createElem('div', {
      className: 'chatbot-banner',
      dataset: { chatbotBanner: '' }
    });
    banner.hidden = true;

    const toastRegion = createElem('div', {
      className: 'chatbot-toast-region',
      dataset: { toastRegion: '' },
      attrs: { role: 'status', 'aria-live': 'polite' }
    });

    const header = createElem('header', { className: 'chatbot-header' });
    const commandBar = createElem('div', { className: 'chatbot-header__command' });
    const commandLeft = createElem('div', { className: 'chatbot-header__command-left' });
    const modeToggle = this.buildModeToggle(this.modes);
    commandLeft.appendChild(modeToggle);

    const providerBadge = createElem('div', {
      className: 'chatbot-provider-pill',
      dataset: { providerBadge: '' }
    });
    const providerIcon = createIcon('provider');
    providerIcon.classList.add('chatbot-provider-pill__icon');
    const providerLabel = createElem('span', {
      className: 'chatbot-provider-pill__label',
      text: 'Provider: Not set'
    });
    providerBadge.append(providerIcon, providerLabel);

    const commandRight = createElem('div', { className: 'chatbot-header__command-right' });
    const headerActions = createElem('div', { className: 'chatbot-header__actions' });
    const buildActionButton = (action, label, iconName, extraClass = '') => {
      const button = createElem('button', {
        className: `chatbot-button chatbot-button--icon chatbot-button--ghost${extraClass ? ` ${extraClass}` : ''}`,
        dataset: { action },
        attrs: {
          type: 'button',
          'aria-label': label,
          title: label
        }
      });
      if (action === 'toggle-conversations' || action === 'toggle-settings') {
        button.setAttribute('aria-haspopup', 'dialog');
        button.setAttribute('aria-expanded', 'false');
      }
      button.appendChild(createIcon(iconName));
      return button;
    };

    const toggleConversations = buildActionButton('toggle-conversations', 'Open conversations', 'conversations');
    const newConversation = buildActionButton('new-conversation', 'Start new conversation', 'newConversation', 'chatbot-button--accent');
    const copyButton = buildActionButton('copy-chat', 'Copy chat to clipboard', 'copy');
    const toggleSettings = buildActionButton('toggle-settings', 'Open settings', 'settings');
    headerActions.append(toggleConversations, newConversation, copyButton, toggleSettings);

    const commandControls = createElem('div', { className: 'chatbot-header__controls' });
    commandControls.append(providerBadge, headerActions);
    commandRight.append(commandControls, toastRegion);
    commandBar.append(commandLeft, commandRight);

    const hero = createElem('div', { className: 'chatbot-header__hero' });
    const heroText = createElem('div', { className: 'chatbot-hero__text' });
    const title = createElem('h3', {
      className: 'chatbot-hero__title',
      text: 'SolidCAM Assistant'
    });
    const subtitle = createElem('p', {
      className: 'chatbot-hero__subtitle',
      text: 'Select a mode to get started'
    });
    heroText.append(title, subtitle);

    hero.append(heroText);

    header.append(commandBar, hero);

    const body = createElem('div', { className: 'chatbot-body' });
    const messages = createElem('div', {
      className: 'chatbot-messages',
      dataset: { chatbotMessages: '' },
      attrs: { role: 'log', 'aria-live': 'polite' }
    });

    const inputShell = createElem('div', { className: 'chatbot-input' });
    const controlRow = createElem('div', { className: 'chatbot-input__controls' });
    const modelLabel = createElem('label', {
      attrs: { for: this.ids.modelSelect },
      text: 'Model'
    });
    const modelSelectWrapper = createElem('div', { className: 'chatbot-input__model-select' });
    const modelSelect = createElem('select', {
      attrs: { id: this.ids.modelSelect, name: 'chatbot-model' },
      dataset: { modelSelect: '' }
    });
    modelSelectWrapper.appendChild(modelSelect);
    controlRow.append(modelLabel, modelSelectWrapper);

    const composer = createElem('div', { className: 'chatbot-input__composer' });
    const fieldShell = createElem('div', { className: 'chatbot-input__field' });
    const inputTextarea = createElem('textarea', {
      className: 'chatbot-input__textarea',
      dataset: { input: '' },
      attrs: {
        id: 'chatbot-input',
        name: 'chatbot-message',
        rows: '3',
        placeholder: 'Type your SolidCAM question...',
        'aria-label': 'Chatbot message'
      }
    });
    fieldShell.appendChild(inputTextarea);

    const sendButton = createElem('button', {
      className: 'chatbot-button chatbot-button--primary',
      dataset: { action: 'send' },
      attrs: { type: 'button', disabled: 'disabled' }
    });
    const sendIcon = createIcon('send');
    const sendLabel = createElem('span', { text: 'Send' });
    sendButton.append(sendIcon, sendLabel);

    composer.append(fieldShell, sendButton);

    const metrics = createElem('div', { className: 'chatbot-input__metrics' });
    const counterWrap = createElem('div', { className: 'chatbot-input__counter-wrap' });
    const counter = createElem('span', { className: 'chatbot-input__counter', text: '0 chars' });
    const clearButton = createElem('button', {
      className: 'chatbot-input__clear',
      dataset: { action: 'composer-clear' },
      attrs: { type: 'button' },
      text: 'Clear'
    });
    counterWrap.append(counter, clearButton);
    const hint = createElem('span', {
      className: 'chatbot-input__hint',
      text: 'Enter to send · Shift+Enter for newline'
    });
    metrics.append(counterWrap, hint);

    inputShell.append(controlRow, composer, metrics);
    body.append(messages, inputShell);

    const backdrop = createElem('div', {
      className: 'chatbot-flyout-backdrop',
      dataset: { flyoutBackdrop: '' }
    });
    backdrop.hidden = true;

    const conversationsFlyout = this.buildConversationsFlyout();
    const settingsBuild = this.buildSettingsFlyout();
    const settingsFlyout = settingsBuild.flyout;

    card.append(banner, header, body, backdrop, conversationsFlyout, settingsFlyout);
    this.container.replaceChildren(card);

    this.promptEditors = settingsBuild.promptEditors;

    this.refs = {
      card,
      banner,
      toastRegion,
      headerTitle: title,
      headerSubtitle: subtitle,
      modeToggle,
      toggleConversations,
      toggleSettings,
      providerBadge,
      providerLabel,
      inputCounter: counter,
      messages,
      input: inputTextarea,
      sendButton,
      modelSelect,
      flyoutBackdrop: backdrop,
      conversationsFlyout: conversationsFlyout,
      conversationList: conversationsFlyout.querySelector('[data-conversation-list]'),
      settingsFlyout,
      settingsForm: settingsFlyout.querySelector('[data-settings-form]'),
      providerSelect: settingsFlyout.querySelector('[data-settings-provider]'),
      apiKeyInput: settingsFlyout.querySelector('[data-settings-api-key]'),
      debugToggle: settingsBuild.debugToggle,
      debugPanel: settingsBuild.debugPanel,
      packagePromptName: settingsBuild.promptEditors.package?.nameInput || null,
      packagePromptContent: settingsBuild.promptEditors.package?.contentInput || null,
      generalPromptName: settingsBuild.promptEditors.general?.nameInput || null,
      generalPromptContent: settingsBuild.promptEditors.general?.contentInput || null,
      promptResetButtons: settingsFlyout.querySelectorAll('[data-action="prompt-reset"]')
    };

    if (this.refs.modelSelect) {
      const placeholder = createElem('option', { text: 'Loading models...' });
      placeholder.value = '';

      this.refs.modelSelect.appendChild(placeholder);
      this.refs.modelSelect.disabled = true;
    }
  }
  buildModeToggle(modes = []) {
    const wrapper = createElem('div', {
      className: 'chatbot-mode-toggle',
      attrs: { role: 'group', 'aria-label': 'Assistant mode' }
    });
    const inner = createElem('div', { className: 'chatbot-mode-toggle__inner' });
    modes.forEach((mode, index) => {
      if (!mode || typeof mode !== 'object') return;
      const button = createElem('button', {
        className: 'chatbot-mode-toggle__button',
        dataset: { action: 'mode-select', mode: mode.id },
        attrs: {
          type: 'button',
          'aria-pressed': 'false'
        },
        text: mode.label || mode.id
      });
      if (index === 0) {
        button.classList.add(MODE_TOGGLE_ACTIVE_CLASS);
        button.setAttribute('aria-pressed', 'true');
        this.currentMode = mode.id;
      }
      this.modeButtons.set(mode.id, button);
      inner.appendChild(button);
    });
    wrapper.appendChild(inner);
    return wrapper;
  }

  buildConversationsFlyout() {
    const modal = createElem('div', {
      className: 'chatbot-modal',
      dataset: { flyout: 'conversations' },
      attrs: {
        'aria-hidden': 'true',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': 'Conversation list'
      }
    });

    const container = createElem('div', { className: 'chatbot-modal__container' });
    const header = createElem('header', { className: 'chatbot-modal__header' });
    const headerText = createElem('div', { className: 'chatbot-modal__header-text' });
    const title = createElem('h4', { className: 'chatbot-modal__title', text: 'Conversations' });
    const subtitle = createElem('p', {
      className: 'chatbot-modal__subtitle',
      text: 'Chat history and management'
    });
    headerText.append(title, subtitle);

    const close = createElem('button', {
      className: 'chatbot-button chatbot-button--icon chatbot-button--ghost',
      dataset: { action: 'close-flyout' },
      attrs: {
        type: 'button',
        'aria-label': 'Close conversations',
        title: 'Close (Esc)'
      }
    });
    close.appendChild(createIcon('close'));
    header.append(headerText, close);

    const body = createElem('div', { className: 'chatbot-modal__body' });
    const newButton = createElem('button', {
      className: 'chatbot-button chatbot-button--primary',
      dataset: { action: 'new-conversation-inline' },
      attrs: {
        type: 'button',
        'data-focus-initial': 'true'
      },
      text: 'Start New Conversation'
    });

    const listSurface = createElem('div', { className: 'chatbot-modal__surface chatbot-modal__surface--scroll' });
    const list = createElem('div', {
      className: 'chatbot-conversation-list',
      dataset: { conversationList: '' }
    });
    listSurface.appendChild(list);

    body.append(newButton, listSurface);
    container.append(header, body);
    modal.append(container);
    return modal;
  }

  buildPromptEditor(mode, label) {
    const root = createElem('fieldset', {
      className: 'chatbot-prompt-editor',
      dataset: { promptEditor: mode }
    });
    const legend = createElem('legend', { text: label });
    const nameLabel = createElem('label', { className: 'chatbot-prompt-editor__label' });
    nameLabel.appendChild(createElem('span', { text: 'Prompt Name' }));
    const nameInput = createElem('input', {
      className: 'chatbot-input-field',
      attrs: {
        type: 'text',
        name: `${mode}-prompt-name`,
        placeholder: 'Friendly name'
      },
      dataset: { promptName: mode }
    });
    nameLabel.appendChild(nameInput);

    const contentLabel = createElem('label', { className: 'chatbot-prompt-editor__label' });
    contentLabel.appendChild(createElem('span', { text: 'Prompt Instructions' }));
    const textarea = createElem('textarea', {
      className: 'chatbot-textarea',
      attrs: {
        name: `${mode}-prompt-content`,
        rows: '6',
        placeholder: 'Describe how this assistant should behave'
      },
      dataset: { promptContent: mode }
    });
    contentLabel.appendChild(textarea);

    const actions = createElem('div', { className: 'chatbot-prompt-editor__actions' });
    const resetButton = createElem('button', {
      className: 'chatbot-button chatbot-button--subtle',
      dataset: { action: 'prompt-reset', mode },
      attrs: { type: 'button' },
      text: 'Reset to Default'
    });
    actions.appendChild(resetButton);

    root.append(legend, nameLabel, contentLabel, actions);

    return {
      root,
      nameInput,
      contentInput: textarea,
      resetButton
    };
  }

  buildSettingsFlyout() {
    const modal = createElem('div', {
      className: 'chatbot-modal chatbot-modal--wide',
      dataset: { flyout: 'settings' },
      attrs: {
        'aria-hidden': 'true',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': 'Chatbot settings'
      }
    });
    const container = createElem('div', { className: 'chatbot-modal__container chatbot-modal__container--wide' });
    const header = createElem('header', { className: 'chatbot-modal__header' });
    const title = createElem('h4', { className: 'chatbot-modal__title', text: 'Settings & Prompts' });
    const close = createElem('button', {
      className: 'chatbot-button chatbot-button--icon chatbot-button--ghost',
      dataset: { action: 'close-flyout' },
      attrs: { type: 'button', 'aria-label': 'Close settings', title: 'Close settings' }
    });
    close.appendChild(createIcon('close'));
    header.append(title, close);

    const body = createElem('div', { className: 'chatbot-modal__body chatbot-modal__body--scrollable' });
    const form = createElem('form', { dataset: { settingsForm: '' } });

    const connectionSection = createElem('section', {
      className: 'chatbot-settings__group'
    });
    connectionSection.appendChild(createElem('h5', { text: 'Connection' }));

    const providerLabel = createElem('label', { className: 'chatbot-settings__label' });
    providerLabel.appendChild(createElem('span', { text: 'Provider' }));
    const providerSelect = createElem('select', {
      dataset: { settingsProvider: '' },
      attrs: { name: 'provider' }
    });
    ['google', 'openrouter', 'deepseek'].forEach(value => {
      const option = createElem('option', {
        attrs: { value },
        text: value === 'google' ? 'Google Gemini' : value === 'openrouter' ? 'OpenRouter' : 'DeepSeek'
      });
      providerSelect.appendChild(option);
    });
    providerLabel.appendChild(providerSelect);

    const apiKeyLabel = createElem('label', { className: 'chatbot-settings__label' });
    apiKeyLabel.appendChild(createElem('span', { text: 'API Key' }));
    const apiKeyRow = createElem('div', { className: 'chatbot-settings__inline' });
    const apiKeyInput = createElem('input', {
      className: 'chatbot-input-field',
      attrs: { type: 'password', name: 'api-key', placeholder: 'Paste provider API key' },
      dataset: { settingsApiKey: '' }
    });
    const clearButton = createElem('button', {
      className: 'chatbot-button chatbot-button--subtle',
      dataset: { action: 'clear-key' },
      attrs: { type: 'button' },
      text: 'Clear'
    });
    apiKeyRow.append(apiKeyInput, clearButton);
    apiKeyLabel.appendChild(apiKeyRow);

    const debugToggleLabel = createElem('label', { className: 'chatbot-settings__switch' });
    const debugCheckbox = createElem('input', {
      attrs: { type: 'checkbox', name: 'debug-toggle' },
      dataset: { debugToggle: '' }
    });
    debugToggleLabel.append(debugCheckbox, createElem('span', { text: 'Show Debug Panel' }));

    connectionSection.append(providerLabel, apiKeyLabel, debugToggleLabel);

    const promptSection = createElem('section', {
      className: 'chatbot-settings__group'
    });
    promptSection.appendChild(createElem('h5', { text: 'Assistant Prompts' }));
    const packageEditor = this.buildPromptEditor('package', 'Package Assistant Prompt');
    const generalEditor = this.buildPromptEditor('general', 'General Assistant Prompt');
    promptSection.append(packageEditor.root, generalEditor.root);

    const actions = createElem('div', { className: 'chatbot-settings__actions' });
    const saveButton = createElem('button', {
      className: 'chatbot-button chatbot-button--primary',
      attrs: { type: 'submit' },
      text: 'Save Settings'
    });
    const closeButton = createElem('button', {
      className: 'chatbot-button chatbot-button--subtle',
      dataset: { action: 'close-flyout' },
      attrs: { type: 'button' },
      text: 'Close'
    });
    actions.append(saveButton, closeButton);

    form.append(connectionSection, promptSection, actions);

    const debugPanel = createElem('section', {
      className: 'chatbot-settings__group chatbot-settings__group--debug',
      dataset: { debugPanel: '' }
    });
    debugPanel.hidden = true;
    debugPanel.appendChild(createElem('h5', { text: 'Debug & Telemetry' }));
    const debugContent = createElem('div', {
      className: 'chatbot-debug-panel',
      dataset: { debugContent: '' }
    });
    debugPanel.appendChild(debugContent);

    body.append(form, debugPanel);
    container.append(header, body);
    modal.append(container);

    return {
      flyout: modal,
      promptEditors: {
        package: {
          nameInput: packageEditor.nameInput,
          contentInput: packageEditor.contentInput
        },
        general: {
          nameInput: generalEditor.nameInput,
          contentInput: generalEditor.contentInput
        }
      },
      debugToggle: debugCheckbox,
      debugPanel
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
        case 'copy-chat':
          this.callbacks.onCopyConversation();
          break;
        case 'composer-clear':
          this.clearInput();
          this.focusInput();
          break;
        case 'dismiss-toast': {
          const toast = actionEl.closest('[data-toast]');
          if (toast) {
            this.dismissToast(toast);
          }
          break;
        }
        case 'close-flyout':
          this.closeFlyouts();
          break;
        case 'clear-key':
          if (this.refs.apiKeyInput) {
            this.refs.apiKeyInput.value = '';

          }
          if (typeof this.callbacks.onClearApiKey === 'function') {
            const provider = this.refs.providerSelect?.value;
            this.callbacks.onClearApiKey(provider);
          }
          break;
        case 'prompt-reset':
          this.callbacks.onPromptReset(actionEl.dataset.mode || 'package');
          break;
        case 'mode-select':
          this.handleModeSelect(actionEl.dataset.mode);
          break;
        case 'send':
          this.requestSend();
          break;
        default:
          break;
      }
    });

    this.refs.settingsForm.addEventListener('submit', event => {
      event.preventDefault();
      this.handleSettingsSave();
    });

    if (this.refs.debugToggle) {
      this.refs.debugToggle.addEventListener('change', event => {
        const checked = event.target.checked;
        this.callbacks.onToggleDebug(checked);
      });
    }

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

    this.refs.sendButton.addEventListener('click', () => this.requestSend());

    if (this.refs.providerSelect) {
      this.refs.providerSelect.addEventListener('change', event => {
        const provider = event.target.value;
        if (typeof this.callbacks.onProviderChange === 'function') {
          this.callbacks.onProviderChange(provider);
        }
        const key = this.providerApiKeys[provider] || '';

        if (this.refs.apiKeyInput) {
          this.refs.apiKeyInput.value = key;
        }
        this.updateProviderBadge(provider);
      });
    }

    if (this.refs.modelSelect) {
      this.refs.modelSelect.addEventListener('change', event => {
        const model = event.target.value;
        if (typeof this.callbacks.onModelChange === 'function') {
          this.callbacks.onModelChange(model);
        }
      });
    }

    document.addEventListener('keydown', this.handleDocumentKeydown);
  }

  buildApi() {
    return {
      appendMessage: message => this.appendMessage(message),
      updateMessage: (id, patch) => this.updateMessage(id, patch),
      attachReferences: (id, references) => this.attachReferences(id, references),
      focusInput: () => this.focusInput(),
      clearInput: () => this.clearInput(),
      setInputDisabled: disabled => this.setInputDisabled(disabled),
      setPrompts: prompts => this.setPrompts(prompts),
      setModels: (providerId, models, activeId) => this.setModels(providerId, models, activeId),
      setSettings: settings => this.setSettings(settings),
      setMode: (mode, meta) => this.setMode(mode, meta),
      setConversations: (items, activeId) => this.setConversations(items, activeId),
      setMessages: messages => this.setMessages(messages),
      setStatus: status => this.setStatus(status),
      setStreaming: streaming => this.setStreaming(streaming),
      setSidebarWidths: widths => this.setSidebarWidths(widths),
      showBanner: (message, tone) => this.showBanner(message, tone),
      hideBanner: () => this.hideBanner(),
      showSettingsNotification: (message, tone) => this.showSettingsNotification(message, tone),
      hideSettingsNotification: () => this.hideSettingsNotification(),
      setButtonLoading: (buttonRef, loading) => this.setButtonLoading(buttonRef, loading),
      closeFlyouts: () => this.closeFlyouts(),
      setDebugVisibility: visible => this.setDebugVisibility(visible),
      setDebugData: data => this.setDebugData(data)
    };
  }
  getFlyout(name) {
    if (name === 'conversations') return this.refs.conversationsFlyout;
    if (name === 'settings') return this.refs.settingsFlyout;
    return null;
  }

  isFlyoutOpen(name) {
    const flyout = this.getFlyout(name);
    return Boolean(flyout && flyout.classList.contains('is-open'));
  }

  setSidebarWidths(widths = {}) {
    if (widths && typeof widths === 'object') {
      this.sidebarWidths = { ...widths };
    } else {
      this.sidebarWidths = {};
    }
  }

  requestSend() {
    if (this.streaming) return;
    const text = (this.refs.input.value || '').trim();
    if (!text) return;
    this.callbacks.onSend(text);
  }

  handleInputChange() {
    const rawValue = this.refs.input.value || '';
    const trimmed = rawValue.trim();
    if (this.refs.sendButton) {
      this.refs.sendButton.disabled = !trimmed || this.streaming;
    }
    if (this.refs.inputCounter) {
      const count = rawValue.length;
      this.refs.inputCounter.textContent = `${count} ${count === 1 ? 'char' : 'chars'}`;
    }
  }

  handleDocumentKeydown(event) {
    if (event.key === 'Escape') {
      this.closeFlyouts();
    }
  }

  toggleFlyout(name, show) {
    const flyout = this.getFlyout(name);
    if (!flyout) return;
    const shouldShow = typeof show === 'boolean' ? show : !flyout.classList.contains('is-open');
    if (shouldShow) {
      this.openFlyout(name);
    } else {
      this.closeFlyout(name);
    }
  }

  openFlyout(name) {
    const flyout = this.getFlyout(name);
    if (!flyout) return;
    if (this.currentFlyout && this.currentFlyout !== name) {
      this.closeFlyout(this.currentFlyout);
    }
    this.previousFocus = document.activeElement;

    // Enhanced modal opening animation
    this.refs.flyoutBackdrop.hidden = false;
    this.currentFlyout = name;

    // Force reflow before animation
    flyout.offsetHeight;

    flyout.classList.add('is-open');
    flyout.setAttribute('aria-hidden', 'false');
    this.applyFlyoutOffsets(name);
    this.setFlyoutToggleState(name, true);

    // Focus management with slight delay for smooth animation
    setTimeout(() => {
      const focusTarget = flyout.querySelector('[data-focus-initial]') || flyout.querySelector('button, input, textarea');
      if (focusTarget && typeof focusTarget.focus === 'function') {
        focusTarget.focus();
      }
    }, 150);
  }

  closeFlyout(name) {
    const flyout = this.getFlyout(name);
    if (!flyout) return;

    // Enhanced modal closing animation
    flyout.classList.remove('is-open');
    flyout.setAttribute('aria-hidden', 'true');
    this.applyFlyoutOffsets(name);
    this.setFlyoutToggleState(name, false);

    if (this.currentFlyout === name) {
      this.currentFlyout = null;

      // Delay backdrop hiding for smooth animation
      setTimeout(() => {
        this.refs.flyoutBackdrop.hidden = true;
        if (this.previousFocus && typeof this.previousFocus.focus === 'function') {
          this.previousFocus.focus();
        }
        this.previousFocus = null;
      }, 250);
    }
  }

  closeFlyouts() {
    FLYOUT_NAMES.forEach(name => this.closeFlyout(name));
    // Ensure backdrop is properly reset
    if (this.refs.flyoutBackdrop) {
      this.refs.flyoutBackdrop.hidden = true;
      this.refs.flyoutBackdrop.style.left = '';
      this.refs.flyoutBackdrop.style.right = '';
    }
  }

  handleModeSelect(mode) {
    if (!mode || mode === this.currentMode) return;
    this.callbacks.onModeChange(mode);
  }

  handleSettingsSave() {
    const provider = this.refs.providerSelect?.value || '';
    const apiKey = this.refs.apiKeyInput?.value.trim() || '';

    if (provider) {
      this.providerApiKeys[provider] = apiKey;
    }
    const prompts = {
      package: {
        name: this.refs.packagePromptName?.value || '',
        content: this.refs.packagePromptContent?.value || ''
      },
      general: {
        name: this.refs.generalPromptName?.value || '',
        content: this.refs.generalPromptContent?.value || ''
      }
    };
    const showDebugPanel = this.refs.debugToggle ? this.refs.debugToggle.checked : false;
    this.callbacks.onSettingsSave({ provider, apiKey, prompts, showDebugPanel });
  }

  setMode(mode, meta = {}) {
    this.currentMode = mode;
    this.modeButtons.forEach((button, key) => {
      const isActive = key === mode;
      button.classList.toggle(MODE_TOGGLE_ACTIVE_CLASS, isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
    if (this.refs.headerTitle && meta.title) {
      this.refs.headerTitle.textContent = meta.title;
    }
    if (this.refs.headerSubtitle && meta.subtitle) {
      this.refs.headerSubtitle.textContent = meta.subtitle;
    }
    if (this.refs.input && meta.placeholder) {
      this.refs.input.setAttribute('placeholder', meta.placeholder);
    }
  }

  setPrompts(prompts = {}) {
    const packagePrompt = prompts.package || {};
    const generalPrompt = prompts.general || {};
    if (this.refs.packagePromptName) {
      this.refs.packagePromptName.value = packagePrompt.name || '';

    }
    if (this.refs.packagePromptContent) {
      this.refs.packagePromptContent.value = packagePrompt.content || '';

    }
    if (this.refs.generalPromptName) {
      this.refs.generalPromptName.value = generalPrompt.name || '';

    }
    if (this.refs.generalPromptContent) {
      this.refs.generalPromptContent.value = generalPrompt.content || '';

    }
  }

  setSettings(settings = {}) {
    if (settings.provider && this.refs.providerSelect) {
      this.refs.providerSelect.value = settings.provider;
    }
    if (settings.apiKeys && typeof settings.apiKeys === 'object') {
      this.providerApiKeys = { ...settings.apiKeys };
      if (this.refs.providerSelect && this.refs.apiKeyInput) {
        const provider = this.refs.providerSelect.value;
        const key = this.providerApiKeys[provider] || '';
        if (this.refs.apiKeyInput) {
          this.refs.apiKeyInput.value = key;
        }
      }
    }
    if (typeof settings.showDebugPanel === 'boolean' && this.refs.debugToggle) {
      this.refs.debugToggle.checked = settings.showDebugPanel;
      this.setDebugVisibility(settings.showDebugPanel);
    }
    this.updateProviderBadge(settings.provider);
  }

  updateProviderBadge(providerId = null) {
    if (!this.refs.providerLabel) {
      return;
    }
    const select = this.refs.providerSelect;
    let resolvedLabel = 'Provider: Not set';
    let hasProvider = false;

    if (select) {
      let matchedOption = select.selectedOptions && select.selectedOptions[0];
      if ((!matchedOption || !matchedOption.value) && providerId) {
        matchedOption = Array.from(select.options || []).find(option => option.value === providerId);
      }
      if (matchedOption && matchedOption.value) {
        resolvedLabel = `Provider: ${matchedOption.textContent.trim()}`;
        hasProvider = true;
      }
    } else if (providerId) {
      resolvedLabel = `Provider: ${providerId}`;
      hasProvider = true;
    }

    this.refs.providerLabel.textContent = resolvedLabel;
    if (this.refs.providerBadge) {
      this.refs.providerBadge.classList.toggle('is-active', hasProvider);
    }
  }

  // Simplified offset management for modal design
  resetFlyoutOffsets() {
    if (this.refs.flyoutBackdrop) {
      this.refs.flyoutBackdrop.hidden = true;
    }
    if (this.refs.card) {
      this.refs.card.classList.remove('chatbot-card--flyout-open');
    }
  }

  applyFlyoutOffsets(name) {
    if (!this.refs.card) {
      return;
    }
    const isOpen = this.isFlyoutOpen(name);
    this.refs.card.classList.toggle('chatbot-card--flyout-open', Boolean(isOpen));
  }

  setFlyoutToggleState(name, expanded) {
    let refKey = null;
    if (name === 'conversations') {
      refKey = 'toggleConversations';
    } else if (name === 'settings') {
      refKey = 'toggleSettings';
    }
    if (!refKey) return;
    const button = this.refs[refKey];
    if (!button) return;
    button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    button.classList.toggle('is-active', Boolean(expanded));
  }

  setModels(providerId, models, activeId) {
    this.currentModelProvider = providerId;
    if (!this.refs.modelSelect) return;
    this.refs.modelSelect.replaceChildren();
    if (!Array.isArray(models) || !models.length) {
      const option = createElem('option', { text: 'No models available' });
      option.value = '';

      this.refs.modelSelect.appendChild(option);
      this.refs.modelSelect.disabled = true;
      return;
    }
    this.refs.modelSelect.disabled = false;
    models.forEach(model => {
      if (!model || typeof model !== 'object') return;
      const option = createElem('option', {
        text: model.label || model.value || 'Model'
      });
      option.value = model.value;
      if (model.tier) {
        option.dataset.tier = model.tier;
      }
      this.refs.modelSelect.appendChild(option);
    });
    if (activeId && models.some(model => model.value === activeId)) {
      this.refs.modelSelect.value = activeId;
    } else if (this.refs.modelSelect.options.length > 0) {
      this.refs.modelSelect.selectedIndex = 0;
    }
    this.updateProviderBadge(providerId);
  }

  setConversations(items = [], activeId) {
    if (!this.refs.conversationList) return;
    this.refs.conversationList.replaceChildren();
    if (!items.length) {
      this.refs.conversationList.appendChild(
        createElem('p', { className: 'chatbot-empty-state', text: 'No conversations yet.' })
      );
      return;
    }
    items.forEach(item => {
      const button = createElem('button', {
        className: 'chatbot-conversation-item',
        dataset: { conversationId: item.id },
        attrs: { type: 'button' }
      });
      if (item.id === activeId) {
        button.classList.add('is-active');
      }
      const title = createElem('span', { className: 'chatbot-conversation-item__title', text: item.title });
      const snippet = createElem('span', {
        className: 'chatbot-conversation-item__snippet',
        text: item.snippet || ''
      });
      button.append(title, snippet);
      this.refs.conversationList.appendChild(button);
    });
  }

  setMessages(messages = []) {
    if (!this.refs.messages) return;
    this.refs.messages.replaceChildren();
    this.messageElements.clear();
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
      element.referencesEl.replaceChildren();
      return;
    }
    element.referencesEl.hidden = false;
    element.referencesEl.replaceChildren();
    const list = createElem('ul', { className: 'chatbot-references' });
    references.forEach(reference => {
      const item = createElem('li', { className: 'chatbot-references__item' });
      const title = createElem('span', {
        className: 'chatbot-references__title',
        text: reference.title || 'Reference'
      });
      const snippet = reference.snippet
        ? createElem('span', {
            className: 'chatbot-references__snippet',
            text: reference.snippet
          })
        : null;
      item.appendChild(title);
      if (snippet) {
        item.appendChild(createElem('span', { text: ' - ' }));
        item.appendChild(snippet);
      }
      list.appendChild(item);
    });
    element.referencesEl.appendChild(list);
  }

  setStatus(status) {
    this.status = status;
    if (!this.refs.card) return;
    this.refs.card.dataset.status = status;
  }

  setStreaming(streaming) {
    this.streaming = streaming;
    if (this.refs.sendButton) {
      this.refs.sendButton.disabled = streaming || !(this.refs.input.value || '').trim();
      // Add loading state visual feedback
      if (streaming) {
        this.refs.sendButton.dataset.loading = 'true';
      } else {
        delete this.refs.sendButton.dataset.loading;
      }
    }
    if (this.refs.input) {
      this.refs.input.readOnly = streaming;
    }
  }

  setButtonLoading(buttonRef, loading) {
    if (!buttonRef) return;
    if (loading) {
      buttonRef.dataset.loading = 'true';
      buttonRef.disabled = true;
    } else {
      delete buttonRef.dataset.loading;
      buttonRef.disabled = false;
    }
  }

  focusInput() {
    if (this.refs.input) {
      this.refs.input.focus();
    }
  }

  clearInput() {
    if (this.refs.input) {
      this.refs.input.value = '';

      this.handleInputChange();
    }
  }

  setInputDisabled(disabled) {
    if (this.refs.input) {
      this.refs.input.disabled = disabled;
    }
    if (this.refs.sendButton) {
      this.refs.sendButton.disabled = disabled;
    }
  }

  showToast(message, tone = 'info', options = {}) {
    if (!this.refs.toastRegion) return;
    const region = this.refs.toastRegion;
    const toneKey = typeof tone === 'string' ? tone : 'info';
    const toast = createElem('div', {
      className: `chatbot-toast chatbot-toast--${toneKey}`,
      dataset: { toast: toneKey }
    });
    const textNode = createElem('span', { className: 'chatbot-toast__message', text: message });
    const dismiss = createElem('button', {
      className: 'chatbot-toast__close',
      dataset: { action: 'dismiss-toast' },
      attrs: { type: 'button', 'aria-label': 'Dismiss notification' }
    });
    dismiss.appendChild(createIcon('close'));
    toast.append(textNode, dismiss);
    while (region.children.length >= 4) {
      const firstToast = region.firstElementChild;
      if (firstToast) {
        this.dismissToast(firstToast);
        break;
      }
    }
    region.appendChild(toast);
    const duration = typeof options.duration === 'number' ? options.duration : 4000;
    if (duration > 0) {
      const timer = setTimeout(() => this.dismissToast(toast), duration);
      this.toastTimers.set(toast, timer);
    }
    requestAnimationFrame(() => toast.classList.add('is-visible'));
  }

  dismissToast(toast) {
    if (!toast || !this.refs.toastRegion) return;
    if (toast.dataset.dismissing === 'true') return;
    toast.dataset.dismissing = 'true';
    if (this.toastTimers.has(toast)) {
      clearTimeout(this.toastTimers.get(toast));
      this.toastTimers.delete(toast);
    }
    toast.classList.add('is-dismissing');
    setTimeout(() => {
      if (toast.parentElement === this.refs.toastRegion) {
        this.refs.toastRegion.removeChild(toast);
      }
    }, 220);
  }

  clearToasts() {
    if (!this.refs.toastRegion) return;
    Array.from(this.refs.toastRegion.querySelectorAll('[data-toast]')).forEach(toast => this.dismissToast(toast));
  }


  showBanner(message, tone = 'info') {
    this.showToast(message, tone);
    if (this.refs.banner) {
      this.refs.banner.hidden = true;
      this.refs.banner.dataset.tone = tone;
      this.refs.banner.textContent = message;
    }
  }

  hideBanner() {
    if (this.refs.banner) {
      this.refs.banner.hidden = true;
      this.refs.banner.textContent = '';
    }
    this.clearToasts();
  }

  showSettingsNotification(message, tone = 'info') {
    const settingsFlyout = this.refs.settingsFlyout;
    if (!settingsFlyout) return;

    let notification = settingsFlyout.querySelector('[data-settings-notification]');
    if (!notification) {
      notification = createElem('div', {
        className: `chatbot-settings-notification chatbot-settings-notification--${tone}`,
        dataset: { settingsNotification: '' }
      });
      settingsFlyout.insertBefore(notification, settingsFlyout.firstChild.nextSibling);
    }

    notification.textContent = message;
    notification.className = `chatbot-settings-notification chatbot-settings-notification--${tone}`;
    notification.hidden = false;

    // Auto-hide after 3 seconds
    setTimeout(() => {
      if (notification) {
        notification.hidden = true;
      }
    }, 3000);
  }

  hideSettingsNotification() {
    const settingsFlyout = this.refs.settingsFlyout;
    if (!settingsFlyout) return;

    const notification = settingsFlyout.querySelector('[data-settings-notification]');
    if (notification) {
      notification.hidden = true;
    }
  }

  setDebugVisibility(visible) {
    this.debugVisible = Boolean(visible);
    if (this.refs.debugPanel) {
      this.refs.debugPanel.hidden = !this.debugVisible;
    }
    if (this.refs.debugToggle) {
      this.refs.debugToggle.checked = this.debugVisible;
    }
  }

  setDebugData(data = null) {
    if (!this.refs.debugPanel) return;
    const content = this.refs.debugPanel.querySelector('[data-debug-content]');
    if (!content) return;
    content.replaceChildren();
    if (!data) {
      content.appendChild(createElem('p', { className: 'chatbot-empty-state', text: 'No debug data yet.' }));
      return;
    }
    const list = createElem('dl', { className: 'chatbot-debug-list' });
    Object.entries(data).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      list.appendChild(createElem('dt', { text: key }));
      list.appendChild(createElem('dd', { text: typeof value === 'string' ? value : JSON.stringify(value) }));
    });
    content.appendChild(list);
  }

  createMessageElement(message) {
    const role = message.role || 'user';
    const root = document.createElement('article');
    root.className = `chatbot-message chatbot-message--${role}`;
    root.dataset.role = role;
    if (message.error) {
      root.classList.add('chatbot-message--error');
    }
    const wrapper = document.createElement('div');
    wrapper.className = 'chatbot-message__wrapper';
    root.appendChild(wrapper);

    const avatar = document.createElement('span');
    avatar.className = 'chatbot-message__avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = getAvatarLabel(role);
    wrapper.appendChild(avatar);

    const bubble = document.createElement('div');
    bubble.className = 'chatbot-message__bubble';
    bubble.dataset.role = role;
    wrapper.appendChild(bubble);

    const metaRow = document.createElement('div');
    metaRow.className = 'chatbot-message__meta-row';
    const roleLabel = document.createElement('span');
    roleLabel.className = 'chatbot-message__role';
    roleLabel.textContent = DEFAULT_MESSAGE_META[role] || 'Message';
    metaRow.appendChild(roleLabel);

    if (message.createdAt) {
      const time = document.createElement('time');
      time.className = 'chatbot-message__time';
      time.dateTime = new Date(message.createdAt).toISOString();
      time.textContent = formatTimeOfDay(message.createdAt);
      metaRow.appendChild(time);
    }
    bubble.appendChild(metaRow);

    const contentEl = document.createElement('div');
    contentEl.className = 'chatbot-message__content';
    renderContent(contentEl, message.content || '');
    bubble.appendChild(contentEl);

    let referencesEl = null;
    if (role === 'assistant') {
      referencesEl = document.createElement('div');
      referencesEl.className = 'chatbot-message__references';
      referencesEl.hidden = !Array.isArray(message.references) || message.references.length === 0;
      bubble.appendChild(referencesEl);
      if (Array.isArray(message.references) && message.references.length) {
        this.attachReferences(message.id, message.references);
      }
    }

    return {
      root,
      contentEl,
      referencesEl
    };
  }

  scrollMessagesToBottom() {
    if (!this.refs?.messages) return;
    const applyScroll = () => {
      this.scrollToBottomRaf = null;
      this.refs.messages.scrollTop = this.refs.messages.scrollHeight;
    };
    if (this.scrollToBottomRaf && typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
      window.cancelAnimationFrame(this.scrollToBottomRaf);
      this.scrollToBottomRaf = null;
    }
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      this.scrollToBottomRaf = window.requestAnimationFrame(applyScroll);
    } else {
      applyScroll();
    }
  }
}
function renderContent(element, text) {
  if (!element) return;
  element.replaceChildren();
  renderMarkdown(element, String(text ?? ''));
}

function renderMarkdown(root, source) {
  const lines = source.split(/\r?\n/);
  const listStack = [];
  let blockquoteBuffer = [];
  let inCodeBlock = false;
  let codeFenceLang = '';
  let codeBuffer = [];

  const closeLists = level => {
    while (listStack.length > level) {
      listStack.pop();
    }
  };

  const ensureList = (type, level) => {
    while (listStack.length > level) {
      listStack.pop();
    }
    let entry = listStack[level];
    if (!entry || entry.type !== type) {
      const listEl = document.createElement(type === 'ol' ? 'ol' : 'ul');
      if (level === 0) {
        root.appendChild(listEl);
      } else {
        const parent = listStack[level - 1];
        if (parent && parent.lastLi) {
          parent.lastLi.appendChild(listEl);
        } else {
          root.appendChild(listEl);
        }
      }
      entry = { listEl, type, level, lastLi: null };
      listStack[level] = entry;
    }
    return entry;
  };

  const flushBlockquote = () => {
    if (!blockquoteBuffer.length) return;
    const blockquote = document.createElement('blockquote');
    renderMarkdown(blockquote, blockquoteBuffer.join('\n'));
    root.appendChild(blockquote);
    blockquoteBuffer = [];
  };

  const flushCodeBlock = () => {
    if (!inCodeBlock) return;
    const pre = document.createElement('pre');
    const code = document.createElement('code');
    if (codeFenceLang) {
      code.dataset.language = codeFenceLang;
    }
    code.textContent = codeBuffer.join('\n');
    pre.appendChild(code);
    root.appendChild(pre);
    inCodeBlock = false;
    codeFenceLang = '';
    codeBuffer = [];
  };

  lines.forEach(line => {
    const codeFenceMatch = line.match(/^```(.*)$/);
    if (codeFenceMatch) {
      if (inCodeBlock) {
        flushCodeBlock();
      } else {
        flushBlockquote();
        closeLists(0);
        inCodeBlock = true;
        codeFenceLang = codeFenceMatch[1].trim();
        codeBuffer = [];
      }
      return;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      return;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      flushBlockquote();
      closeLists(0);
      if (root.lastChild && root.lastChild.tagName !== 'BR') {
        root.appendChild(document.createElement('br'));
      }
      return;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushBlockquote();
      closeLists(0);
      const level = Math.min(headingMatch[1].length, 6);
      const heading = document.createElement(`h${level}`);
      renderInlineMarkdown(heading, headingMatch[2].trim());
      root.appendChild(heading);
      return;
    }

    if (trimmed.startsWith('>')) {
      closeLists(0);
      const content = trimmed.replace(/^>\s?/, '');
      blockquoteBuffer.push(content);
      return;
    }

    flushBlockquote();

    const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
    if (listMatch) {
      const indent = listMatch[1] || '';
      const level = Math.min(Math.floor(indent.length / 2), 6);
      const marker = listMatch[2];
      const type = marker.endsWith('.') ? 'ol' : 'ul';
      const content = listMatch[3];
      const listEntry = ensureList(type, level);
      const li = document.createElement('li');
      renderInlineMarkdown(li, content.trim());
      listEntry.listEl.appendChild(li);
      listEntry.lastLi = li;
      listStack.length = level + 1;
      return;
    }

    closeLists(0);
    const paragraph = document.createElement('p');
    renderInlineMarkdown(paragraph, trimmed);
    root.appendChild(paragraph);
  });

  flushBlockquote();
  flushCodeBlock();
  closeLists(0);
}

function renderInlineMarkdown(root, text) {
  const parts = text.split(/(`[^`]+`)/g);
  parts.forEach(part => {
    if (!part) return;
    if (part.startsWith('`') && part.endsWith('`')) {
      const code = document.createElement('code');
      code.textContent = part.slice(1, -1);
      root.appendChild(code);
      return;
    }
    const boldSegments = part.split(/(\*\*[^*]+\*\*)/g);
    boldSegments.forEach(segment => {
      if (!segment) return;
      if (segment.startsWith('**') && segment.endsWith('**')) {
        const strong = document.createElement('strong');
        renderInlineMarkdown(strong, segment.slice(2, -2));
        root.appendChild(strong);
        return;
      }
      const italicSegments = segment.split(/(\*[^*]+\*)/g);
      italicSegments.forEach(piece => {
        if (!piece) return;
        if (piece.startsWith('*') && piece.endsWith('*')) {
          const em = document.createElement('em');
          renderInlineMarkdown(em, piece.slice(1, -1));
          root.appendChild(em);
        } else {
          root.appendChild(document.createTextNode(piece));
        }
      });
    });
  });
}

function getAvatarLabel(role) {
  if (role === 'assistant') return 'AI';
  if (role === 'user') return 'ME';
  if (role === 'system') return 'SYS';
  const label = DEFAULT_MESSAGE_META[role] || role || '';
  return label.slice(0, 2).toUpperCase() || 'AI';
}


function formatTimeOfDay(timestamp) {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (error) {
    return '';

  }
}

function createUid(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function createElem(tag, options = {}) {
  const element = document.createElement(tag);
  if (options.className) {
    element.className = options.className;
  }
  if (options.text) {
    element.textContent = options.text;
  }
  if (options.dataset && typeof options.dataset === 'object') {
    Object.entries(options.dataset).forEach(([key, value]) => {
      if (value !== undefined) {
        element.dataset[key] = value;
      }
    });
  }
  if (options.attrs && typeof options.attrs === 'object') {
    Object.entries(options.attrs).forEach(([key, value]) => {
      if (value !== undefined) {
        element.setAttribute(key, value);
      }
    });
  }
  return element;
}

function createIcon(name, options = {}) {
  const spec = ICON_SPECS[name] || [];
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.classList.add('chatbot-icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', options.stroke || 'currentColor');
  svg.setAttribute('stroke-width', options.strokeWidth || 1.6);
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');

  spec.forEach(part => {
    const elName = part.el || 'path';
    const attrs = part.attrs || {};
    const node = document.createElementNS(SVG_NS, elName);
    Object.entries(attrs).forEach(([attr, value]) => {
      node.setAttribute(attr, String(value));
    });
    if (!('fill' in attrs) && (elName === 'path' || elName === 'rect' || elName === 'circle' || elName === 'polyline')) {
      node.setAttribute('fill', 'none');
    }
    if (!('stroke' in attrs)) {
      node.setAttribute('stroke', options.stroke || 'currentColor');
    }
    svg.appendChild(node);
  });

  return svg;
}

function buildNullApi() {
  const noop = () => {};
  return {
    appendMessage: noop,
    updateMessage: noop,
    attachReferences: noop,
    focusInput: noop,
    clearInput: noop,
    setInputDisabled: noop,
    setPrompts: noop,
    setModels: noop,
    setSettings: noop,
    setMode: noop,
    setConversations: noop,
    setMessages: noop,
    setStatus: noop,
    setStreaming: noop,
    setSidebarWidths: noop,
    showBanner: noop,
    hideBanner: noop,
    closeFlyouts: noop,
    setDebugVisibility: noop,
    setDebugData: noop
  };
}
