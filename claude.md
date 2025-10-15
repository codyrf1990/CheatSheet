# SolidCAM Cheat Sheet – Claude Agent Brief

Thanks for stepping in! This note gives Claude-based agents the essentials needed to continue work on the SolidCAM Packages & Maintenance Cheat Sheet without re-discovering the project from scratch.

## Quick Orientation
- **HTML entry:** `index.html` wires up the stylesheet at `assets/css/main.css` and the application script at `assets/js/app.js`.
- **JS bootstrap:** `assets/js/app.js` imports `renderApp` from `assets/js/dom.js` and mounts the entire UI into `#app`.
- **Default data:** Canonical package definitions, sidebar items, and header links live in `assets/js/data.js`. Treat these values as the reset state.
- **Persistence helper:** `assets/js/persistence.js` exposes `saveState`, `loadState`, and `clearState`, wrapping `localStorage` under the key `solidcam-cheatsheet-state`.

## Core Behaviors You Must Preserve
1. **Header and hero layout**
   - Left-aligned SolidCAM logo (20% larger than original asset).
   - Centered title “SolidCAM Packages & Maintenance Cheat Sheet” with a row of support links directly underneath.
   - No additional padding—layout is tuned for a single 1080p viewport.

2. **Main package table**
   - Top controls: add/remove mode toggles on the left, edit/reset controls on the right.
   - `Edit Order` toggles drag-and-drop via `assets/js/drag-and-drop.js`. `Reset Order` clears storage and reloads defaults; `Reset Checks` unchecks boxes without altering bit lists.
   - Add mode reveals row-level `+` buttons to append loose bits; remove mode exposes `×` buttons on loose bits, sub-bits, and master groups.

3. **Drag-and-drop system**
   - Implemented through a custom helper emitting `sortable:drop` events (`detail` contains `{ item, from, to }`).
   - All package bit buckets share scope `package-bits`. Loose bits and grouped sub-bits can move between one another and across packages.
   - Empty master groups are automatically removed. Dragging is active only in edit mode; SCSS uses dashed borders and gold accents to show drop targets.
   - Sidebar lists (`.panel`) also rely on the same drag helpers for reordering.

4. **Sidebar cards**
   - Three cards (“Standalone Modules”, “Maintenance SKUs”, “SolidWorks Maintenance”) each have `+`/`−` buttons.
   - Add prompts collect text and append new pills. Delete mode exposes `×` icons beside each pill.
   - Layout uses a two-column pill grid with consistent padding; keep the density tight.

5. **State rules**
   - Any structure change (add/remove/drag) must end with `persistState`.
   - `collectState` and `applyState` in `assets/js/dom.js` manage serialization and hydration. Update both when adding new state fields.
   - Always prefer the helpers in `persistence.js` rather than direct storage access.

## Styling Guidance
- Theme: dark gradient backgrounds with SolidCAM red/gold highlights. Do **not** alter the palette without approval.
- Spacing: deliberately compact—tweak with care to avoid breaking the 1080p single-screen fit.
- Drag affordances: edit mode adds dashed borders (`body.edit-mode`) and gold outlines to drop targets.
- Stick to ASCII unless you have a compelling reason; existing assets are ASCII-friendly.

## Practical Notes
- **No build tooling:** The project runs directly in the browser. Serve statically or via `file://`.
- **Testing:** Manual testing is expected—toggle modes, add/remove bits, reorder items, refresh to verify persistence. Document any manual steps you follow.
- **Resets:** `clearState()` (or the UI’s Reset) returns you to the seed dataset defined in `data.js`.
- **Copy handling:** `assets/js/copy.js` attaches click-to-copy behavior to `<code>` elements when not in edit mode. Ensure new `<code>` elements register via `registerCopyHandlers`.
- **Drag scope changes:** Extend the existing logic in `assets/js/drag-and-drop.js` rather than replacing it—both the package table and sidebar cards rely on the same behavior.

## Workflow Reminders
- The repo may already contain user edits; never revert them unless explicitly told to.
- Use the CLI’s `apply_patch` for modifications and avoid destructive git operations.
- When reporting back, reference file paths and line numbers so the user can jump straight to relevant code.

Armed with this brief, Claude agents should be able to dive in, maintain consistency, and ship enhancements quickly. Happy building! 🚀
