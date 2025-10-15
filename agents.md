# SolidCAM Cheat Sheet – Agent Guide

Welcome aboard! This document gives future agents the context they need to pick up work on the SolidCAM Packages & Maintenance Cheat Sheet without retracing steps.

## Project Snapshot
- **Entry point:** `index.html` loads `assets/css/main.css` and `assets/js/app.js`.
- **App bootstrap:** `assets/js/app.js` mounts the UI by calling `renderApp` from `assets/js/dom.js`.
- **Data sources:** Default packages, sidebar panels, and support links live in `assets/js/data.js`. Treat these as the canonical seed values when implementing resets or migrations.
- **State persistence:** `assets/js/persistence.js` manages a single `localStorage` key, `solidcam-cheatsheet-state`, storing panel items, package bits, and checkbox states. Use `saveState`, `loadState`, and `clearState` helpers instead of touching storage directly.

## Key Features & Contracts
1. **Header layout**
   - Logo anchored left (20% larger than original).
   - Title and support buttons centered in a two-row block.
   - Spacing tuned for a dense, single-screen 1080p presentation—keep changes tight.

2. **Package table card**
   - Dual-mode controls (`+` / `−`) toggle add/remove modes for package bits.
   - `Edit Order`, `Reset Order`, `Reset Checks` form the shared control cluster on the right.
   - `Edit Order` enables drag-and-drop (using `assets/js/drag-and-drop.js`); `Reset Order` should restore seed data by clearing storage; `Reset Checks` only affects checkbox states.
   - In add mode, each row exposes a floating `+` button to append a new bit to the package’s loose list.
   - In remove mode, `×` buttons appear for loose bits, sub-bits, and entire master groups.

3. **Drag-and-drop rules**
   - Implemented via custom logic in `assets/js/drag-and-drop.js`, firing a `sortable:drop` event with `{ item, from, to }`.
   - All package bit containers share scope `package-bits`. Loose bits and master group sub-lists accept items from one another, allowing reshuffling within a package or between packages.
   - Master groups retain their wrapper when populated; empty groups are removed automatically.
   - Sidebars (`.panel`s) also use the sortable system for reordering in edit mode.

4. **Sidebar cards**
   - Three cards (`Standalone Modules`, `Maintenance SKUs`, `SolidWorks Maintenance`) have independent add/remove toggles.
   - Pills are laid out in a two-column grid; add prompts collect text and append pills.
   - Delete mode surfaces inline `×` buttons. Exit the mode to hide them.

5. **Persistence expectations**
   - Every structural change (bit added/removed, drag reorder, sidebar edits, checkbox changes) must pass through `persistState`.
   - `applyState` reconstructs UI elements on load. If you add new state properties, update `collectState` / `applyState` pair coherently.

6. **Calculator contract**
   - Grid: 4 columns × 6 rows inside `.calculator-buttons`.
   - Layout: `=` sits under `+` and spans two rows (rows 5–6, column 4). The quick % buttons (5–30%) occupy the bottom row under `+/−`, `0`, and `.`.
   - Behavior: After pressing `=`, typing a number starts a new calculation; choosing an operator continues from the result. The `%` operator and quick % buttons compute percentage of the current entry, or of the first operand if an operator was chosen (e.g., `100 +` then `10%` -> inserts `10`).
   - Code: markup in `assets/js/dom.js` (calculator panel), logic in `assets/js/calculator.js`, styles in `assets/css/main.css`.

## Styling Notes
- Main theme uses dark gradients with SolidCAM red and gold accents. Do **not** shift the palette without explicit approval.
- Layout tuning focuses on vertical compactness; spacing is already minimized, so adjust cautiously.
- Drag targets highlight via dashed borders and gold accents when `Edit Order` is active.
- Keep additions ASCII-only unless there is an explicit need for Unicode (current assets do not require it).

## Development Tips
- **No build step:** Everything runs directly in the browser. Use a static server or `file://` as needed.
- **Testing:** Manual verification is the norm (toggle modes, add/remove bits, reorder elements, refresh to confirm persistence). Automated tests do not exist; document any manual checklist you follow.
- **LocalStorage resets:** Use `clearState()` or `Reset Order` from the UI when you need a fresh baseline.
- **Drag-and-drop extensions:** Extend scope logic in `drag-and-drop.js` rather than replacing the helper—other parts of the UI depend on the current contract.
- **Copy-to-clipboard:** `assets/js/copy.js` registers click handlers on `<code>` blocks while not in edit mode. If you introduce new coded elements, ensure they pass through `registerCopyHandlers`.

## Workflow Reminders
- The workspace may start dirty—never revert user changes unless explicitly requested.
- `apply_patch` is the preferred tool for edits; avoid destructive git commands.
- Keep responses concise and reference paths + line numbers when summarizing updates.

With this overview, you should be able to dive straight into feature work or maintenance. Happy coding! 🚀
