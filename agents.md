# SolidCAM Cheat Sheet – Codex Agent Guide

Welcome! Use this quick-start to get productive in the Codex CLI on the SolidCAM cheat sheet.

## Archon Workflow (Always First)
1. `find_tasks(filter_by="status", filter_value="todo")`
2. `manage_task("update", task_id, status="doing")` before touching code
3. Use RAG tools for research (short 2–5 word queries)
4. Implement and test
5. `manage_task("update", task_id, status="review")`
6. Move on to the next task

Keep task status accurate; no coding without an active Archon task.

## CLI Environment Expectations
- Shell commands run via `shell` with `["bash","-lc", ...]` and explicit `workdir`.
- Prefer `rg` for search, `sed`/`awk` for quick reads, and `apply_patch` for patches.
- Leverage the planning tool for multi-step work (skip only for trivial edits).
- Never request sandbox escalation unless essential; include justification when you do.
- Obey non-destructive policy: avoid `git reset --hard`, `git checkout --`, or mass deletes.

## Project Snapshot
- Entry pipeline: `index.html` → `assets/css/main.css`, `assets/js/app.js`.
- App bootstrap initializes `dom.js`, `calculator.js`, `email-templates.js`, and the chatbot stack.
- Canonical seed data: `assets/js/data.js`; persistence wrapper: `assets/js/persistence.js` with key `solidcam-cheatsheet-state`.
- State collection/hydration lives in `collectState` / `applyState` within `dom.js`.
- For full architecture and feature contracts, **see `claude.md`**.

## Daily Workflow Tips
- Begin each session by clearing stale localStorage with the UI reset or `clearState()` when needed.
- When registering new `<code>` snippets, call `registerCopyHandlers` in `assets/js/copy.js`.
- Extend existing helpers (`drag-and-drop.js`, persistence utilities) instead of rewriting them.
- Stick to ASCII for new content; match existing style tokens (SolidCAM red/gold, dense layout).
- Document manual QA you run—typical passes cover add/remove toggles, drag/drop, persistence, calculator math, and chatbot flows.

## Manual QA Checklist
- Toggle add/remove modes on packages and sidebar pills; confirm persistence after reload.
- Drag package bits between groups and ensure empty wrappers collapse.
- Verify calculator: chained operations, `%` operator, quick percentage buttons.
- Chatbot: send test messages, ensure history persists, and storage keys stay under quota.
- Test copy-to-clipboard on code blocks outside edit mode.
- Resize viewport to confirm compact layout remains intact.

## Reference & Support
- Architecture deep dive, RAG snippets, and workflow context live in `claude.md`.
- Security practices, QA plans, and other docs reside in `/docs` as they are authored.
- When unsure about intent, stop and ask via the task thread—never guess on structural changes.

Happy shipping! Keep updates tight, cite file paths (`path/to/file:line`), and hand tasks back in Archon when ready.
