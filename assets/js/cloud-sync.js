import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js';
import { getAnalytics, isSupported as analyticsSupported } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-analytics.js';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCrAwXm8zhbdlegsa3pTX4hVvZoPF4PDbA',
  authDomain: 'package-builder-9466f.firebaseapp.com',
  projectId: 'package-builder-9466f',
  storageBucket: 'package-builder-9466f.firebasestorage.app',
  messagingSenderId: '99209080394',
  appId: '1:99209080394:web:0abaa353760abdd6df40b3',
  measurementId: 'G-JZ19HHXVPW'
};

const USERNAME_KEY = 'solidcam-sync-username';
const COLLECTION = 'users';
const SCHEMA_VERSION = 1;
const DEFAULT_DEBOUNCE_MS = 900;

let appPromise = null;
let dbPromise = null;
let analyticsPromise = null;
const pendingSaves = new Map(); // key -> { timer, resolvers: [], rejectors: [], payload }

function ensureFirebaseApp() {
  if (!appPromise) {
    appPromise = Promise.resolve(getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG));
  }
  return appPromise;
}

async function ensureDb() {
  if (!dbPromise) {
    dbPromise = ensureFirebaseApp().then(getFirestore);
  }
  return dbPromise;
}

export async function ensureAnalytics() {
  if (!analyticsPromise) {
    analyticsPromise = (async () => {
      if (!(await analyticsSupported())) return null;
      const app = await ensureFirebaseApp();
      return getAnalytics(app);
    })().catch(() => null);
  }
  return analyticsPromise;
}

export function normalizeUsername(username) {
  return (username || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
}

export function validateUsername(username) {
  const value = (username || '').trim();
  if (value.length < 2) return { valid: false, reason: 'Min 2 characters' };
  if (value.length > 50) return { valid: false, reason: 'Max 50 characters' };
  if (!/^[a-zA-Z0-9 _-]+$/.test(value)) {
    return { valid: false, reason: 'Use letters, numbers, spaces, - or _ only' };
  }
  return { valid: true, reason: '' };
}

export function getStoredUsername() {
  try {
    return localStorage.getItem(USERNAME_KEY);
  } catch (_) {
    return null;
  }
}

export function setStoredUsername(username) {
  try {
    if (username) {
      localStorage.setItem(USERNAME_KEY, username);
    } else {
      localStorage.removeItem(USERNAME_KEY);
    }
  } catch (_) {
    // ignore storage errors
  }
}

export function clearStoredUsername() {
  setStoredUsername(null);
}

function buildPayload(username, pageSystemData) {
  return {
    username: username,
    normalizedUsername: normalizeUsername(username),
    schemaVersion: SCHEMA_VERSION,
    updatedAt: serverTimestamp(),
    pageSystem: {
      ...pageSystemData,
      schemaVersion: pageSystemData?.schemaVersion || SCHEMA_VERSION,
      updatedAt: Date.now()
    },
    client: 'solidcam-cheatsheet'
  };
}

function extractPageSystem(data) {
  if (!data) return null;
  if (data.pageSystem) return data.pageSystem;

  // Legacy/plain shape fallback: if it looks like a page system, treat it as one
  if (Array.isArray(data.companies) || data.currentCompanyId || data.favoriteCompanyIds) {
    return {
      ...data,
      schemaVersion: data.schemaVersion || 0
    };
  }
  return null;
}

export async function loadUserData(username) {
  if (!username) throw new Error('Username required for cloud load');
  const db = await ensureDb();
  const id = normalizeUsername(username);
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    pageSystem: extractPageSystem(data),
    updatedAt: data.updatedAt?.toMillis?.() || null,
    username: data.username || username,
    raw: data
  };
}

export async function saveUserData(username, pageSystemData) {
  if (!username) throw new Error('Username required for cloud save');
  const db = await ensureDb();
  const id = normalizeUsername(username);
  const payload = buildPayload(username, pageSystemData);
  await setDoc(doc(db, COLLECTION, id), payload, { merge: true });
  return true;
}

export function queueUserSave(username, pageSystemData, debounceMs = DEFAULT_DEBOUNCE_MS) {
  const key = normalizeUsername(username);
  const existing = pendingSaves.get(key);
  const entry = existing || { timer: null, resolvers: [], rejectors: [], payload: pageSystemData };

  entry.payload = pageSystemData;

  const promise = new Promise((resolve, reject) => {
    entry.resolvers.push(resolve);
    entry.rejectors.push(reject);
  });

  if (entry.timer) {
    clearTimeout(entry.timer);
  }

  entry.timer = setTimeout(async () => {
    pendingSaves.delete(key);
    try {
      await saveUserData(username, entry.payload);
      entry.resolvers.forEach(r => r(true));
    } catch (error) {
      entry.rejectors.forEach(r => r(error));
    }
  }, debounceMs);

  pendingSaves.set(key, entry);
  return promise;
}

export function cancelQueuedSave(username) {
  const key = normalizeUsername(username);
  const entry = pendingSaves.get(key);
  if (entry?.timer) {
    clearTimeout(entry.timer);
    pendingSaves.delete(key);
  }
}
