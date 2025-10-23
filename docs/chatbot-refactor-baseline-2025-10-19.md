# Chatbot Refactor Baseline – 2025-10-19

## Environment
- Branch: `feature/chatbot-refactor-v2`
- Working tree already contained earlier local changes (see `git status` for details).
- CLI context only; no browser session available in this run.

## Validation Harness
- `scripts/validation-harness.js` must execute in a browser (`window` scope).
- Baseline run captured on 2025‑10‑19 via browser console:
  ```
  ✅ ALL CHECKS PASSED
  ⏱️  Total time: 128ms
  Race Condition: ✅ PASS (iterations: 100, errors: 0)
  Message Archive: ✅ PASS (activeMessages: 500, archivedCount: 100, archivingWorked: true)
  ✅ READY TO DEPLOY
  ```

## Manual Smoke Checklist
- Use the following checklist before and after each phase. Record observations beside each item:
  1. Load the SolidCAM Cheat Sheet page → chatbot card renders and debug toggle matches settings.
  2. Package mode: send a package-specific query → assistant streams response with package references visible.
  3. Switch to General mode: send a general query → assistant response streams and references remain hidden.
  4. Create a new conversation, send a message, switch conversations → both persist across reload.
  5. Copy conversation (once feature active) → clipboard populated and success toast displayed.
  6. Provider change without API key → info banner prompts for key; settings stay open.
  7. Add API key, change model, close settings → composer refocused and debug panel updates provider/model.
  8. Simulate rate limit (via repeated sends or helper) → warning banner appears, sending disabled temporarily.
  9. Hard reload → active mode, conversations, prompts restored from storage.
 10. Run `runQuickValidation()` again → expect ✅ PASS summary as above.

## Next Local Steps
1. Open the SolidCAM Cheat Sheet app in a browser.
2. Run through the manual smoke checklist (Section 8.1 of the refactor plan) and note any anomalies.
3. Execute `runQuickValidation()` in the browser console and capture output (screenshot or copy/paste) for comparison after refactor.
4. Store results alongside this baseline file (e.g., add comments or attachments as needed).

## Notes
- Feature toggles to guard new modules are documented in the plan and will be introduced during Phase 1 implementation.
- No code changes were made in Phase 0. This file documents the baseline gap so the team can fill it when the UI is accessible.
