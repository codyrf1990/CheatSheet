const STORAGE_KEYS = {
  conversations: 'solidcam.chatbot.conversations',
  settings: 'solidcam.chatbot.settings',
  prompts: 'solidcam.chatbot.prompts'
};

const DEFAULT_PROMPTS = [
  {
    id: 'solidcam-default',
    name: 'SolidCAM Sales & Support',
    content: [
      "You are SolidCAM's internal sales and support assistant.",
      'Provide concise, actionable answers about SolidCAM product packages, maintenance SKUs, SolidWorks integrations, pricing considerations, and recommended follow-up steps.',
      'Cite relevant package names, checked options, and active template context when helpful.',
      'If information is missing, explain what else you need before proceeding.'
    ].join(' '),
    readOnly: true,
    updatedAt: 0
  }
];

const DEFAULT_SETTINGS = {
  provider: 'google',
  apiKey: '',
  activePromptId: DEFAULT_PROMPTS[0].id,
  lastConversationId: null
};

const API_KEY_SEED = 'solidcam-assistant';

export function loadPrompts() {
  const stored = readJson(STORAGE_KEYS.prompts, []);
  if (!Array.isArray(stored)) {
    return [...DEFAULT_PROMPTS];
  }

  const merged = mergePrompts(stored);
  return merged;
}

export function savePrompts(prompts) {
  if (!Array.isArray(prompts)) return;
  writeJson(STORAGE_KEYS.prompts, prompts);
}

export function resetPrompts() {
  savePrompts([...DEFAULT_PROMPTS]);
}

export function loadSettings() {
  const stored = readJson(STORAGE_KEYS.settings, {});
  return {
    ...DEFAULT_SETTINGS,
    ...(stored && typeof stored === 'object' ? stored : {})
  };
}

export function saveSettings(settings) {
  if (!settings || typeof settings !== 'object') return;
  writeJson(STORAGE_KEYS.settings, settings);
}

export function loadConversations() {
  const stored = readJson(STORAGE_KEYS.conversations, []);
  if (!Array.isArray(stored)) {
    return [];
  }

  return stored
    .map(sanitizeConversation)
    .filter(Boolean)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function saveConversations(conversations) {
  if (!Array.isArray(conversations)) return;
  writeJson(STORAGE_KEYS.conversations, conversations);
}

export function createConversation(options = {}) {
  const now = Date.now();
  return {
    id: generateId('conv'),
    title: options.title || 'New Conversation',
    createdAt: now,
    updatedAt: now,
    promptId: options.promptId || DEFAULT_SETTINGS.activePromptId,
    messages: []
  };
}

export function generateMessageId(role = 'msg') {
  return generateId(role);
}

export function obfuscateKey(value) {
  if (!value) return '';
  const salted = `${API_KEY_SEED}::${value}`;
  return base64Encode(salted);
}

export function revealKey(obfuscated) {
  if (!obfuscated) return '';
  try {
    const decoded = base64Decode(obfuscated);
    if (!decoded || !decoded.startsWith(`${API_KEY_SEED}::`)) return '';
    return decoded.slice(API_KEY_SEED.length + 2);
  } catch (error) {
    return '';
  }
}

export function mergePrompts(existing = []) {
  const byId = new Map();
  [...existing].forEach(prompt => {
    if (!prompt || typeof prompt !== 'object') return;
    if (!prompt.id) return;
    byId.set(prompt.id, sanitizePrompt(prompt));
  });
  DEFAULT_PROMPTS.forEach(prompt => {
    if (!byId.has(prompt.id)) {
      byId.set(prompt.id, { ...prompt });
    } else {
      const current = byId.get(prompt.id);
      byId.set(prompt.id, {
        ...prompt,
        ...current,
        id: prompt.id,
        readOnly: true
      });
    }
  });
  return Array.from(byId.values());
}

export function sanitizePrompt(prompt) {
  if (!prompt || typeof prompt !== 'object') return null;
  const id = typeof prompt.id === 'string' && prompt.id.trim() ? prompt.id.trim() : null;
  if (!id) return null;
  return {
    id,
    name: typeof prompt.name === 'string' && prompt.name.trim() ? prompt.name.trim() : 'Untitled Prompt',
    content: typeof prompt.content === 'string' ? prompt.content : '',
    readOnly: Boolean(prompt.readOnly),
    updatedAt: typeof prompt.updatedAt === 'number' ? prompt.updatedAt : Date.now()
  };
}

export function sanitizeConversation(conversation) {
  if (!conversation || typeof conversation !== 'object') return null;
  if (!conversation.id) return null;
  const messages = Array.isArray(conversation.messages) ? conversation.messages : [];
  return {
    id: conversation.id,
    title: typeof conversation.title === 'string' && conversation.title.trim()
      ? conversation.title.trim()
      : 'Conversation',
    createdAt: typeof conversation.createdAt === 'number' ? conversation.createdAt : Date.now(),
    updatedAt: typeof conversation.updatedAt === 'number' ? conversation.updatedAt : Date.now(),
    promptId: conversation.promptId || DEFAULT_SETTINGS.activePromptId,
    messages: messages
      .map(message => sanitizeMessage(message))
      .filter(Boolean)
  };
}

export function sanitizeMessage(message) {
  if (!message || typeof message !== 'object') return null;
  const id = typeof message.id === 'string' && message.id.trim() ? message.id.trim() : generateMessageId();
  const role = ['user', 'assistant', 'system'].includes(message.role) ? message.role : 'user';
  return {
    id,
    role,
    content: typeof message.content === 'string' ? message.content : '',
    references: Array.isArray(message.references) ? message.references : [],
    createdAt: typeof message.createdAt === 'number' ? message.createdAt : Date.now(),
    error: Boolean(message.error)
  };
}

function readJson(key, fallback) {
  if (!hasStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    console.warn('Failed to read storage', key, error);
    return fallback;
  }
}

function writeJson(key, value) {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn('Failed to write storage', key, error);
  }
}

function hasStorage() {
  try {
    return typeof window !== 'undefined' && window.localStorage;
  } catch (error) {
    return false;
  }
}

function generateId(prefix) {
  const base = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${base}`;
}

function base64Encode(value) {
  if (!value) return '';
  if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
    return window.btoa(value);
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value, 'utf8').toString('base64');
  }
  throw new Error('No base64 encoder available');
}

function base64Decode(value) {
  if (!value) return '';
  if (typeof window !== 'undefined' && typeof window.atob === 'function') {
    return window.atob(value);
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value, 'base64').toString('utf8');
  }
  throw new Error('No base64 decoder available');
}

export { DEFAULT_PROMPTS, DEFAULT_SETTINGS };
