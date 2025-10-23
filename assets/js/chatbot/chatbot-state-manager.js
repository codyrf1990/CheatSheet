import { sanitizeMode } from './chatbot-constants.js';

export class ChatbotStateManager {
  constructor({
    state,
    saveSettings,
    savePrompts,
    persistConversations,
    updateDebugPanel
  }) {
    this.state = state;
    this.saveSettings = typeof saveSettings === 'function' ? saveSettings : () => {};
    this.savePrompts = typeof savePrompts === 'function' ? savePrompts : () => {};
    this.persistConversations =
      typeof persistConversations === 'function' ? persistConversations : () => {};
    this.updateDebugPanel = typeof updateDebugPanel === 'function' ? updateDebugPanel : () => {};
  }

  get activeMode() {
    return this.state.activeMode;
  }

  set activeMode(mode) {
    this.state.activeMode = sanitizeMode(mode);
  }

  get activeConversationId() {
    return this.state.activeConversationId;
  }

  set activeConversationId(conversationId) {
    this.state.activeConversationId = conversationId;
  }

  get settings() {
    return this.state.settings;
  }

  set settings(value) {
    this.state.settings = value;
  }

  get prompts() {
    return this.state.prompts;
  }

  set prompts(value) {
    this.state.prompts = value;
    this.savePrompts(this.state.prompts);
  }

  get contextSnapshot() {
    return this.state.contextSnapshot;
  }

  set contextSnapshot(snapshot) {
    this.state.contextSnapshot = snapshot || null;
  }

  get lastRagResults() {
    return this.state.lastRagResults;
  }

  set lastRagResults(results) {
    this.state.lastRagResults = Array.isArray(results) ? results : [];
  }

  get sending() {
    return this.state.sending;
  }

  set sending(flag) {
    this.state.sending = Boolean(flag);
  }

  updateSettings(partial) {
    if (!partial || typeof partial !== 'object') {
      return;
    }
    this.state.settings = {
      ...this.state.settings,
      ...partial,
      lastConversationIds: {
        ...this.state.settings.lastConversationIds,
        ...(partial.lastConversationIds || {})
      },
      providerModels: {
        ...this.state.settings.providerModels,
        ...(partial.providerModels || {})
      },
      sidebarWidths: {
        ...this.state.settings.sidebarWidths,
        ...(partial.sidebarWidths || {})
      }
    };
    this.saveSettings(this.state.settings);
  }

  setApiKey(providerId, key, encryptCallback) {
    if (!providerId || typeof encryptCallback !== 'function') {
      return;
    }
    encryptCallback(this.state.settings, providerId, key || '');
    this.saveSettings(this.state.settings);
  }

  getPlainApiKey(getter, providerId) {
    if (typeof getter !== 'function') {
      return '';
    }
    return getter(this.state.settings, providerId);
  }

  setSidebarWidth(sidebarName, width) {
    const numericWidth = Number(width);
    if (!Number.isFinite(numericWidth) || numericWidth <= 0) {
      return;
    }
    const rounded = Math.round(numericWidth);
    if (!this.state.settings.sidebarWidths) {
      this.state.settings.sidebarWidths = {};
    }
    if (this.state.settings.sidebarWidths[sidebarName] === rounded) {
      return;
    }
    this.state.settings.sidebarWidths[sidebarName] = rounded;
    this.saveSettings(this.state.settings);
  }

  setDebugPanel(show) {
    const next = Boolean(show);
    if (this.state.settings.showDebugPanel === next) {
      return;
    }
    this.state.settings.showDebugPanel = next;
    this.saveSettings(this.state.settings);
    this.updateDebugPanel();
  }

  setRateLimitStatus(status) {
    this.state.rateLimitStatus = status;
    if (this.state.settings.showDebugPanel) {
      this.updateDebugPanel();
    }
  }

  updateLastConversationId(mode, conversationId) {
    const normalized = sanitizeMode(mode);
    this.state.settings.lastConversationIds = {
      ...this.state.settings.lastConversationIds,
      [normalized]: conversationId
    };
    this.saveSettings(this.state.settings);
  }
}
