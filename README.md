## SolidCAM Packages & Maintenance Cheat Sheet

Interactive reference for the SolidCAM team that combines the package matrix, maintenance lookups, and a built-in comms toolkit. Everything runs client-side – open `index.html` in any modern browser and you’re ready to work offline.

### What’s included

- **Package Bits table** – toggle master packages and individual bits, add custom entries, drag to re-order, and copy codes with a click. State persists locally per browser.
- **Right-side panels** – quick lists for Standalone Modules, Maintenance SKUs, and SolidWorks Maintenance with the same copy and edit affordances.
- **Calculator card** – standard operations, +/- toggle, delete, percent, and a bank of quick percentage buttons (5–30%) that fill the action column. Percent shortcuts work on the current entry or the first operand after choosing an operator.
- **Email Templates card** – searchable template library with placeholder personalization, copy buttons, “Launch in Outlook” (mailto) handoff, and a full manage mode to add/edit/clone/delete/reorder templates. Defaults can be restored at any time.

### Getting started

1. Clone or download the repository.
2. Open `CheatSheet/index.html` directly in a browser (Chrome/Edge/Safari/Firefox). No build step or server is required.
3. Assets live under `assets/`:
   - `assets/css/main.css` – styling for the layout, calculator, and template system.
   - `assets/js/app.js` – bootstraps the UI.
   - `assets/js` modules – `dom.js` (main render + behaviors), `calculator.js`, `email-templates.js`, and supporting helpers.

### Tips & workflows

- **Editing package content** – Enable “Edit Order” to drag rows/cards; toggle Add/Remove Bit for custom items. Use “Reset Order” to discard local changes or “Reset Checks” to clear selections only.
- **Calculator shortcuts** – The quick percent buttons calculate the specified percentage of the current display. If you’ve selected an operation (e.g., `100 +`), the shortcut treats the first operand as the base, inserts the result, and lets you continue.
- **Email templates** – Personalize placeholders before launching Outlook. Manage mode stores changes in `localStorage`; each browser profile maintains its own library. “Restore Defaults” reloads the starter set shipped with the repo.

### Contributing

- Keep additions modular under `assets/js/` (follow the existing module pattern).
- Use `email-templates.js` for template data/logic and `calculator.js` for calculator behavior.
- When updating UI copy, mirror the information in both the README and the in-app “About” overlay (`renderAboutOverlay` in `dom.js`).

### Support

Questions or fixes? Open an issue or share feedback with the SolidCAM operations crew. The project is intentionally framework-free so changes remain lightweight and easy to deploy.
