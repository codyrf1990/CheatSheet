import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const INDEX_HTML_PATH = path.resolve(__dirname, '../index.html');

function createMemoryStorage() {
  const store = new Map();
  return {
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(String(key), String(value)),
    removeItem: key => store.delete(String(key)),
    clear: () => store.clear(),
  };
}

function safeAssignGlobal(name, value) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
  if (descriptor) {
    if (descriptor.set) {
      try {
        descriptor.set.call(globalThis, value);
        return;
      } catch (_) {
        return;
      }
    }
    if (descriptor.writable) {
      globalThis[name] = value;
      return;
    }
    if (!descriptor.configurable) {
      return;
    }
  }
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value,
  });
}

export function bootstrapDom({ url = 'https://localhost/' } = {}) {
  const html = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');
  const dom = new JSDOM(html, {
    url,
  });

  const { window } = dom;
  const storage = createMemoryStorage();

  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: storage,
  });

  safeAssignGlobal('window', window);
  safeAssignGlobal('document', window.document);
  safeAssignGlobal('localStorage', storage);
  safeAssignGlobal('CustomEvent', window.CustomEvent);
  safeAssignGlobal('Event', window.Event);
  safeAssignGlobal('MouseEvent', window.MouseEvent);
  safeAssignGlobal('KeyboardEvent', window.KeyboardEvent);
  safeAssignGlobal('HTMLElement', window.HTMLElement);
  safeAssignGlobal('HTMLInputElement', window.HTMLInputElement);
  safeAssignGlobal('HTMLButtonElement', window.HTMLButtonElement);
  safeAssignGlobal('HTMLLabelElement', window.HTMLLabelElement);
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = cb => setTimeout(() => cb(Date.now()), 16);
  }
  if (!window.cancelAnimationFrame) {
    window.cancelAnimationFrame = id => clearTimeout(id);
  }

  safeAssignGlobal('requestAnimationFrame', window.requestAnimationFrame.bind(window));
  safeAssignGlobal('cancelAnimationFrame', window.cancelAnimationFrame.bind(window));

  if (!window.navigator.clipboard) {
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {},
      },
    });
  }

  if (!window.matchMedia) {
    window.matchMedia = () => ({
      matches: false,
      addListener: () => {},
      removeListener: () => {},
    });
  }
  safeAssignGlobal('matchMedia', window.matchMedia.bind(window));

  if (!window.performance.getEntriesByType) {
    window.performance.getEntriesByType = () => [];
  }

  if (!globalThis.prompt) {
    globalThis.prompt = () => '';
  }
  if (!globalThis.confirm) {
    globalThis.confirm = () => true;
  }

  window.__TEST_ENV__ = true;
  safeAssignGlobal('__TEST_ENV__', true);
  storage.clear();

  const cleanup = () => {
    delete window.__TEST_ENV__;
    delete globalThis.__TEST_ENV__;
    window?.close?.();
  };

  return { window, document: window.document, dom, cleanup };
}

export const waitForTasks = (ms = 0) =>
  new Promise(resolve => {
    setTimeout(resolve, ms);
  });
