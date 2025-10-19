const FLYOUT_NAMES = ['conversations', 'settings'];
const MODE_TOGGLE_ACTIVE_CLASS = 'chatbot-mode-toggle__button--active';
const PROMPT_SAVE_DELAY = 800;
const ICON_SPECS = {
  conversations: [
    { el: 'path', attrs: { d: 'M5 4h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-6l-4 4v-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z' } },
    { el: 'circle', attrs: { cx: 9, cy: 9.5, r: 0.85 } },
    { el: 'circle', attrs: { cx: 12, cy: 9.5, r: 0.85 } },
    { el: 'circle', attrs: { cx: 15, cy: 9.5, r: 0.85 } }
  ],
  settings: [
    { el: 'line', attrs: { x1: 4, y1: 7, x2: 20, y2: 7 } },
    { el: 'circle', attrs: { cx: 9, cy: 7, r: 1.7 } },
    { el: 'line', attrs: { x1: 4, y1: 12, x2: 20, y2: 12 } },
    { el: 'circle', attrs: { cx: 15, cy: 12, r: 1.7 } },
    { el: 'line', attrs: { x1: 4, y1: 17, x2: 20, y2: 17 } },
    { el: 'circle', attrs: { cx: 11, cy: 17, r: 1.7 } }
  ],
  newConversation: [
    { el: 'path', attrs: { d: 'M5 4h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-6l-4 4v-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z' } },
    { el: 'line', attrs: { x1: 12, y1: 8.2, x2: 12, y2: 12.8 } },
    { el: 'line', attrs: { x1: 9.2, y1: 10.5, x2: 14.8, y2: 10.5 } }
  ],
  export: [
    { el: 'line', attrs: { x1: 12, y1: 5, x2: 12, y2: 15 } },
    { el: 'polyline', attrs: { points: '8 11 12 15 16 11' } },
    { el: 'line', attrs: { x1: 6, y1: 19, x2: 18, y2: 19 } }
  ],
  copy: [
    { el: 'rect', attrs: { x: 9, y: 6.5, width: 9.5, height: 11.5, rx: 2 } },
    { el: 'path', attrs: { d: 'M6 9V6a2 2 0 0 1 2-2h7.5' } },
    { el: 'path', attrs: { d: 'M6 9h-1a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9.5' } }
  ],
  chevronDown: [
    { el: 'polyline', attrs: { points: '6 9 12 15 18 9' } }
  ],
  chevronUp: [
    { el: 'polyline', attrs: { points: '6 15 12 9 18 15' } }
  ],
  check: [
    { el: 'polyline', attrs: { points: '6 12 10 16 18 8' } }
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
    this.providers = Array.isArray(options.providers) ? options.providers : [];
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
      modelSelect: createUid('chatbot-model'),
      modelSelectLabel: createUid('chatbot-model-label')
    };

    this.messageElements = new Map();
    this.modeButtons = new Map();
    this.promptEditors = {
      package: null,
      general: null
    };
    this.promptSnapshots = {
      package: { name: '', content: '' },
      general: { name: '', content: '' }
    };

    this.currentMode = null;
    this.currentFlyout = null;
    this.currentProvider = null;
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
    this.apiKeyInputs = new Map();
    this.promptSaveTimers = new Map();
    this.registeredListeners = [];
    this.providerOptionButtons = new Map();
    this.modelOptionButtons = new Map();
    this.openMenus = {
      provider: false,
      model: false
    };

    this.handleDocumentKeydown = this.handleDocumentKeydown.bind(this);
    this.handleDocumentPointerDown = this.handleDocumentPointerDown.bind(this);
  }

  addListener(target, event, handler, options) {
    if (!target || typeof target.addEventListener !== 'function' || typeof handler !== 'function') {
      return;
    }
    target.addEventListener(event, handler, options);
    this.registeredListeners.push({ target, event, handler, options });
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

    const providerControl = this.buildProviderControl();
    const providerLabel = providerControl.label;

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

    const headerControls = createElem('div', { className: 'chatbot-header__controls' });
    headerControls.append(providerControl.badge, headerActions);

    commandRight.append(headerControls, providerControl.picker, toastRegion);
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
    const modelLabel = createElem('span', {
      className: 'chatbot-input__label',
      attrs: { id: this.ids.modelSelectLabel },
      text: 'Model'
    });
    const modelControl = this.buildModelControl();
    controlRow.append(modelLabel, modelControl.wrapper);

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
      text: 'Enter to send  Shift+Enter for newline'
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
      providerBadge: providerControl.badge,
      providerPicker: providerControl.picker,
      providerPickerList: providerControl.list,
      providerLabel,
      modelButton: modelControl.button,
      modelButtonLabel: modelControl.label,
      modelMenu: modelControl.menu,
      modelMenuList: modelControl.list,
      inputCounter: counter,
      messages,
      input: inputTextarea,
      sendButton,
      flyoutBackdrop: backdrop,
      conversationsFlyout: conversationsFlyout,
      conversationList: conversationsFlyout.querySelector('[data-conversation-list]'),
      settingsFlyout,
      settingsForm: settingsFlyout.querySelector('[data-settings-form]'),
      debugToggle: settingsBuild.debugToggle,
      debugPanel: settingsBuild.debugPanel,
      packagePromptName: settingsBuild.promptEditors.package?.nameInput || null,
      packagePromptContent: settingsBuild.promptEditors.package?.contentInput || null,
      generalPromptName: settingsBuild.promptEditors.general?.nameInput || null,
      generalPromptContent: settingsBuild.promptEditors.general?.contentInput || null,
      promptResetButtons: settingsFlyout.querySelectorAll('[data-action="prompt-reset"]')
    };

    if (this.refs.modelButton) {
      this.refs.modelButton.classList.add('is-disabled');
      this.refs.modelButton.setAttribute('aria-disabled', 'true');
      if (this.refs.modelButtonLabel) {
        this.refs.modelButtonLabel.textContent = 'Loading models...';
      }
    }
  }

  buildProviderControl() {
    const badge = createElem('button', {
      className: 'chatbot-provider-pill',
      dataset: { providerBadge: '', action: 'provider-toggle' },
      attrs: {
        type: 'button',
        'aria-haspopup': 'listbox',
        'aria-expanded': 'false'
      }
    });
    const icon = createIcon('provider');
    icon.classList.add('chatbot-provider-pill__icon');
    const label = createElem('span', {
      className: 'chatbot-provider-pill__label',
      text: 'Provider: Not set'
    });
    const caret = createElem('span', { className: 'chatbot-provider-pill__caret' });
    caret.appendChild(createIcon('chevronDown'));
    badge.append(icon, label, caret);

    const picker = createElem('div', {
      className: 'chatbot-provider-menu',
      dataset: { providerPicker: '' },
      attrs: {
        role: 'listbox',
        'aria-label': 'Select provider'
      }
    });
    picker.hidden = true;
    const list = createElem('ul', { className: 'chatbot-provider-menu__list' });
    picker.appendChild(list);

    this.providerOptionButtons.clear();
    if (Array.isArray(this.providers) && this.providers.length) {
      this.providers.forEach((provider, index) => {
        if (!provider || !provider.id) return;
        const item = createElem('li', { className: 'chatbot-provider-menu__item' });
        const optionButton = createElem('button', {
          className: 'chatbot-provider-menu__option',
          dataset: { providerOption: provider.id },
          attrs: {
            type: 'button',
            role: 'option',
            'data-index': String(index),
            'aria-selected': 'false'
          }
        });
        const info = createElem('span', { className: 'chatbot-provider-menu__option-info' });
        const optionLabel = createElem('span', {
          className: 'chatbot-provider-menu__option-label',
          text: provider.label || provider.id
        });
        info.appendChild(optionLabel);
        if (provider.description) {
          info.appendChild(
            createElem('span', {
              className: 'chatbot-provider-menu__option-meta',
              text: provider.description
            })
          );
        }
        optionButton.appendChild(info);
        const check = createElem('span', { className: 'chatbot-provider-menu__option-check' });
        check.appendChild(createIcon('check'));
        optionButton.appendChild(check);
        item.appendChild(optionButton);
        list.appendChild(item);
        this.providerOptionButtons.set(provider.id, optionButton);
      });
    } else {
      picker.appendChild(
        createElem('div', {
          className: 'chatbot-provider-menu__empty',
          text: 'No providers available.'
        })
      );
    }

    return {
      badge,
      picker,
      list,
      label
    };
  }

  buildModelControl() {
    const wrapper = createElem('div', { className: 'chatbot-input__model-select' });
    const button = createElem('button', {
      className: 'chatbot-model-button',
      dataset: { modelButton: '', action: 'model-toggle' },
      attrs: {
        type: 'button',
        'aria-haspopup': 'listbox',
        'aria-expanded': 'false',
        'aria-labelledby': this.ids.modelSelectLabel
      }
    });
    const label = createElem('span', {
      className: 'chatbot-model-button__label',
      dataset: { modelButtonLabel: '' },
      text: 'Loading models...'
    });
    const icon = createElem('span', { className: 'chatbot-model-button__icon' });
    icon.appendChild(createIcon('chevronDown'));
    button.append(label, icon);

    const menu = createElem('div', {
      className: 'chatbot-model-menu',
      dataset: { modelMenu: '' },
      attrs: {
        role: 'listbox',
        'aria-label': 'Select model'
      }
    });
    menu.hidden = true;
    const list = createElem('ul', { className: 'chatbot-model-menu__list' });
    menu.appendChild(list);

    wrapper.append(button, menu);

    return {
      wrapper,
      button,
      menu,
      list,
      label
    };
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
    connectionSection.appendChild(createElem('h5', { text: 'API Keys' }));
    connectionSection.appendChild(
      createElem('p', {
        className: 'chatbot-settings__hint',
        text: 'Keys save automatically after you leave the field or paste a value.'
      })
    );

    const keyGrid = createElem('div', { className: 'chatbot-settings__key-grid' });
    this.apiKeyInputs.clear();

    if (Array.isArray(this.providers) && this.providers.length) {
      this.providers.forEach(provider => {
        if (!provider || !provider.id) return;
        const row = createElem('div', { className: 'chatbot-settings__key-row' });
        const name = createElem('span', {
          className: 'chatbot-settings__key-name',
          text: provider.label || provider.id
        });
        const inline = createElem('div', { className: 'chatbot-settings__inline' });
        const input = createElem('input', {
          className: 'chatbot-input-field',
          attrs: {
            type: 'password',
            name: 'api-key-' + provider.id,
            placeholder: 'Paste ' + (provider.label || provider.id) + ' API key',
            spellcheck: 'false',
            autocomplete: 'off'
          },
          dataset: { apiKeyProvider: provider.id }
        });
        const clearButton = createElem('button', {
          className: 'chatbot-button chatbot-button--subtle',
          dataset: { action: 'clear-key', provider: provider.id },
          attrs: { type: 'button' },
          text: 'Clear'
        });
        inline.append(input, clearButton);
        row.append(name, inline);
        if (provider.description) {
          row.appendChild(
            createElem('span', {
              className: 'chatbot-settings__key-meta',
              text: provider.description
            })
          );
        }
        keyGrid.appendChild(row);
        this.apiKeyInputs.set(provider.id, input);
      });
    } else {
      keyGrid.appendChild(
        createElem('p', {
          className: 'chatbot-settings__hint',
          text: 'No providers configured.'
        })
      );
    }

    connectionSection.appendChild(keyGrid);

    const debugToggleLabel = createElem('label', { className: 'chatbot-settings__switch' });
    const debugCheckbox = createElem('input', {
      attrs: { type: 'checkbox', name: 'debug-toggle' },
      dataset: { debugToggle: '' }
    });
    debugToggleLabel.append(debugCheckbox, createElem('span', { text: 'Show Debug Panel' }));
    connectionSection.appendChild(debugToggleLabel);

    const promptSection = createElem('section', {
      className: 'chatbot-settings__group'
    });
    promptSection.appendChild(createElem('h5', { text: 'Assistant Prompts' }));
    promptSection.appendChild(
      createElem('p', {
        className: 'chatbot-settings__hint',
        text: 'Edits auto-save after a short pause. Use reset to restore defaults.'
      })
    );
    const packageEditor = this.buildPromptEditor('package', 'Package Assistant Prompt');
    const generalEditor = this.buildPromptEditor('general', 'General Assistant Prompt');
    promptSection.append(packageEditor.root, generalEditor.root);

    const actions = createElem('div', { className: 'chatbot-settings__actions' });
    const closeButton = createElem('button', {
      className: 'chatbot-button chatbot-button--subtle',
      dataset: { action: 'close-flyout' },
      attrs: { type: 'button' },
      text: 'Close'
    });
    actions.append(closeButton);

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

    this.addListener(this.refs.card, 'click', event => {
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
        case 'provider-toggle':
          this.toggleProviderPicker();
          break;
        case 'model-toggle':
          this.toggleModelMenu();
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
        case 'clear-key': {
          const providerId = actionEl.dataset.provider || null;
          this.clearApiKey(providerId);
          break;
        }
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

    this.addListener(this.refs.settingsForm, 'submit', event => {
      event.preventDefault();
      this.handleSettingsSave();
    });

    if (this.refs.debugToggle) {
      this.addListener(this.refs.debugToggle, 'change', event => {
        const checked = event.target.checked;
        this.callbacks.onToggleDebug(checked);
      });
    }

    this.addListener(this.refs.conversationList, 'click', event => {
      const button = event.target.closest('[data-conversation-id]');
      if (!button) return;
      const id = button.dataset.conversationId;
      this.closeFlyouts();
      this.callbacks.onSelectConversation(id);
    });

    this.addListener(this.refs.flyoutBackdrop, 'click', () => {
      this.closeFlyouts();
    });

    this.addListener(this.refs.input, 'input', () => this.handleInputChange());
    this.addListener(this.refs.input, 'keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        this.requestSend();
      }
    });

    this.addListener(this.refs.sendButton, 'click', () => this.requestSend());

    if (this.refs.providerPickerList) {
      this.addListener(this.refs.providerPickerList, 'click', event => {
        const button = event.target.closest('[data-provider-option]');
        if (!button) return;
        event.preventDefault();
        const providerId = button.dataset.providerOption;
        this.selectProviderOption(providerId);
      });
      this.addListener(this.refs.providerPickerList, 'keydown', event => {
        if (!this.openMenus.provider) return;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          this.focusProviderOption(event.key === 'ArrowDown' ? 1 : -1);
        } else if (event.key === 'Home') {
          event.preventDefault();
          this.focusProviderOption('start');
        } else if (event.key === 'End') {
          event.preventDefault();
          this.focusProviderOption('end');
        } else if (event.key === 'Escape') {
          event.preventDefault();
          this.closeProviderPicker();
          this.refs.providerBadge?.focus();
        } else if (event.key === 'Enter' || event.key === ' ') {
          const button = event.target.closest('[data-provider-option]');
          if (button) {
            event.preventDefault();
            this.selectProviderOption(button.dataset.providerOption);
          }
        }
      });
    }

    if (this.refs.providerBadge) {
      this.addListener(this.refs.providerBadge, 'keydown', event => {
        if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          this.openProviderPicker();
        } else if (event.key === 'Escape') {
          this.closeProviderPicker();
        }
      });
    }

    if (this.refs.modelButton) {
      this.addListener(this.refs.modelButton, 'keydown', event => {
        if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          this.openModelMenu();
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          this.openModelMenu({ focusLast: true });
        } else if (event.key === 'Escape') {
          this.closeModelMenu();
        }
      });
    }

    if (this.refs.modelMenuList) {
      this.addListener(this.refs.modelMenuList, 'click', event => {
        const button = event.target.closest('[data-model-option]');
        if (!button) return;
        event.preventDefault();
        this.selectModelOption(button.dataset.modelOption);
      });
      this.addListener(this.refs.modelMenuList, 'keydown', event => {
        if (!this.openMenus.model) return;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          this.focusModelOption(event.key === 'ArrowDown' ? 1 : -1);
        } else if (event.key === 'Home') {
          event.preventDefault();
          this.focusModelOption('start');
        } else if (event.key === 'End') {
          event.preventDefault();
          this.focusModelOption('end');
        } else if (event.key === 'Escape') {
          event.preventDefault();
          this.closeModelMenu();
          this.refs.modelButton?.focus();
        } else if (event.key === 'Enter' || event.key === ' ') {
          const button = event.target.closest('[data-model-option]');
          if (button) {
            event.preventDefault();
            this.selectModelOption(button.dataset.modelOption);
          }
        }
      });
    }

    this.apiKeyInputs.forEach((input, providerId) => {
      if (!input) return;
      this.addListener(input, 'blur', () => this.persistApiKey(providerId, { silent: false }));
      this.addListener(input, 'paste', () => {
        setTimeout(() => this.persistApiKey(providerId, { silent: false }), 0);
      });
      this.addListener(input, 'keydown', event => {
        if (event.key === 'Enter') {
          event.preventDefault();
          this.persistApiKey(providerId, { silent: false });
          input.blur();
        }
      });
    });

    Object.entries(this.promptEditors).forEach(([mode, editor]) => {
      if (!editor) return;
      if (editor.nameInput) {
        this.addListener(editor.nameInput, 'input', () => this.schedulePromptSave(mode));
        this.addListener(editor.nameInput, 'blur', () => this.flushPromptSave(mode));
      }
      if (editor.contentInput) {
        this.addListener(editor.contentInput, 'input', () => this.schedulePromptSave(mode));
        this.addListener(editor.contentInput, 'blur', () => this.flushPromptSave(mode));
      }
    });

    this.addListener(document, 'pointerdown', this.handleDocumentPointerDown, true);
    this.addListener(document, 'keydown', this.handleDocumentKeydown);
  }

  teardown() {
    if (Array.isArray(this.registeredListeners)) {
      this.registeredListeners.forEach(({ target, event, handler, options }) => {
        if (target && typeof target.removeEventListener === 'function') {
          target.removeEventListener(event, handler, options);
        }
      });
      this.registeredListeners = [];
    }

    this.handlersBound = false;

    this.toastTimers.forEach(timer => clearTimeout(timer));
    this.toastTimers.clear();

    this.promptSaveTimers.forEach(timer => clearTimeout(timer));
    this.promptSaveTimers.clear();

    if (this.scrollToBottomRaf && typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
      window.cancelAnimationFrame(this.scrollToBottomRaf);
    }
    this.scrollToBottomRaf = null;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    this.clearToasts();
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
      setDebugData: data => this.setDebugData(data),
      teardown: () => this.teardown()
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
      let handled = false;
      if (this.openMenus.provider) {
        this.closeProviderPicker();
        this.refs.providerBadge?.focus();
        handled = true;
      }
      if (this.openMenus.model) {
        this.closeModelMenu();
        this.refs.modelButton?.focus();
        handled = true;
      }
      if (!handled) {
        this.closeFlyouts();
      }
    }
  }

  handleDocumentPointerDown(event) {
    const target = event.target;
    if (this.openMenus.provider) {
      const withinPicker =
        this.refs.providerPicker?.contains(target) ||
        this.refs.providerBadge === target ||
        this.refs.providerBadge?.contains(target);
      if (!withinPicker) {
        this.closeProviderPicker();
      }
    }
    if (this.openMenus.model) {
      const withinMenu =
        this.refs.modelMenu?.contains(target) ||
        this.refs.modelButton === target ||
        this.refs.modelButton?.contains(target);
      if (!withinMenu) {
        this.closeModelMenu();
      }
    }
  }

  toggleProviderPicker(show) {
    const shouldOpen = typeof show === 'boolean' ? show : !this.openMenus.provider;
    if (shouldOpen) {
      this.openProviderPicker();
    } else {
      this.closeProviderPicker();
    }
  }

  openProviderPicker() {
    if (!this.refs.providerPicker || !this.refs.providerBadge) return;
    if (this.openMenus.provider) return;
    this.closeModelMenu();
    this.refs.providerPicker.hidden = false;
    this.refs.providerPicker.classList.add('is-open');
    this.refs.providerBadge.setAttribute('aria-expanded', 'true');
    this.openMenus.provider = true;
    const buttons = this.getOrderedProviderButtons();
    const activeButton =
      buttons.find(entry => entry.id === this.currentProvider)?.button || buttons[0]?.button;
    if (activeButton) {
      requestAnimationFrame(() => activeButton.focus());
    }
  }

  closeProviderPicker() {
    if (!this.openMenus.provider) return;
    if (this.refs.providerPicker) {
      this.refs.providerPicker.hidden = true;
      this.refs.providerPicker.classList.remove('is-open');
    }
    if (this.refs.providerBadge) {
      this.refs.providerBadge.setAttribute('aria-expanded', 'false');
    }
    this.openMenus.provider = false;
  }

  selectProviderOption(providerId) {
    if (!providerId) return;
    this.closeProviderPicker();
    this.updateProviderBadge(providerId);
    this.updateProviderPickerSelection(providerId);
    if (this.currentProvider !== providerId) {
      this.currentProvider = providerId;
    }
    if (typeof this.callbacks.onProviderChange === 'function') {
      this.callbacks.onProviderChange(providerId);
    }
  }

  focusProviderOption(step) {
    const entries = this.getOrderedProviderButtons();
    if (!entries.length) return;
    let targetIndex = -1;
    if (step === 'start') {
      targetIndex = 0;
    } else if (step === 'end') {
      targetIndex = entries.length - 1;
    } else if (typeof step === 'number') {
      const activeElement = document.activeElement;
      let currentIndex = entries.findIndex(entry => entry.button === activeElement);
      if (currentIndex === -1) {
        currentIndex = entries.findIndex(entry => entry.id === this.currentProvider);
      }
      if (currentIndex === -1) {
        currentIndex = 0;
      }
      targetIndex = (currentIndex + step + entries.length) % entries.length;
    }
    if (targetIndex >= 0 && targetIndex < entries.length) {
      entries[targetIndex].button.focus();
    }
  }

  getOrderedProviderButtons() {
    return Array.from(this.providerOptionButtons.entries())
      .map(([id, button]) => ({
        id,
        button,
        index: Number(button?.dataset?.index || 0)
      }))
      .filter(entry => entry.button)
      .sort((a, b) => a.index - b.index);
  }

  updateProviderPickerSelection(activeId) {
    this.providerOptionButtons.forEach((button, id) => {
      const isActive = id === activeId;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
  }

  toggleModelMenu(show) {
    const shouldOpen = typeof show === 'boolean' ? show : !this.openMenus.model;
    if (shouldOpen) {
      this.openModelMenu();
    } else {
      this.closeModelMenu();
    }
  }

  openModelMenu(options = {}) {
    if (!this.refs.modelMenu || !this.refs.modelButton) return;
    if (this.openMenus.model) return;
    this.closeProviderPicker();
    this.refs.modelMenu.hidden = false;
    this.refs.modelMenu.classList.add('is-open');
    this.refs.modelButton.setAttribute('aria-expanded', 'true');
    this.openMenus.model = true;
    const entries = this.getOrderedModelButtons();
    let targetButton = null;
    if (options.focusLast && entries.length) {
      targetButton = entries[entries.length - 1].button;
    } else {
      targetButton =
        entries.find(entry => entry.id === this.refs.modelButton?.dataset?.modelActive)?.button ||
        entries[0]?.button;
    }
    if (targetButton) {
      requestAnimationFrame(() => targetButton.focus());
    }
  }

  closeModelMenu() {
    if (!this.openMenus.model) return;
    if (this.refs.modelMenu) {
      this.refs.modelMenu.hidden = true;
      this.refs.modelMenu.classList.remove('is-open');
    }
    if (this.refs.modelButton) {
      this.refs.modelButton.setAttribute('aria-expanded', 'false');
    }
    this.openMenus.model = false;
  }

  selectModelOption(modelId) {
    if (!modelId) return;
    this.closeModelMenu();
    const activeModel = this.modelOptions.find(model => model.value === modelId) || null;
    this.updateModelDisplay(activeModel || null, !activeModel);
    this.updateModelMenuSelection(activeModel ? activeModel.value : null);
    if (typeof this.callbacks.onModelChange === 'function') {
      this.callbacks.onModelChange(modelId);
    }
  }

  focusModelOption(step) {
    const entries = this.getOrderedModelButtons();
    if (!entries.length) return;
    let targetIndex = -1;
    if (step === 'start') {
      targetIndex = 0;
    } else if (step === 'end') {
      targetIndex = entries.length - 1;
    } else if (typeof step === 'number') {
      const activeElement = document.activeElement;
      let currentIndex = entries.findIndex(entry => entry.button === activeElement);
      if (currentIndex === -1) {
        currentIndex = entries.findIndex(entry => entry.id === this.refs.modelButton?.dataset?.modelActive);
      }
      if (currentIndex === -1) {
        currentIndex = 0;
      }
      targetIndex = (currentIndex + step + entries.length) % entries.length;
    }
    if (targetIndex >= 0 && targetIndex < entries.length) {
      entries[targetIndex].button.focus();
    }
  }


  getProviderLabel(providerId) {
    const catalog = Array.isArray(this.providers) ? this.providers : [];
    const match = catalog.find(entry => entry && entry.id === providerId);
    if (match && (match.label || match.id)) {
      return match.label || match.id;
    }
    return providerId || 'Provider';
  }

  persistApiKey(providerId, options = {}) {
    const target = providerId || this.currentProvider;
    if (!target) return;
    const input = this.apiKeyInputs.get(target);
    if (!input) return;
    const trimmed = (input.value || '').trim();
    input.value = trimmed;
    const previous = this.providerApiKeys[target] || '';
    if (previous === trimmed) {
      return;
    }
    this.providerApiKeys[target] = trimmed;
    if (typeof this.callbacks.onSettingsSave === 'function') {
      this.callbacks.onSettingsSave({
        provider: this.currentProvider || target,
        targetProvider: target,
        apiKey: trimmed
      });
    }
    const silent = Boolean(options && options.silent);
    if (!silent) {
      const label = this.getProviderLabel(target);
      const hasValue = trimmed.length > 0;
      const message = hasValue ? label + ' API key saved.' : label + ' API key cleared.';
      this.showToast(message, hasValue ? 'success' : 'info');
    }
  }

  clearApiKey(providerId) {
    const target = providerId || this.currentProvider;
    if (!target) return;
    const input = this.apiKeyInputs.get(target);
    if (input) {
      input.value = '';
    }
    this.providerApiKeys[target] = '';
    if (typeof this.callbacks.onClearApiKey === 'function') {
      this.callbacks.onClearApiKey(target);
    } else if (typeof this.callbacks.onSettingsSave === 'function') {
      this.callbacks.onSettingsSave({
        provider: this.currentProvider || target,
        targetProvider: target,
        apiKey: ''
      });
    }
    const label = this.getProviderLabel(target);
    this.showToast(label + ' API key cleared.', 'info');
  }

  schedulePromptSave(mode) {
    if (!mode || !this.promptEditors[mode]) return;
    if (this.promptSaveTimers.has(mode)) {
      clearTimeout(this.promptSaveTimers.get(mode));
    }
    const timer = setTimeout(() => {
      this.promptSaveTimers.delete(mode);
      this.persistPrompt(mode);
    }, PROMPT_SAVE_DELAY);
    this.promptSaveTimers.set(mode, timer);
  }

  flushPromptSave(mode, options = {}) {
    if (!mode || !this.promptEditors[mode]) return;
    if (this.promptSaveTimers.has(mode)) {
      clearTimeout(this.promptSaveTimers.get(mode));
      this.promptSaveTimers.delete(mode);
    }
    this.persistPrompt(mode, options);
  }

  persistPrompt(mode, options = {}) {
    const editor = this.promptEditors[mode];
    if (!editor) return;
    const nameValue = (editor.nameInput?.value || '').trim();
    const contentValue = (editor.contentInput?.value || '').trim();
    const snapshot = this.promptSnapshots[mode] || { name: '', content: '' };
    if (snapshot.name === nameValue && snapshot.content === contentValue) {
      return;
    }
    this.promptSnapshots[mode] = { name: nameValue, content: contentValue };
    if (typeof this.callbacks.onSettingsSave === 'function') {
      this.callbacks.onSettingsSave({
        provider: this.currentProvider,
        prompts: { [mode]: { name: nameValue, content: contentValue } }
      });
    }
    const silent = Boolean(options && options.silent);
    if (!silent) {
      const label = this.getModeLabel(mode);
      this.showToast(label + ' prompt saved.', 'success');
    }
  }

  getModeLabel(mode) {
    const list = Array.isArray(this.modes) ? this.modes : [];
    const match = list.find(entry => entry && entry.id === mode);
    return match?.label || mode;
  }

  getOrderedModelButtons() {
    return Array.from(this.modelOptionButtons.entries())
      .map(([id, button]) => ({
        id,
        button,
        index: Number(button?.dataset?.index || 0)
      }))
      .filter(entry => entry.button)
      .sort((a, b) => a.index - b.index);
  }

  updateModelDisplay(model, disabled) {
    if (this.refs.modelButtonLabel) {
      this.refs.modelButtonLabel.textContent = model
        ? model.label || model.value || 'Model'
        : disabled
        ? 'No models available'
        : 'Select model';
    }
    if (this.refs.modelButton) {
      if (disabled) {
        this.refs.modelButton.classList.add('is-disabled');
        this.refs.modelButton.setAttribute('aria-disabled', 'true');
      } else {
        this.refs.modelButton.classList.remove('is-disabled');
        this.refs.modelButton.removeAttribute('aria-disabled');
      }
      if (model && model.value) {
        this.refs.modelButton.dataset.modelActive = model.value;
      } else {
        delete this.refs.modelButton.dataset.modelActive;
      }
    }
  }

  updateModelMenuSelection(activeId) {
    this.modelOptionButtons.forEach((button, id) => {
      const isActive = id === activeId;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
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
    this.closeProviderPicker();
    this.closeModelMenu();
  }

  handleModeSelect(mode) {
    if (!mode || mode === this.currentMode) return;
    this.callbacks.onModeChange(mode);
  }

  handleSettingsSave() {
    this.apiKeyInputs.forEach((_, providerId) => this.persistApiKey(providerId, { silent: true }));
    this.flushPromptSave('package', { silent: true });
    this.flushPromptSave('general', { silent: true });
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
    this.promptSnapshots.package = {
      name: (this.refs.packagePromptName?.value || '').trim(),
      content: (this.refs.packagePromptContent?.value || '').trim()
    };
    this.promptSnapshots.general = {
      name: (this.refs.generalPromptName?.value || '').trim(),
      content: (this.refs.generalPromptContent?.value || '').trim()
    };
  }

  setSettings(settings = {}) {
    if (settings.provider) {
      this.currentProvider = settings.provider;
    }
    if (settings.apiKeys && typeof settings.apiKeys === 'object') {
      this.providerApiKeys = { ...settings.apiKeys };
      this.apiKeyInputs.forEach((input, providerId) => {
        if (!input) return;
        input.value = this.providerApiKeys[providerId] || '';
      });
    }
    if (typeof settings.showDebugPanel === 'boolean' && this.refs.debugToggle) {
      this.refs.debugToggle.checked = settings.showDebugPanel;
      this.setDebugVisibility(settings.showDebugPanel);
    }
    this.updateProviderBadge(settings.provider);
  }

  updateProviderBadge(providerId = null) {
    const resolvedId = providerId || this.currentProvider || null;
    const provider = this.providers.find(entry => entry.id === resolvedId) || null;
    const hasProvider = Boolean(provider);
    if (this.refs.providerLabel) {
      this.refs.providerLabel.textContent = hasProvider
        ? `Provider: ${provider.label || provider.id}`
        : 'Provider: Not set';
    }
    if (this.refs.providerBadge) {
      this.refs.providerBadge.classList.toggle('is-active', hasProvider);
      if (hasProvider) {
        this.refs.providerBadge.dataset.providerActive = provider.id;
      } else {
        delete this.refs.providerBadge.dataset.providerActive;
      }
    }
    this.updateProviderPickerSelection(hasProvider ? provider.id : null);
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
    this.modelOptions = Array.isArray(models) ? models.slice() : [];
    this.modelOptionButtons.clear();
    if (!this.refs.modelMenuList || !this.refs.modelButton) return;
    this.refs.modelMenuList.replaceChildren();

    if (!Array.isArray(models) || !models.length) {
      const empty = createElem('li', { className: 'chatbot-model-menu__empty', text: 'No models available.' });
      this.refs.modelMenuList.appendChild(empty);
      this.updateModelDisplay(null, true);
      this.updateModelMenuSelection(null);
      return;
    }

    this.updateModelDisplay(null, false);
    models.forEach((model, index) => {
      if (!model || typeof model !== 'object') return;
      const item = createElem('li', { className: 'chatbot-model-menu__item' });
      const optionButton = createElem('button', {
        className: 'chatbot-model-menu__option',
        dataset: { modelOption: model.value, index: String(index) },
        attrs: {
          type: 'button',
          role: 'option',
          'aria-selected': 'false'
        }
      });
      const info = createElem('span', { className: 'chatbot-model-menu__option-info' });
      info.appendChild(
        createElem('span', {
          className: 'chatbot-model-menu__option-label',
          text: model.label || model.value || 'Model'
        })
      );
      if (model.tier) {
        info.appendChild(
          createElem('span', {
            className: 'chatbot-model-menu__option-meta',
            text: model.tier
          })
        );
      }
      optionButton.appendChild(info);
      const check = createElem('span', { className: 'chatbot-model-menu__option-check' });
      check.appendChild(createIcon('check'));
      optionButton.appendChild(check);
      item.appendChild(optionButton);
      this.refs.modelMenuList.appendChild(item);
      this.modelOptionButtons.set(model.value, optionButton);
    });

    let resolvedActive = null;
    if (activeId && models.some(model => model.value === activeId)) {
      resolvedActive = activeId;
    } else if (models.length) {
      resolvedActive = models[0].value;
    }
    const activeModel = models.find(model => model.value === resolvedActive) || null;
    this.updateModelDisplay(activeModel, false);
    this.updateModelMenuSelection(resolvedActive);
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
