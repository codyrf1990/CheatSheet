import { saveState } from './persistence.js';
import { logger } from './debug-logger.js';

const IDB_DB_NAME = 'solidcam-state';
const IDB_STORE_NAME = 'snapshots';
const BATCH_SIZE = 10;

function hasIndexedDb() {
  return typeof indexedDB !== 'undefined';
}

/**
 * StateQueue serializes state persistence to avoid race conditions.
 * It attempts to use IndexedDB for atomic batch writes and falls back to localStorage.
 */
class StateQueue {
  constructor() {
    this.pendingChanges = [];
    this.processing = false;
    this.version = 0;
    this.latestState = null;
    this.idbPromise = null;
    this.warnedIdbUnavailable = false;
    this.currentFlushPromise = null;
    this.idleResolvers = [];
  }

  async enqueue(snapshot, changeType = 'ui_change', metadata = {}) {
    return new Promise((resolve, reject) => {
      if (!snapshot || typeof snapshot !== 'object') {
        logger.warn('state-queue', 'Ignoring invalid snapshot payload.');
        resolve(false);
        return;
      }

      const queuedAt = Date.now();
      const entry = {
        snapshot,
        type: changeType,
        metadata: {
          ...metadata,
          timestamp: queuedAt,
          version: this.version++,
        },
        resolve,
        reject,
      };

      this.pendingChanges.push(entry);

      logger.log('state-queue', `Queued change: ${changeType}`, {
        queueSize: this.pendingChanges.length,
        version: entry.metadata.version,
      });

      this.processQueue();
    });
  }

  async processQueue() {
    if (this.processing) return this.currentFlushPromise;
    if (!this.pendingChanges.length) return Promise.resolve();

    this.processing = true;
    logger.startTimer('queue-process');

    const flush = (async () => {
      while (this.pendingChanges.length) {
        const batch = this.pendingChanges.splice(0, BATCH_SIZE);
        const validEntries = [];

        for (const change of batch) {
          if (this.validateStateIntegrity(change.snapshot)) {
            validEntries.push(change);
          } else {
            logger.error('state-queue', 'State validation failed. Skipping change.', change);
            change.resolve(false);
          }
        }

        if (!validEntries.length) {
          continue;
        }

        logger.log('state-queue', 'Processing batch', {
          batchSize: validEntries.length
        });

        try {
          await this.atomicWrite(validEntries);
          this.latestState = validEntries[validEntries.length - 1].snapshot;
          validEntries.forEach(entry => entry.resolve(true));
        } catch (error) {
          logger.error('state-queue', 'Failed to process batch', error);
          validEntries.forEach(entry => entry.resolve(false));
        }
      }
    })()
      .catch(error => {
        logger.error('state-queue', 'Failed to process queue', error);
      })
      .finally(() => {
        this.processing = false;
        this.currentFlushPromise = null;
        logger.endTimer('state-queue', 'queue-process');
        this.resolveIdleWaiters();
        if (this.pendingChanges.length) {
          this.processQueue();
        }
      });

    this.currentFlushPromise = flush;
    return flush;
  }

  async atomicWrite(changes) {
    const db = await this.getDb();
    if (db) {
      try {
        await this.writeToIndexedDb(db, changes);
        logger.log('state-queue', 'Batch written via IndexedDB', {
          count: changes.length
        });
      } catch (error) {
        if (error?.name === 'QuotaExceededError') {
          logger.warn('state-queue', 'IndexedDB quota exceeded, falling back to localStorage.', error);
        } else {
          logger.error('state-queue', 'IndexedDB write failed, falling back to localStorage.', error);
        }
        const latest = changes[changes.length - 1];
        saveState(latest.snapshot);
      }
    } else {
      const latest = changes[changes.length - 1];
      saveState(latest.snapshot);
    }
  }

  async writeToIndexedDb(db, changes) {
    if (!changes.length) return;

    await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      const store = tx.objectStore(IDB_STORE_NAME);
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
      tx.onabort = () => fail(tx.error || new Error('IndexedDB transaction aborted'));

      for (const change of changes) {
        const record = {
          version: change.metadata.version,
          snapshot: change.snapshot,
          type: change.type,
          metadata: {
            ...change.metadata,
            archivedAt,
          },
        };

        const request = store.put(record);
        request.onerror = () => {
          const error = request.error || new Error('Failed to store snapshot entry');
          logger.error('state-queue', 'Failed to store snapshot entry', error);
          fail(error);
        };
      }
    });

    const latest = changes[changes.length - 1];
    saveState(latest.snapshot);
  }

  validateStateIntegrity(state) {
    if (!state || typeof state !== 'object') return false;
    if (typeof state.panels !== 'object' || state.panels === null) return false;
    if (typeof state.packages !== 'object' || state.packages === null) return false;
    return true;
  }

  async getDb() {
    if (!hasIndexedDb()) {
      this.warnIndexedDbUnavailable();
      return null;
    }

    if (!this.idbPromise) {
      this.idbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(IDB_DB_NAME, 1);

        request.onerror = () => {
          this.warnIndexedDbUnavailable(request.error);
          reject(request.error);
        };

        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onupgradeneeded = event => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
            db.createObjectStore(IDB_STORE_NAME, { keyPath: 'version' });
          }
        };
      }).catch(error => {
        this.warnIndexedDbUnavailable(error);
        return null;
      });
    }

    return this.idbPromise;
  }

  warnIndexedDbUnavailable(error) {
    if (this.warnedIdbUnavailable) return;
    this.warnedIdbUnavailable = true;
    if (error) {
      logger.warn('state-queue', 'IndexedDB unavailable. Using localStorage only.', error);
    } else {
      logger.warn('state-queue', 'IndexedDB unavailable. Using localStorage only.');
    }
  }

  whenIdle() {
    if (!this.processing && this.pendingChanges.length === 0 && !this.currentFlushPromise) {
      return Promise.resolve();
    }
    return new Promise(resolve => {
      this.idleResolvers.push(resolve);
    });
  }

  resolveIdleWaiters() {
    if (this.processing || this.pendingChanges.length) return;
    while (this.idleResolvers.length) {
      const resolve = this.idleResolvers.shift();
      if (resolve) resolve();
    }
  }
}

export const stateQueue = new StateQueue();
