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
    this.overflowBuffer = new Map();
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
      let retries = 0;
      let archived = false;
      while (retries < 3 && !archived) {
        logger.startTimer('archive-batch');
        try {
          await this.archiveMessages(conversationId, toArchive);
          archived = true;
          logger.endTimer('message-archive', 'archive-batch');
          logger.log('message-archive', `Archived overflow messages`, {
            archivedCount: toArchive.length,
            remainingActive: activeMessages.length
          });
        } catch (error) {
          logger.endTimer('message-archive', 'archive-batch');
          logger.warn('message-archive', 'Failed to archive overflow messages.', error);
          retries += 1;
          if (retries < 3) {
            const delay = Math.pow(2, retries - 1) * 500;
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      if (!archived) {
        const existing = this.overflowBuffer.get(conversationId) || [];
        const buffered = [...existing, ...toArchive];
        this.overflowBuffer.set(conversationId, buffered);
        logger.warn('message-archive', `Queued overflow messages for later archive`, {
          bufferedCount: buffered.length,
          conversationId
        });
      } else {
        await this.flushOverflow(conversationId);
      }
    }

    return activeMessages;
  }

  async flushOverflow(conversationId) {
    const buffered = this.overflowBuffer.get(conversationId);
    if (!buffered || !buffered.length) {
      return true;
    }

    try {
      await this.archiveMessages(conversationId, buffered);
      this.overflowBuffer.delete(conversationId);
      logger.log('message-archive', `Flushed overflow buffer`, {
        flushedCount: buffered.length,
        conversationId
      });
      return true;
    } catch (error) {
      logger.warn('message-archive', 'Overflow flush failed', error);
      return false;
    }
  }

  getEffectiveCount(conversationId, activeMessages = []) {
    const buffered = this.overflowBuffer.get(conversationId);
    const bufferedCount = Array.isArray(buffered) ? buffered.length : 0;
    const activeCount = Array.isArray(activeMessages) ? activeMessages.length : 0;
    return activeCount + bufferedCount;
  }

  async archiveMessages(conversationId, messages) {
    if (!messages.length) return;

    const db = await this.init();
    if (!db) return;

    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const archivedAt = Date.now();

      let settled = false;

      const fail = error => {
        if (settled) return;
        settled = true;
        try {
          tx.abort();
        } catch (_) {
          // ignore abort errors
        }
        reject(error);
      };

      tx.oncomplete = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      tx.onerror = () => fail(tx.error);
      tx.onabort = () => fail(tx.error || new Error('IndexedDB transaction aborted.'));

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
          const error = request.error || new Error('Failed to archive message');
          logger.error('message-archive', 'Failed to archive message', error);
          fail(error);
        };
      });
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
    const buffered = this.overflowBuffer.get(conversationId) || [];
    const bufferedMessages = buffered.map(entry => ({
      id: entry.id,
      role: entry.role,
      content: entry.content,
      createdAt: entry.createdAt,
      pendingArchive: true,
    }));
    return [
      ...bufferedMessages,
      ...sanitizedArchived,
      ...(Array.isArray(activeMessages) ? activeMessages : [])
    ];
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
