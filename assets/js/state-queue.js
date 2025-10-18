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
  }

  async enqueue(snapshot, changeType = 'ui_change', metadata = {}) {
    if (!snapshot || typeof snapshot !== 'object') {
      logger.warn('state-queue', 'Ignoring invalid snapshot payload.');
      return;
    }

    logger.log('state-queue', `Queued change: ${changeType}`, {
      queueSize: this.pendingChanges.length,
      version: this.version
    });

    const entry = {
      snapshot,
      type: changeType,
      metadata: {
        ...metadata,
        timestamp: Date.now(),
        version: this.version++,
      },
    };

    this.pendingChanges.push(entry);

    if (!this.processing) {
      await this.processQueue();
    }
  }

  async processQueue() {
    if (this.processing) return;
    if (!this.pendingChanges.length) return;

    this.processing = true;
    logger.startTimer('queue-process');
    try {
      while (this.pendingChanges.length) {
        const batch = this.pendingChanges.splice(0, BATCH_SIZE);
        logger.log('state-queue', `Processing batch`, {
          batchSize: Math.min(BATCH_SIZE, this.pendingChanges.length + batch.length)
        });
        const validEntries = [];

        batch.forEach(change => {
          if (this.validateStateIntegrity(change.snapshot)) {
            validEntries.push(change);
          } else {
            logger.error('state-queue', 'State validation failed. Skipping change.', change);
          }
        });

        if (!validEntries.length) {
          continue;
        }

        await this.atomicWrite(validEntries);
        this.latestState = validEntries[validEntries.length - 1].snapshot;
      }
    } catch (error) {
      logger.error('state-queue', 'Failed to process queue', error);
    } finally {
      this.processing = false;
      if (this.pendingChanges.length) {
        // Process any entries added while we were handling the previous batch.
        this.processQueue().catch(err => {
          logger.error('state-queue', 'Error while continuing queue processing', err);
        });
      }
      logger.endTimer('state-queue', 'queue-process');
    }
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
        logger.error('state-queue', 'IndexedDB write failed, falling back to localStorage.', error);
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

      changes.forEach(change => {
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
        logger.error('state-queue', 'Failed to store snapshot entry', request.error);
      };
    });

      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
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
}

export const stateQueue = new StateQueue();
