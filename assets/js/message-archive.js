import { logger } from './debug-logger.js';

const DB_NAME = 'chatbot-archive';
const STORE_NAME = 'message-archive';
const DEFAULT_MAX_ACTIVE = 500;
const DEFAULT_ARCHIVE_BATCH = 50;

function hasIndexedDb() {
  return typeof indexedDB !== 'undefined';
}

class MessageArchive {
  constructor(options = {}) {
    this.maxActiveMessages = options.maxActive || DEFAULT_MAX_ACTIVE;
    this.batchSize = options.batchSize || DEFAULT_ARCHIVE_BATCH;
    this.dbPromise = null;
    this.warnedIdbUnavailable = false;
  }

  async init() {
    if (!hasIndexedDb()) {
      this.warnIndexedDbUnavailable();
      return null;
    }

    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);

        request.onerror = () => {
          this.warnIndexedDbUnavailable(request.error);
          reject(request.error);
        };

        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onupgradeneeded = event => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            store.createIndex('conversationId', 'conversationId', { unique: false });
            store.createIndex('timestamp', 'timestamp', { unique: false });
          }
        };
      }).catch(error => {
        this.warnIndexedDbUnavailable(error);
        return null;
      });
    }

    return this.dbPromise;
  }

  async addMessage(conversationId, message, currentMessages = []) {
    const activeMessages = Array.isArray(currentMessages) ? [...currentMessages] : [];
    activeMessages.push(message);

    logger.log('message-archive', `Message added to ${conversationId}`, {
      totalMessages: activeMessages.length
    });

    if (activeMessages.length > this.maxActiveMessages) {
      const overflow = Math.max(
        this.batchSize,
        activeMessages.length - this.maxActiveMessages
      );
      const toArchive = activeMessages.splice(0, overflow);
      try {
        logger.startTimer('archive-batch');
        await this.archiveMessages(conversationId, toArchive);
        logger.endTimer('message-archive', 'archive-batch');
        logger.log('message-archive', `Archived overflow messages`, {
          archivedCount: toArchive.length,
          remainingActive: activeMessages.length
        });
      } catch (error) {
        logger.warn('message-archive', 'Failed to archive overflow messages.', error);
        // On failure, reinsert the messages at the front so they remain active.
        activeMessages.unshift(...toArchive);
      }
    }

    return activeMessages;
  }

  async archiveMessages(conversationId, messages) {
    if (!messages.length) return;

    const db = await this.init();
    if (!db) return;

    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const archivedAt = Date.now();

      messages.forEach((msg, index) => {
        const record = {
          id: msg.id,
          conversationId,
          content: msg.content,
          role: msg.role,
          timestamp: msg.createdAt,
          archivedAt,
          originalIndex: index,
        };
        const request = store.put(record);
        request.onerror = () => {
          logger.error('message-archive', 'Failed to archive message', request.error);
        };
      });

      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted.'));
    });
  }

  async getArchivedMessages(conversationId) {
    const db = await this.init();
    if (!db) return [];

    logger.startTimer('retrieve-archive');
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('conversationId');
      const request = index.getAll(conversationId);

      request.onsuccess = () => {
        resolve(Array.isArray(request.result) ? request.result : []);
      };
      request.onerror = () => {
        reject(request.error);
      };
    }).catch(error => {
      logger.warn('message-archive', 'Failed to read archived messages', error);
      return [];
    }).finally(() => {
      logger.endTimer('message-archive', 'retrieve-archive');
    });
  }

  async getAllMessages(conversationId, activeMessages = []) {
    const archived = await this.getArchivedMessages(conversationId);
    const sortedArchived = archived.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    const sanitizedArchived = sortedArchived.map(entry => ({
      id: entry.id,
      role: entry.role,
      content: entry.content,
      createdAt: entry.timestamp,
      archived: true,
    }));
    return [...sanitizedArchived, ...(Array.isArray(activeMessages) ? activeMessages : [])];
  }

  warnIndexedDbUnavailable(error) {
    if (this.warnedIdbUnavailable) return;
    this.warnedIdbUnavailable = true;
    if (error) {
      logger.warn('message-archive', 'IndexedDB unavailable. Falling back to in-memory only.', error);
    } else {
      logger.warn('message-archive', 'IndexedDB unavailable. Falling back to in-memory only.');
    }
  }
}

export const messageArchive = new MessageArchive();
