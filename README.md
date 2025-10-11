## SolidCAM Packages & Maintenance Cheat Sheet

Interactive reference for the SolidCAM team that combines the package matrix, maintenance lookups, and a built-in comms toolkit. Everything runs client-side – open `index.html` in any modern browser and you’re ready to work offline.

### What’s included

- **Package Bits table** – toggle master packages and individual bits, add custom entries, drag to re-order, and copy codes with a click. State persists locally per browser.
- **Right-side panels** – quick lists for Standalone Modules, Maintenance SKUs, and SolidWorks Maintenance with the same copy and edit affordances.
- **Calculator card** – standard operations, +/- toggle, delete, percent, and a bank of quick percentage buttons (5–30%). Layout: equals is a tall key directly under `+` (spans two rows); the quick % buttons sit on the bottom row beneath `+/−`, `0`, and `.`. After pressing `=` the next number starts a fresh calculation; choosing an operator continues from the result.
- **Email Templates card** – searchable template library with placeholder personalization, copy buttons, “Launch in Outlook” (mailto) handoff, and a full manage mode to add/edit/clone/delete/reorder templates. Defaults can be restored at any time.

### Getting started

1. Clone or download the repository.
2. Open `CheatSheet/index.html` directly in a browser (Chrome/Edge/Safari/Firefox). No build step or server is required.
3. Assets live under `assets/`:
   - `assets/css/main.css` – styling for the layout, calculator, and template system.
   - `assets/js/app.js` – bootstraps the UI.
   - `assets/js` modules – `dom.js` (main render + behaviors), `calculator.js`, `email-templates.js`, and supporting helpers.

### Tips & workflows

- **Editing package content** - Enable "Edit Order" to drag rows/cards; toggle Add/Remove Bit for custom items. Use "Reset Order" to discard local changes or "Reset Checks" to clear selections only.
- **Calculator shortcuts** - The quick percent buttons calculate the specified percentage of the current display. If you've selected an operation (e.g., `100 +`), the shortcut treats the first operand as the base, inserts the result, and lets you continue. After `=`, typing a digit clears the display for a new entry; selecting an operator uses the last result.
- **Email templates** - Personalize placeholders before launching Outlook. Manage mode stores changes in `localStorage`; each browser profile maintains its own library. "Restore Defaults" reloads the starter set shipped with the repo.

### Automated checks

- Run `npm test` (Node 18+) to execute the JSDOM smoke suite. It covers:
  - Email template bootstrapping and selection (`scripts/test-email-templates.js`).
  - Template authoring workflow (`scripts/test-email-add.js`).
  - Package-bit add/move/remove persistence checks (`scripts/test-packages.js`).
  - Master/sub checkbox state propagation and reset guardrails (`scripts/test-checkboxes.js`).
- Console output is JSON per check; anything with `"success": false` needs a follow-up.

### Manual QA checklist

- Load `index.html` in a desktop browser and confirm the package table + side panels render without console errors.
- Toggle `Edit Order` on/off, drag a package row and sidebar pill, then refresh to verify the new order persists.
- Enter `Add` mode, append a custom bit, toggle `Remove` mode to delete it, and confirm `Reset Order` restores seed data.
- Flip a master checkbox, confirm sub-bits follow, then hit `Reset Checks` to clear all selections.
- Open the email template card: search, duplicate, edit, and delete a template; relaunch the page to verify persistence.
- Exercise the calculator: chained operations, percent buttons (with/without pending operator), and clear/backspace paths.
- Trigger a copy-to-clipboard on a code pill while not in edit mode; verify the toast/visual feedback appears.

### Contributing

- Keep additions modular under `assets/js/` (follow the existing module pattern).
- Use `email-templates.js` for template data/logic and `calculator.js` for calculator behavior.
- When updating UI copy, mirror the information in both the README and the in-app “About” overlay (`renderAboutOverlay` in `dom.js`).

### Support

Questions or fixes? Open an issue or share feedback with the SolidCAM operations crew. The project is intentionally framework-free so changes remain lightweight and easy to deploy.
