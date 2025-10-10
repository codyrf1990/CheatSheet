import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8');
const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  resources: 'usable',
  url: 'https://localhost/'
});

const { window } = dom;

Object.defineProperty(window, 'localStorage', {
  value: (() => {
    const store = new Map();
    return {
      getItem: key => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, value),
      removeItem: key => store.delete(key),
      clear: () => store.clear(),
    };
  })(),
});

Object.assign(global, {
  window,
  document: window.document,
  navigator: window.navigator,
  localStorage: window.localStorage,
  performance: { getEntriesByType: () => [{ type: 'navigate' }] }
});

navigator.clipboard = { writeText: async () => {} };

const mod = await import('../assets/js/email-templates.js');
mod.initializeEmailTemplates();

const addBtn = document.querySelector('[data-action="new-template"]');
addBtn.click();

const nameInput = document.querySelector('[data-field="name"]');
const subjectInput = document.querySelector('[data-field="subject"]');
const bodyInput = document.querySelector('[data-field="body"]');

nameInput.value = 'Test Template';
subjectInput.value = 'Testing';
bodyInput.value = 'Body content';

const event = new window.Event('input', { bubbles: true });
nameInput.dispatchEvent(event);
subjectInput.dispatchEvent(event);
bodyInput.dispatchEvent(event);

document.querySelector('[data-action="save-template"]').click();

const list = document.querySelector('[data-template-list]');
console.log('templates now', list.children.length);
console.log('last item name', list.lastElementChild.querySelector('.email-template-item__title').textContent.trim());
