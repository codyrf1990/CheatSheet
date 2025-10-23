import { MODE_PACKAGE, sanitizeMode } from './chatbot-constants.js';

export class ChatbotModeManager {
  constructor({ contextProcessor, ragEngine, buildConversationReferences }) {
    this.contextProcessor = contextProcessor;
    this.ragEngine = ragEngine;
    this.buildConversationReferences =
      typeof buildConversationReferences === 'function'
        ? buildConversationReferences
        : () => Promise.resolve([]);
    this.currentMode = null;
    this.latestSnapshot = null;
  }

  activate(mode) {
    const nextMode = sanitizeMode(mode);

    if (nextMode === this.currentMode) {
      if (nextMode === MODE_PACKAGE) {
        this.latestSnapshot = this.contextProcessor.getSnapshot() || this.latestSnapshot;
      }
      return {
        mode: nextMode,
        snapshot: this.latestSnapshot || null
      };
    }

    if (this.currentMode === MODE_PACKAGE) {
      this.contextProcessor.stop();
    }

    this.currentMode = nextMode;

    if (nextMode === MODE_PACKAGE) {
      this.contextProcessor.start();
      this.latestSnapshot = this.contextProcessor.getSnapshot() || null;
      if (this.latestSnapshot) {
        this.ragEngine.ingest(this.latestSnapshot);
      } else {
        this.ragEngine.reset([]);
      }
      return {
        mode: nextMode,
        snapshot: this.latestSnapshot
      };
    }

    this.contextProcessor.stop();
    this.latestSnapshot = null;
    this.ragEngine.reset([]);

    return {
      mode: nextMode,
      snapshot: null
    };
  }

  async buildContextForSend({ mode, text, conversation, fallbackSnapshot = null }) {
    const normalized = sanitizeMode(mode);

    if (normalized === MODE_PACKAGE) {
      const snapshot =
        this.contextProcessor.getSnapshot() || fallbackSnapshot || this.latestSnapshot || null;
      if (snapshot) {
        this.latestSnapshot = snapshot;
        this.ragEngine.ingest(snapshot);
      } else {
        this.ragEngine.reset([]);
      }
      const ragResults = snapshot ? this.ragEngine.search(text) : [];
      return {
        mode: normalized,
        context: snapshot,
        ragResults,
        shouldDisplayReferences: true
      };
    }

    const convo = conversation || { id: null, messages: [] };
    const ragResults = await this.buildConversationReferences(convo.id, convo.messages || []);
    return {
      mode: normalized,
      context: null,
      ragResults: Array.isArray(ragResults) ? ragResults : [],
      shouldDisplayReferences: false
    };
  }

  getSnapshot() {
    return this.latestSnapshot || null;
  }

  updateSnapshot(snapshot) {
    this.latestSnapshot = snapshot || null;
  }

  cleanup() {
    this.contextProcessor.stop();
    this.ragEngine.reset([]);
    this.currentMode = null;
    this.latestSnapshot = null;
  }
}
