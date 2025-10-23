import assert from 'node:assert/strict';
import { ChatbotModeManager } from '../assets/js/chatbot/chatbot-mode-manager.js';
import { ChatbotConversationManager } from '../assets/js/chatbot/chatbot-conversation-manager.js';
import { ChatbotStateManager } from '../assets/js/chatbot/chatbot-state-manager.js';
import {
  MODE_GENERAL,
  MODE_PACKAGE,
  FEATURE_TOGGLES,
  MAX_EFFECTIVE_MESSAGES
} from '../assets/js/chatbot/chatbot-constants.js';

const results = [];

function createContextProcessor({ snapshot = null } = {}) {
  return {
    snapshot,
    startCalls: 0,
    stopCalls: 0,
    start() {
      this.startCalls += 1;
    },
    stop() {
      this.stopCalls += 1;
    },
    getSnapshot() {
      return this.snapshot;
    }
  };
}

function createRagEngine({ searchResult = [] } = {}) {
  return {
    ingestCalls: [],
    resetCalls: [],
    searchCalls: [],
    ingest(snapshot) {
      this.ingestCalls.push(snapshot);
    },
    reset(payload) {
      this.resetCalls.push(payload);
    },
    search(text) {
      this.searchCalls.push(text);
      return Array.isArray(searchResult) ? searchResult : [];
    }
  };
}

function createMessageArchive() {
  return {
    addMessage: async (_conversationId, message, existing = []) => [...existing, message],
    getEffectiveCount: (_conversationId, messages = []) => (messages ? messages.length : 0)
  };
}

async function run(name, fn) {
  try {
    await fn();
    results.push({ name, status: 'pass' });
    console.log(
      'chatbotTest',
      JSON.stringify({
        name,
        status: 'pass'
      })
    );
  } catch (error) {
    results.push({ name, status: 'fail', error: error?.message });
    console.error(
      'chatbotTest',
      JSON.stringify({
        name,
        status: 'fail',
        error: error?.message
      })
    );
    throw error;
  }
}

/**
 * ChatbotModeManager tests
 */
await run('ChatbotModeManager activates package mode and ingests snapshot', () => {
  const snapshot = { packages: [{ id: 'pkg-1' }] };
  const contextProcessor = createContextProcessor({ snapshot });
  const ragEngine = createRagEngine();
  const manager = new ChatbotModeManager({
    contextProcessor,
    ragEngine,
    buildConversationReferences: async () => []
  });

  const activation = manager.activate(MODE_PACKAGE);
  assert.equal(activation.mode, MODE_PACKAGE);
  assert.deepEqual(activation.snapshot, snapshot);
  assert.equal(contextProcessor.startCalls, 1);
  assert.equal(ragEngine.ingestCalls.length, 1);
  assert.deepEqual(ragEngine.ingestCalls[0], snapshot);

  const generalActivation = manager.activate(MODE_GENERAL);
  assert.equal(generalActivation.mode, MODE_GENERAL);
  assert.equal(generalActivation.snapshot, null);
  assert.ok(contextProcessor.stopCalls >= 1);
  assert.ok(ragEngine.resetCalls.length >= 1);
});

await run('ChatbotModeManager builds package context with references', async () => {
  const snapshot = { packages: [{ id: 'pkg-42' }] };
  const contextProcessor = createContextProcessor({ snapshot });
  const ragEngine = createRagEngine({ searchResult: [{ document: { title: 'Pkg Doc' } }] });
  const manager = new ChatbotModeManager({
    contextProcessor,
    ragEngine,
    buildConversationReferences: async () => []
  });

  manager.activate(MODE_PACKAGE);
  const result = await manager.buildContextForSend({
    mode: MODE_PACKAGE,
    text: 'maintenance',
    conversation: { id: 'conv-1', messages: [] }
  });

  assert.equal(result.mode, MODE_PACKAGE);
  assert.equal(result.shouldDisplayReferences, true);
  assert.deepEqual(result.context, snapshot);
  assert.equal(ragEngine.searchCalls.length, 1);
  assert.equal(ragEngine.searchCalls[0], 'maintenance');
});

await run('ChatbotModeManager builds general context via conversation references', async () => {
  const contextProcessor = createContextProcessor({ snapshot: null });
  const ragEngine = createRagEngine();
  const conversationReferences = [
    { document: { title: 'Recent user question' }, score: 0.8 }
  ];
  const manager = new ChatbotModeManager({
    contextProcessor,
    ragEngine,
    buildConversationReferences: async () => conversationReferences
  });

  const result = await manager.buildContextForSend({
    mode: MODE_GENERAL,
    text: 'hello there',
    conversation: { id: 'conv-general', messages: [] }
  });

  assert.equal(result.mode, MODE_GENERAL);
  assert.equal(result.shouldDisplayReferences, false);
  assert.deepEqual(result.ragResults, conversationReferences);
  assert.equal(ragEngine.searchCalls.length, 0);
});

/**
 * ChatbotConversationManager tests
 */
await run('ChatbotConversationManager ensures an active conversation exists', async () => {
  let idCounter = 0;
  const state = {
    activeMode: MODE_PACKAGE,
    activeConversationId: null,
    settings: {
      lastConversationIds: {},
      providerModels: {},
      sidebarWidths: {}
    },
    conversations: []
  };
  let persisted = 0;
  const savedLastIds = [];

  const manager = new ChatbotConversationManager({
    state,
    messageArchive: createMessageArchive(),
    persistConversations: () => {
      persisted += 1;
    },
    refreshConversationList: () => {},
    persistSettings: payload => {
      savedLastIds.push(payload);
    },
    ensureConversationTitle: () => {},
    createConversation: ({ mode }) => ({
      id: `conv-${++idCounter}`,
      mode,
      messages: [],
      createdAt: Date.now()
    }),
    generateMessageId: role => `${role}-${++idCounter}`
  });

  const conversation = manager.ensureActiveConversation(MODE_PACKAGE);
  assert.ok(conversation);
  assert.equal(state.activeConversationId, conversation.id);
  assert.equal(persisted, 1);
  assert.ok(
    savedLastIds.some(entry => entry.lastConversationIds?.[MODE_PACKAGE] === conversation.id)
  );
});

await run('ChatbotConversationManager appends messages and updates metadata', async () => {
  let idCounter = 0;
  let persistCalls = 0;
  let refreshCalls = 0;

  const state = {
    activeMode: MODE_PACKAGE,
    activeConversationId: null,
    settings: {
      lastConversationIds: { [MODE_PACKAGE]: null },
      providerModels: {},
      sidebarWidths: {}
    },
    conversations: []
  };

  const manager = new ChatbotConversationManager({
    state,
    messageArchive: createMessageArchive(),
    persistConversations: () => {
      persistCalls += 1;
    },
    refreshConversationList: () => {
      refreshCalls += 1;
    },
    persistSettings: () => {},
    ensureConversationTitle: conversation => {
      if (!conversation.title && conversation.messages.length) {
        conversation.title = conversation.messages[0].content.slice(0, 32);
      }
    },
    createConversation: ({ mode }) => ({
      id: `conv-${++idCounter}`,
      mode,
      messages: [],
      createdAt: Date.now()
    }),
    generateMessageId: role => `${role}-${++idCounter}`
  });

  const conversation = manager.createNewConversation(MODE_GENERAL);
  const message = manager.createMessage('user', 'Hello SolidCAM');
  await manager.appendMessage(conversation, message, { ensureTitle: true });

  assert.equal(conversation.messages.length, 1);
  assert.equal(conversation.messages[0], message);
  assert.ok(conversation.updatedAt);
  assert.equal(conversation.title, 'Hello SolidCAM');
  assert.ok(persistCalls >= 1);
  assert.ok(refreshCalls >= 1);

  const capacity = manager.computeCapacity(conversation);
  assert.equal(capacity.effectiveCount, 1);
  assert.equal(capacity.remainingCapacity, MAX_EFFECTIVE_MESSAGES - 1);
  assert.equal(capacity.hasCapacity, true);
});

await run('ChatbotConversationManager updates messages in place', async () => {
  let idCounter = 0;
  let persistCalls = 0;
  const state = {
    activeMode: MODE_PACKAGE,
    activeConversationId: null,
    settings: {
      lastConversationIds: {},
      providerModels: {},
      sidebarWidths: {}
    },
    conversations: []
  };

  const manager = new ChatbotConversationManager({
    state,
    messageArchive: createMessageArchive(),
    persistConversations: () => {
      persistCalls += 1;
    },
    refreshConversationList: () => {},
    persistSettings: () => {},
    ensureConversationTitle: conversation => {
      if (!conversation.title && conversation.messages.length) {
        conversation.title = conversation.messages[0].content.slice(0, 32);
      }
    },
    createConversation: ({ mode }) => ({
      id: `conv-${++idCounter}`,
      mode,
      messages: [],
      createdAt: Date.now()
    }),
    generateMessageId: role => `${role}-${++idCounter}`
  });

  const conversation = manager.createNewConversation(MODE_PACKAGE);
  const message = manager.createMessage('assistant', 'Initial draft');
  await manager.appendMessage(conversation, message);

  const updated = manager.updateMessage(conversation, message.id, {
    content: 'Revised draft',
    tokens: 123
  });

  assert.equal(updated.content, 'Revised draft');
  assert.equal(updated.tokens, 123);
  assert.ok(conversation.updatedAt);
  assert.ok(persistCalls >= 2); // append + update
  assert.equal(conversation.title, 'Revised draft');
});

/**
 * ChatbotStateManager tests
 */
await run('ChatbotStateManager merges settings and persists', () => {
  let saveCalls = 0;
  let lastSavedSettings = null;
  const state = {
    activeMode: MODE_PACKAGE,
    activeConversationId: 'conv-1',
    settings: {
      provider: 'google',
      providerModels: { google: 'gemini-pro' },
      sidebarWidths: { conversations: 320 },
      lastConversationIds: { [MODE_PACKAGE]: 'conv-1' },
      showDebugPanel: false
    },
    prompts: {
      [MODE_PACKAGE]: { id: 'pkg', name: 'Package', content: 'pkg prompt' },
      [MODE_GENERAL]: { id: 'general', name: 'General', content: 'general prompt' }
    },
    contextSnapshot: null,
    lastRagResults: [],
    sending: false,
    rateLimitStatus: null
  };

  const manager = new ChatbotStateManager({
    state,
    saveSettings: updated => {
      saveCalls += 1;
      lastSavedSettings = structuredClone(updated);
    },
    savePrompts: () => {},
    persistConversations: () => {},
    updateDebugPanel: () => {}
  });

  manager.updateSettings({
    provider: 'openai',
    providerModels: { openai: 'gpt-4' },
    sidebarWidths: { settings: 360 },
    lastConversationIds: { [MODE_GENERAL]: 'conv-99' }
  });

  assert.equal(state.settings.provider, 'openai');
  assert.equal(state.settings.providerModels.google, 'gemini-pro');
  assert.equal(state.settings.providerModels.openai, 'gpt-4');
  assert.equal(state.settings.sidebarWidths.settings, 360);
  assert.equal(state.settings.lastConversationIds[MODE_GENERAL], 'conv-99');
  assert.equal(saveCalls, 1);
  assert.deepEqual(lastSavedSettings, state.settings);
});

await run('ChatbotStateManager updates prompts, debug panel, and API keys', () => {
  let saveSettingsCalls = 0;
  let savePromptsCalls = 0;
  let debugUpdates = 0;
  const state = {
    activeMode: MODE_PACKAGE,
    activeConversationId: 'conv-1',
    settings: {
      provider: 'google',
      providerModels: { google: 'gemini-pro' },
      sidebarWidths: { conversations: 320 },
      lastConversationIds: { [MODE_PACKAGE]: 'conv-1' },
      showDebugPanel: false,
      apiKeys: {}
    },
    prompts: {
      [MODE_PACKAGE]: { id: 'pkg', name: 'Package', content: 'pkg prompt' },
      [MODE_GENERAL]: { id: 'general', name: 'General', content: 'general prompt' }
    },
    contextSnapshot: null,
    lastRagResults: [],
    sending: false,
    rateLimitStatus: null
  };

  const manager = new ChatbotStateManager({
    state,
    saveSettings: () => {
      saveSettingsCalls += 1;
    },
    savePrompts: () => {
      savePromptsCalls += 1;
    },
    persistConversations: () => {},
    updateDebugPanel: () => {
      debugUpdates += 1;
    }
  });

  const newPrompts = {
    [MODE_PACKAGE]: { id: 'pkg', name: 'Package', content: 'new package prompt' },
    [MODE_GENERAL]: { id: 'general', name: 'General', content: 'new general prompt' }
  };
  manager.prompts = newPrompts;
  assert.equal(savePromptsCalls, 1);
  assert.deepEqual(state.prompts, newPrompts);

  manager.setSidebarWidth('conversations', 400.4);
  assert.equal(state.settings.sidebarWidths.conversations, 400);
  assert.equal(saveSettingsCalls, 1);

  manager.setSidebarWidth('conversations', 400);
  assert.equal(saveSettingsCalls, 1); // unchanged width should not persist again

  manager.setDebugPanel(true);
  assert.equal(state.settings.showDebugPanel, true);
  assert.equal(saveSettingsCalls, 2);
  assert.equal(debugUpdates, 1);

  manager.setRateLimitStatus({ tokens: 5 });
  assert.equal(state.rateLimitStatus.tokens, 5);
  assert.equal(debugUpdates, 2);

  manager.setApiKey('openai', 'secret', (settings, provider, key) => {
    if (!settings.apiKeys) {
      settings.apiKeys = {};
    }
    settings.apiKeys[provider] = key.trim();
  });
  assert.equal(state.settings.apiKeys.openai, 'secret');
  assert.equal(saveSettingsCalls, 3);

  const plain = manager.getPlainApiKey(
    (settings, provider) => settings.apiKeys?.[provider] || '',
    'openai'
  );
  assert.equal(plain, 'secret');
});

const failed = results.filter(entry => entry.status === 'fail').length;

console.log(
  'chatbotTestSummary',
  JSON.stringify({
    total: results.length,
    failures: failed,
    featureToggles: FEATURE_TOGGLES
  })
);

if (failed > 0) {
  process.exitCode = 1;
}
