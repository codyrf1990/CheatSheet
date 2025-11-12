# Chatbot Refactor Plan v2
## Air-Tight Execution Guide for Modularizing `chatbot.js`

**Author:** Codex Agent  
**Date:** 2025-10-19  
**Scope:** `assets/js/chatbot/chatbot.js` (current size ~1,260 lines) and supporting glue code  
**Status:** Phase 3 (event handler integration) in progress – regression tests pending

---

## 1. Executive Summary

The SolidCAM Cheat Sheet chatbot is feature-rich but hampered by a monolithic orchestrator (`assets/js/chatbot/chatbot.js`). This document defines an implementation-ready plan to refactor that file into small, testable modules while preserving existing behaviour. The plan applies modern front-end best practices gathered from Context7-aligned guidelines:

- Single Responsibility Principle (SRP) for each module.
- Dependency injection for portability and testability.
- Immutable inputs and explicit return shapes for cross-module interactions.
- Feature toggles to stage rollout and simplify rollback.
- Incremental commits, with regression checks at each milestone.

No changes are required to the UI (`chatbot-ui.js`), provider integrations (`chatbot-api.js`), RAG engine (`chatbot-rag.js`), context polling (`chatbot-context.js`), storage (`chatbot-storage.js`), or infrastructure helpers (`message-archive.js`, `state-queue.js`, `debug-logger.js`). The refactor is isolated to orchestration logic and new helper modules.

---

## 2. Current Pain Points (Baseline Audit)

| Concern | Location (relative path:line) | Impact |
|---------|-------------------------------|--------|
| Mixed responsibilities in `handleSend` | `assets/js/chatbot/chatbot.js:201` | Validation, archiving, RAG, API streaming, and UI updates entangled in one 150+ line function. |
| Mode logic scattered | `assets/js/chatbot/chatbot.js:288-296`, `498-532`, `602-620`, various helpers | Package vs. General branching is duplicated; future mode additions require edits in 7+ spots. |
| Global mutable `state` bag | `assets/js/chatbot/chatbot.js:74-86` | Any handler can mutate any property, complicating reasoning and testing. |
| Tight coupling to UI | Handlers call UI methods directly and early, limiting reuse and hindering automated tests. |
| Hard to unit test | Functions rely on module-scoped mutable state, DOM polling instances, and direct calls to IndexedDB helpers. |
| Missing automation | Only manual regression checks exist; no smoke tests around the orchestrator. |

The current behaviour (manual + automated harness) must stay untouched. All new code must re-use existing APIs (`messageArchive.getAllMessages`, `getEffectiveCount`, etc.) to avoid regressions.

---

## 3. Refactor Objectives

1. Reduce `chatbot.js` to a concise orchestrator (~100–150 lines) that wires dependencies and delegates to well-named managers.
2. Centralize mode-specific behaviour to a `ChatbotModeManager` so adding future modes is declarative.
3. Move conversation CRUD and archiving orchestration to `ChatbotConversationManager`.
4. Encapsulate mutable application state in `ChatbotStateManager`, exposing safe accessors/mutators.
5. Introduce an event facade that owns UI callbacks (`ChatbotEventHandlers`), keeping the orchestrator slim.
6. Maintain 100% feature parity with today’s experience, including: streaming responses, RAG references in Package mode only, rate-limit banners, reference toasts, debug panel, prompt editing, provider/model management.
7. Provide manual + automated regression steps at the end of each phase.

---

## 4. Guiding Principles & Best Practices

1. **Single Responsibility Modules** – Each new file exports exactly one cohesive class or constant set. Keep public APIs narrow and documented.
2. **Dependency Injection** – Pass dependencies (UI, managers, processors) via constructors. Avoid hard `import` cycles.
3. **Pure Data Contracts** – Methods should accept plain objects, return simple data structures, and document return shapes (`{ context, ragResults, shouldDisplayReferences }`).
4. **Feature Toggles** – Provide `FEATURE_TOGGLES` to fall back to legacy handlers without redistributing code.
5. **Incremental Delivery** – Complete Phase 1, test, then commit before starting Phase 2, etc. Use a dedicated branch (`feature/chatbot-refactor-v2`).
6. **Error Surface Consistency** – Maintain current UX (same warnings/banners). New code must propagate errors in the same format.
7. **Testing Culture** – Use existing validation harness + additional targeted tests (Vitest/Playwright) to catch regressions.

---

## 5. Implementation Roadmap

### Phase 0 – Preparatory Work (0.5h) — ✅ Completed 2025‑10‑19

- Run `scripts/validation-harness.js` from the browser console; capture output screenshots or logs.
- Draft a manual smoke checklist (Section 8.1) and run it once to confirm baseline.
- Optionally set up an automated smoke test (Vitest or Playwright) that loads `index.html`, waits for the chatbot card, sends a message in General mode, and asserts the assistant response renders.
- Create branch `feature/chatbot-refactor-v2`.

### Phase 1 – Platform & Mode Manager (3h) — ✅ Completed 2025‑10‑19

**Goal:** Extract shared constants and centralize package/general mode logic.

Tasks:
1. Create `assets/js/chatbot/chatbot-constants.js` exporting status strings, modes, provider defaults, message limits, sidebar names, feature toggles, and helpers (`sanitizeMode`, `validateMode`, `DEFAULT_PROVIDER_ID`, etc.).
2. Replace inline constants in `chatbot.js` with imports from `chatbot-constants.js`.
3. Add `assets/js/chatbot/chatbot-mode-manager.js` with responsibilities:
   - `constructor({ contextProcessor, ragEngine, messageArchive })`
   - `activate(mode)` to stop/start context polling and ingest/reset RAG.
   - `buildContextForSend({ mode, text, conversation })` returning `{ context, ragResults, shouldDisplayReferences }`. Use `messageArchive.getAllMessages(conversation.id, conversation.messages)` for general mode, slicing to the last 50 entries for references.
   - `cleanup()` to terminate background work during teardown.
4. Update `handleModeChange` and context-building section of `handleSend` to delegate to the mode manager while preserving UI and persistence calls.
5. Add `FEATURE_TOGGLES = { USE_MODE_MANAGER: true, ... }` in `chatbot-constants.js` and guard new paths accordingly.
6. Regression: Re-run manual checklist + validation harness. Verify context snapshots update only in Package mode and debug panel remains accurate.

### Phase 2 – Conversation & State Managers (4h) — ✅ Completed 2025‑10‑19

**Goal:** Encapsulate conversation CRUD and mutable settings/state.

Tasks:
1. Create `assets/js/chatbot/chatbot-conversation-manager.js`:
   - Inject `state`, `messageArchive`, `persistConversations`, `refreshConversationList`, and `ensureConversationForMode` (passed as callbacks).
   - Methods: `ensureActive()`, `createForMode(mode)`, `select(id)`, `addMessage(conversation, message)`, `updateMessage(conversation, messageId, patch)`, `computeCapacity(conversation)`, `ensureTitle(conversation)`.
   - Use existing storage helpers (`generateMessageId`, `createConversation`, `persistConversations()`).
   - Handle archive failures by falling back to in-memory arrays (match current behaviour).
2. Create `assets/js/chatbot/chatbot-state-manager.js`:
   - Wrap the `state` object; methods: `get()`, `setSending(flag)`, `isSending()`, `updateSettings(partial)`, `getApiKey(providerId)`, `setApiKey(providerId, value)`, `getDebugSnapshot()` (aggregate data for `ui.setDebugData`).
   - Persist using `saveSettings` but keep sanitization by reusing `ensureSettings` before writes.
3. Refactor handlers:
   - `handleSend` to use `stateManager.isSending()`, `conversationManager.ensureActive()`, `conversationManager.computeCapacity()`, `conversationManager.addMessage()`, etc.
   - `handleNewConversation`, `handleSelectConversation`, provider/model changes, prompt reset, API key edits to route through managers.
4. Maintain UI notifications and banners exactly as before.
5. Regression: Run manual tests + validation harness. Add targeted Vitest suites for `ChatbotConversationManager` and `ChatbotModeManager` (mock dependencies).

### Phase 3 – Event Facade & Orchestrator Cleanup (3h) — ✅ Completed 2025‑10‑19

**Goal:** Reduce `chatbot.js` to orchestration, moving handler bodies into a dedicated facade.

Tasks:
1. ✅ **Done** – Added `assets/js/chatbot/chatbot-event-handlers.js` exporting the facade that maps all UI callbacks.
2. ✅ **Done** – `chatbot.js` now instantiates managers/facade and delegates UI bindings directly to `eventHandlers`.
3. ✅ **Done** – Removed legacy handler bodies/wrappers and eliminated direct `state` mutations in `chatbot.js`.
4. ✅ **Done** – Imports/fallback helpers updated; feature toggles preserved for legacy path.
5. ✅ **Done** – Manual smoke tests + `runQuickValidation()` completed successfully. See PHASE_3_TESTING_COMPLETE.md for results.

### Phase 4 – Optional Polish (2h, post-refactor)

1. Complete the existing “Copy conversation” feature (currently partial at `chatbot.js:488-495`). Confirm behaviour via manual test.
2. Consider renaming “References” UI label to “Context Used” in `chatbot-ui.js` if stakeholders agree (cosmetic, optional).
3. Update documentation (`README.md`, `agents.md`) to describe new module architecture and entry point responsibilities.
4. Evaluate adding analytics or extra features (based on backlog) now that architecture is modular.

### Current Outstanding Actions (as of 2025‑10‑19)
- ✅ Phase 3 testing complete – all tests passed (2025-10-19).
- 🔜 Phase 4: Optional polish items pending decision.
- 🔜 Update README/agents.md with the new module architecture once testing passes (Phase 4 task).
- 🔜 Decide on optional polish items (clipboard UX, UI copy, diagrams, automated smoke/unit tests).

---

## 6. Module Responsibility Matrix

| File | Responsibility | Public API |
|------|----------------|------------|
| `chatbot-constants.js` | Shared configuration, defaults, feature toggles | Named exports (constants + helpers). |
| `chatbot-mode-manager.js` | Mode transitions, context snapshot integration, RAG ingestion | `activate(mode)`, `buildContextForSend(args)`, `getSnapshot()`, `cleanup()`. |
| `chatbot-conversation-manager.js` | Conversation lifecycle, archiving, titles, capacity checks | `ensureActive()`, `createForMode(mode)`, `select(id)`, `addMessage(conversation, message)`, `updateMessage(...)`, `computeCapacity(conversation)`, `ensureTitle(conversation)`. |
| `chatbot-state-manager.js` | Safe state access, settings persistence, debug snapshot | `get()`, `setSending(flag)`, `isSending()`, `updateSettings(partial)`, `getApiKey(providerId)`, `setApiKey(providerId, value)`, `getDebugSnapshot()`. |
| `chatbot-event-handlers.js` | UI callback implementations using managers | Methods mirroring UI callbacks; optional `setUI(ui)` if needed after instantiation. |
| `chatbot.js` | Root orchestrator | `initializeChatbot()` exports only. |

All new modules must log meaningful events using `logger` where appropriate (e.g., `logger.log('chatbot-mode-manager', 'Activated mode', { mode })`). Logging is optional but recommended for diagnosing runtime issues.

---

## 7. Feature Toggles

Add to `chatbot-constants.js`:

```javascript
export const FEATURE_TOGGLES = {
  USE_MODE_MANAGER: true,
  USE_CONVERSATION_MANAGER: true,
  USE_STATE_MANAGER: true,
  USE_EVENT_HANDLERS: true
};
```

Wrap new logic with these toggles. If regressions occur, set toggles to `false` temporarily (without removing code) to restore legacy behaviour. Remove toggles after full validation if desired.

---

## 8. Testing Strategy

### 8.1 Manual Smoke Checklist (Run at Phase 0 and after each phase)

1. **Initialization** – Load `index.html`, ensure chatbot card renders and debug panel toggle matches settings.
2. **Package Mode Message** – Ask a package-specific question; verify references render beneath the assistant response.
3. **General Mode Message** – Switch to General, send a message; references must not show.
4. **Provider Swap** – Change provider without API key; banner warns and settings stay open. Add key, switch models, confirm success toast.
5. **Conversation Management** – Create new conversation, switch back and forth, ensure persistence across reload.
6. **Copy Conversation** – Once implemented, ensure clipboard action succeeds.
7. **Rate Limit Simulation** – Call `apiManager._rateLimiter.consume` in console repeatedly to trigger the warning banner.
8. **Validation Harness** – Run `runQuickValidation()` in console; expect PASS for race condition and message archive tests.

### 8.2 Automated Tests (Recommended)

- **Unit** (Vitest):
  - `ChatbotModeManager` – ensures context processor start/stop and RAG ingestion logic.
  - `ChatbotConversationManager` – capacity checks, archiving fallback, title updates.
  - `ChatbotStateManager` – settings persistence, API key accessors, debug snapshot shape.
- **Integration Smoke** (Playwright or Web Test Runner):
  - Load `index.html`, wait for AI input textarea, type a mock message, stub API manager (if needed), observe assistant bubble creation.
- **CI Inclusion** – Add `npm run test:chatbot-smoke` to CI pipeline (optional but recommended once tests exist).

---

## 9. Risk Mitigation & Rollback

| Risk | Mitigation | Rollback |
|------|------------|----------|
| Behavioural regression | Phase-by-phase testing; feature toggles. | Flip relevant `FEATURE_TOGGLES` flag to `false`. |
| IndexedDB discrepancies | Do not alter `messageArchive` logic; intercept errors and log warnings only. | No change needed—new managers fall back to existing behaviour. |
| Circular dependencies | Keep managers free of `createChatbotUI` imports; pass dependencies from `initializeChatbot`. | Move problematic helper back into orchestrator and inject as callback. |
| Large PR complexity | Commit after each phase with summary + test notes. | `git revert` the specific phase commit without touching others. |
| Developer onboarding | Update documentation (Section 10) to clarify new architecture. | Provide quick architecture diagram in README. |

---

## 10. Documentation & Handoff

After refactor completion:

1. Update `README.md` and `agents.md` with a brief architecture overview: orchestrator + managers + UI.
2. Add a “Chatbot Architecture” section describing module responsibilities and extension points (e.g., adding a new mode).
3. Document manual test checklist and automated test commands in the repo for future contributors.
4. Optional: add high-level diagrams (mermaid) to `docs/` illustrating message flow after refactor.

---

## 11. Timeline (Suggested)

| Day | Focus | Target Output |
|-----|-------|---------------|
| Day 1 | Phase 0 + Phase 1 | Constants + Mode manager integrated, tests green. |
| Day 2 | Phase 2 | Conversation/State managers, updated handlers, validated. |
| Day 3 | Phase 3 | Event facade + orchestrator slimmed, full regression. |
| Day 4 | Buffer | Optional polish, documentation, code review, merge. |

Adjust as needed; each phase should remain shippable with toggles.

---

## 12. Appendix A – Legacy vs. Target Architecture

### Current State (Simplified)

```
chatbot.js
 ├─ initializeChatbot()                 // 150+ lines
 ├─ handleSend()                        // 150+ lines
 ├─ handleModeChange()                  // 40+ lines
 ├─ handle* (10+ different handlers)
 └─ Helper utilities (provider, prompts, etc.)
```

### Target State

```
chatbot.js (orchestrator, ~120 lines)
 ├─ chatbot-constants.js                // shared config
 ├─ chatbot-mode-manager.js             // mode transitions
 ├─ chatbot-conversation-manager.js     // conversation lifecycle
 ├─ chatbot-state-manager.js            // state accessors
 └─ chatbot-event-handlers.js           // UI callback glue
```

---

## 13. Appendix B – Structured Manual Test Script

```text
1. Load site → Expect chatbot card, provider pill, debug toggle state to match settings.
2. Package mode:
   a. Enter “What maintenance covers 5-axis packages?” → Send.
   b. Assistant response streams; references show package/dongle context.
3. Switch to General mode:
   a. Input “Draft a follow-up email.” → Send.
   b. Assistant response streams; references hidden.
4. New conversation → Compose message → Confirm switch resets message pane.
5. Copy conversation (after implementation) → Confirm toast + clipboard content.
6. Provider change with missing key → INFO toast instructs user; settings stay open.
7. Add API key, change model, close settings → UI focuses composer, debug panel updates.
8. Trigger rate limiter by calling `window.__debugRateLimiter()` helper (to be added for tests) → Expect warning banner.
9. Reload page → Active mode, conversations, prompts persist.
10. Run `runQuickValidation()` → Expect PASS entries for both tests.
```

---

## 14. Appendix C – Suggested Vitest Skeleton

```javascript
import { describe, it, expect, vi } from 'vitest';
import { ChatbotModeManager } from '../assets/js/chatbot/chatbot-mode-manager.js';

describe('ChatbotModeManager', () => {
  const contextProcessor = { start: vi.fn(), stop: vi.fn(), getSnapshot: vi.fn(() => ({ packages: [] })) };
  const ragEngine = { ingest: vi.fn(), reset: vi.fn(), search: vi.fn(() => []) };
  const messageArchive = { getAllMessages: vi.fn(() => []) };

  it('activates package mode correctly', () => {
    const manager = new ChatbotModeManager({ contextProcessor, ragEngine, messageArchive });
    manager.activate('package');
    expect(contextProcessor.start).toHaveBeenCalled();
    expect(ragEngine.ingest).toHaveBeenCalled();
  });

  it('builds general mode context without references', async () => {
    const manager = new ChatbotModeManager({ contextProcessor, ragEngine, messageArchive });
    const result = await manager.buildContextForSend({
      mode: 'general',
      text: 'hello',
      conversation: { id: 'x', messages: [] }
    });
    expect(result.shouldDisplayReferences).toBe(false);
  });
});
```

---

## 15. Approval & Kickoff Checklist

- [ ] Review plan (tech lead / project owner).
- [ ] Confirm timeline + resource allocation.
- [ ] Decide on automated testing scope (minimum smoke test recommended).
- [ ] Approve feature toggles strategy and rollback plan.
- [ ] Begin Phase 0 on branch `feature/chatbot-refactor-v2`.

---

**Ready to execute.** This plan ensures the chatbot orchestration layer becomes modular, maintainable, and testable without risking production behaviour. Each phase yields a stable checkpoint, and the appended scripts/tests guarantee comprehensive coverage. Implement sequentially, validate continuously, and ship confidently.
