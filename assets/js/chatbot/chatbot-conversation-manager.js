import {
  MAX_EFFECTIVE_MESSAGES,
  MIN_REQUIRED_MESSAGE_CAPACITY,
  MODE_PACKAGE,
  sanitizeMode
} from './chatbot-constants.js';

export class ChatbotConversationManager {
  constructor({
    state,
    messageArchive,
    persistConversations,
    refreshConversationList,
    persistSettings,
    ensureConversationTitle,
    createConversation,
    generateMessageId
  }) {
    this.state = state;
    this.messageArchive = messageArchive;
    this.persistConversations = persistConversations;
    this.refreshConversationList = refreshConversationList;
    this.persistSettings = persistSettings;
    this.ensureConversationTitle = ensureConversationTitle;
    this.createConversation = createConversation;
    this.generateMessageId = generateMessageId;
  }

  getActiveConversation() {
    const conversation = this.findConversation(this.state.activeConversationId);
    if (!conversation || conversation.mode !== this.state.activeMode) {
      return null;
    }
    return conversation;
  }

  ensureActiveConversation(mode = this.state.activeMode) {
    const normalized = sanitizeMode(mode);
    let conversation = this.getActiveConversation();
    if (!conversation || conversation.mode !== normalized) {
      conversation = this.ensureConversationForMode(normalized, { createIfMissing: true });
      this.state.activeConversationId = conversation ? conversation.id : null;
    }
    this.persistLastConversationId(normalized, conversation ? conversation.id : null);
    if (typeof this.refreshConversationList === 'function') {
      this.refreshConversationList();
    }
    return conversation;
  }

  ensureConversationForMode(mode, options = {}) {
    const normalized = sanitizeMode(mode);
    if (!normalized) return null;

    const lastId = this.state.settings.lastConversationIds?.[normalized];
    if (lastId) {
      const match = this.findConversation(lastId);
      if (match && match.mode === normalized) {
        return match;
      }
    }

    const existing = this.state.conversations.find(conversation => conversation.mode === normalized);
    if (existing) {
      return existing;
    }

    if (!options.createIfMissing || typeof this.createConversation !== 'function') {
      return null;
    }

    const created = this.createConversation({ mode: normalized });
    this.state.conversations.unshift(created);
    if (typeof this.persistConversations === 'function') {
      this.persistConversations();
    }
    return created;
  }

  createNewConversation(mode = this.state.activeMode) {
    const normalized = sanitizeMode(mode);
    if (typeof this.createConversation !== 'function') {
      throw new Error('Conversation factory not provided.');
    }
    const conversation = this.createConversation({ mode: normalized });
    this.state.conversations.unshift(conversation);
    this.state.activeConversationId = conversation.id;
    this.persistLastConversationId(normalized, conversation.id);
    if (typeof this.persistConversations === 'function') {
      this.persistConversations();
    }
    if (typeof this.refreshConversationList === 'function') {
      this.refreshConversationList();
    }
    return conversation;
  }

  selectConversation(conversationId) {
    const conversation = this.findConversation(conversationId);
    if (!conversation) {
      return null;
    }
    this.state.activeConversationId = conversation.id;
    this.state.activeMode = sanitizeMode(conversation.mode || MODE_PACKAGE);
    this.persistLastConversationId(this.state.activeMode, conversation.id);
    if (typeof this.refreshConversationList === 'function') {
      this.refreshConversationList();
    }
    return conversation;
  }

  createMessage(role, content = '', overrides = {}) {
    if (typeof this.generateMessageId !== 'function') {
      throw new Error('Message ID generator not provided.');
    }
    return {
      id: this.generateMessageId(role),
      role,
      content,
      createdAt: Date.now(),
      references: [],
      ...overrides
    };
  }

  async appendMessage(conversation, message, options = {}) {
    if (!conversation || !message) {
      throw new Error('Conversation and message are required.');
    }
    const {
      ensureTitle = false,
      persist = true,
      refresh = true,
      updateTimestamp = true
    } = options;
    const activeMessages = Array.isArray(conversation.messages) ? conversation.messages : [];
    try {
      conversation.messages = await this.messageArchive.addMessage(
        conversation.id,
        message,
        activeMessages
      );
    } catch (error) {
      console.warn('[Chatbot] Failed to archive message. Falling back to in-memory only.', error);
      conversation.messages = [...activeMessages, message];
    }
    if (updateTimestamp) {
      conversation.updatedAt = Date.now();
    }
    if (ensureTitle) {
      this.ensureConversationTitle?.(conversation);
    }
    if (persist && typeof this.persistConversations === 'function') {
      this.persistConversations();
    }
    if (refresh && typeof this.refreshConversationList === 'function') {
      this.refreshConversationList();
    }
    return message;
  }

  updateMessage(conversation, messageId, updates = {}) {
    if (!conversation || !messageId) {
      return null;
    }
    const target = conversation.messages.find(message => message.id === messageId);
    if (!target) {
      return null;
    }
    Object.assign(target, updates);
    conversation.updatedAt = Date.now();
    if (updates.content) {
      this.ensureConversationTitle?.(conversation);
    }
    if (typeof this.persistConversations === 'function') {
      this.persistConversations();
    }
    if (typeof this.refreshConversationList === 'function') {
      this.refreshConversationList();
    }
    return target;
  }

  computeCapacity(conversation) {
    if (!conversation) {
      return {
        hasCapacity: false,
        effectiveCount: 0,
        remainingCapacity: 0,
        maxMessages: MAX_EFFECTIVE_MESSAGES
      };
    }
    const effectiveCount = this.messageArchive.getEffectiveCount(
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

  findConversation(id) {
    if (!id) return null;
    return this.state.conversations.find(conversation => conversation.id === id) || null;
  }

  persistLastConversationId(mode, conversationId) {
    if (typeof this.persistSettings !== 'function') {
      return;
    }
    this.persistSettings({
      lastConversationIds: {
        [mode]: conversationId
      }
    });
  }
}
