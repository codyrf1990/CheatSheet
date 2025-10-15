const STORAGE_KEYS = {
  conversations: 'solidcam.chatbot.conversations',
  settings: 'solidcam.chatbot.settings',
  prompts: 'solidcam.chatbot.prompts'
};

const DEFAULT_PROMPTS = {
  package: {
    id: 'prompt-package',
    name: 'SolidCAM Package Architect',
    content: [
      'You are the SolidCAM Package Architect assisting sales engineers with configuring SolidCAM product packages, maintenance coverage, hardware licensing, and SolidWorks integrations.',
      'Interpret the current package selections, loose bits, and master groups to recommend next steps, highlight required dependencies, and flag gaps in maintenance or dongle coverage.',
      'Explain pricing or code impacts clearly, cite the packages or options you reference, and ask for any missing context needed to finalize a quote.'
    ].join(' ')
  },
  general: {
    id: 'prompt-general',
    name: 'SolidCAM Enterprise Assistant',
    content: [
      'You are the SolidCAM Enterprise Assistant supporting internal teams with communication drafts, research, policy clarification, and operational questions.',
      'Adopt a professional, action-driven tone, provide concise recommendations, and surface follow-up questions when more detail is needed.',
      'Reference company context from the discussion history when it strengthens the response, and flag topics that require external confirmation.'
    ].join(' ')
  }
};

const KNOWN_PROVIDERS = ['google', 'openrouter', 'deepseek'];

const DEFAULT_PROVIDER_MODELS = {
  google: 'gemini-2.0-flash',
  openrouter: 'anthropic/claude-3.5-sonnet',
  deepseek: 'deepseek-chat'
};

const DEFAULT_SETTINGS = {
  provider: 'google',
  apiKeys: {
    google: '',
    openrouter: '',
    deepseek: ''
  },
  providerModels: { ...DEFAULT_PROVIDER_MODELS },
  activeMode: 'package',
  lastConversationIds: {
    package: null,
    general: null
  },
  sidebarWidths: {},
  showDebugPanel: false
};

const API_KEY_SEED = 'solidcam-assistant';

export function loadPrompts() {
  const stored = readJson(STORAGE_KEYS.prompts, null);
  if (!stored) {
    return cloneDefaultPrompts();
  }
  if (Array.isArray(stored)) {
    // Legacy prompt array: map first entry to package, second to general.
    const [first, second] = stored;
    return sanitizePrompts({
      package: first,
      general: second
    });
  }
  return sanitizePrompts(stored);
}

export function savePrompts(prompts) {
  const sanitized = sanitizePrompts(prompts);
  writeJson(STORAGE_KEYS.prompts, sanitized);
}

export function resetPrompts() {
  savePrompts(cloneDefaultPrompts());
}

export function loadSettings() {
  const stored = readJson(STORAGE_KEYS.settings, {});
  const mergedRaw = {
    ...DEFAULT_SETTINGS,
    ...(stored && typeof stored === 'object' ? stored : {})
  };

  // Legacy migration: activePromptId -> activeMode, lastConversationId -> package bucket.
  if (mergedRaw.activePromptId && !mergedRaw.activeMode) {
    mergedRaw.activeMode = mergedRaw.activePromptId === DEFAULT_PROMPTS.general.id ? 'general' : 'package';
  }
  if (mergedRaw.lastConversationId) {
    mergedRaw.lastConversationIds = {
      ...mergedRaw.lastConversationIds,
      package: mergedRaw.lastConversationIds?.package || mergedRaw.lastConversationId
    };
  }
  delete mergedRaw.activePromptId;
  delete mergedRaw.lastConversationId;

  const legacyApiKey =
    typeof mergedRaw.apiKey === 'string' && mergedRaw.apiKey.trim() ? mergedRaw.apiKey.trim() : null;
  delete mergedRaw.apiKey;

  const merged = {
    ...mergedRaw,
    apiKeys: sanitizeApiKeys(mergedRaw.apiKeys, legacyApiKey),
    providerModels: sanitizeProviderModels(mergedRaw.providerModels),
    sidebarWidths: sanitizeSidebarWidths(mergedRaw.sidebarWidths),
    activeMode: sanitizeMode(mergedRaw.activeMode),
    lastConversationIds: sanitizeLastConversationIds(mergedRaw.lastConversationIds),
    showDebugPanel: Boolean(mergedRaw.showDebugPanel)
  };

  if (!KNOWN_PROVIDERS.includes(merged.provider)) {
    merged.provider = DEFAULT_SETTINGS.provider;
  }

  return merged;
}

export function saveSettings(settings) {
  if (!settings || typeof settings !== 'object') return;
  const payload = {
    ...settings,
    apiKeys: sanitizeApiKeys(settings.apiKeys),
    providerModels: sanitizeProviderModels(settings.providerModels),
    sidebarWidths: sanitizeSidebarWidths(settings.sidebarWidths),
    activeMode: sanitizeMode(settings.activeMode),
    lastConversationIds: sanitizeLastConversationIds(settings.lastConversationIds),
    showDebugPanel: Boolean(settings.showDebugPanel)
  };
  writeJson(STORAGE_KEYS.settings, payload);
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
  const mode = sanitizeMode(options.mode) || DEFAULT_SETTINGS.activeMode;
  return {
    id: generateId('conv'),
    title: options.title || 'New Conversation',
    createdAt: now,
    updatedAt: now,
    mode,
    messages: Array.isArray(options.messages) ? options.messages : []
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
    mode: sanitizeMode(conversation.mode) || 'package',
    messages: messages.map(message => sanitizeMessage(message)).filter(Boolean)
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

function sanitizePrompts(prompts) {
  const defaults = cloneDefaultPrompts();
  if (!prompts || typeof prompts !== 'object') {
    return defaults;
  }
  return {
    package: sanitizePromptEntry(prompts.package, defaults.package),
    general: sanitizePromptEntry(prompts.general, defaults.general)
  };
}

function sanitizePromptEntry(entry, fallback) {
  const base = fallback || cloneDefaultPrompts().package;
  if (!entry || typeof entry !== 'object') {
    return { ...base };
  }
  const name =
    typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : base.name;
  const content =
    typeof entry.content === 'string' && entry.content.trim() ? entry.content.trim() : base.content;
  return {
    id: base.id,
    name,
    content
  };
}

function sanitizeSidebarWidths(value) {
  const result = {};
  if (!value || typeof value !== 'object') {
    return result;
  }
  ['conversations', 'settings'].forEach(key => {
    const width = Number(value[key]);
    if (Number.isFinite(width) && width > 0) {
      result[key] = Math.round(width);
    }
  });
  return result;
}

function sanitizeApiKeys(value, legacyGoogleKey = null) {
  const result = {};
  const source = value && typeof value === 'object' ? value : {};
  KNOWN_PROVIDERS.forEach(provider => {
    const raw = source[provider];
    result[provider] = typeof raw === 'string' ? raw : '';
  });
  if (legacyGoogleKey && !result.google) {
    result.google = legacyGoogleKey;
  }
  return result;
}

function sanitizeProviderModels(value) {
  const result = { ...DEFAULT_PROVIDER_MODELS };
  if (!value || typeof value !== 'object') {
    return result;
  }
  KNOWN_PROVIDERS.forEach(provider => {
    const raw = value[provider];
    if (typeof raw === 'string' && raw.trim()) {
      result[provider] = raw.trim();
    }
  });
  return result;
}

function sanitizeLastConversationIds(value) {
  const base = { ...DEFAULT_SETTINGS.lastConversationIds };
  if (!value || typeof value !== 'object') {
    return base;
  }
  return {
    package: typeof value.package === 'string' && value.package.trim() ? value.package.trim() : base.package,
    general: typeof value.general === 'string' && value.general.trim() ? value.general.trim() : base.general
  };
}

function sanitizeMode(value) {
  return value === 'general' ? 'general' : 'package';
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

function cloneDefaultPrompts() {
  return {
    package: { ...DEFAULT_PROMPTS.package },
    general: { ...DEFAULT_PROMPTS.general }
  };
}

export { DEFAULT_PROMPTS, DEFAULT_SETTINGS };
