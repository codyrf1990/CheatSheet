# Agents Guide for CheatSheet Maintenance

Purpose: this project now focuses only on the header, package/maintenance tables, calculator, copy HUD, and Thanksgiving overlay. Avoid reintroducing removed features (email templates, chatbot, post-matcher, dev harness).

Keep (do not delete)
- Header (logo/title/link row/operations dropdown): `index.html`, styles in `assets/css/main.css`.
- Company selector + toolbar buttons above tables: logic in `assets/js/dom.js`, styles in `assets/css/main.css`.
- Package Bits table and data: `assets/js/dom.js`, `assets/js/data.js`, styles in `assets/css/main.css`.
- Maintenance SKUs/SolidWorks panel: `assets/js/dom.js`, `assets/js/data.js`, styles in `assets/css/main.css`.
- Calculator widget: `assets/js/calculator.js`, styles in `assets/css/main.css`.
- Copy HUD/toast: `assets/js/dom.js`, `assets/css/main.css`.
- Thanksgiving HUD + turkey controller: `index.html` (feast counter), `assets/js/turkey-controller.js`, styles in `assets/css/main.css`. Thanksgiving/Halloween flags in `assets/js/dom.js` should remain if desired.

Removed (do not re-add)
- Email templates (Quill/Outlook) and related scripts/CSS/tests.
- Chatbot feature and all `assets/js/chatbot/*`, `assets/js/message-archive.js`, chatbot CSS in `assets/css/main.css`.
- Post-matcher feature (`assets/js/post-matcher/*`, `assets/css/post-matcher.css`, section in `index.html`).
- Dev/validation extras not needed in prod (`validation-harness.js`, `dev-cache-bust.js` includes).
- `send-button.css` import (file removed).

Key files to edit safely
- Markup: `index.html` — should only include header, app mount, Thanksgiving counter, turkey-controller script, and `assets/js/app.js`.
- App bootstrap: `assets/js/app.js` — only renders app and initializes calculator.
- Main UI logic: `assets/js/dom.js` — packages/maintenance/calculator/copy HUD, holiday flags.
- Data: `assets/js/data.js` — header links, packages, panels.
- Styling: `assets/css/main.css` — header/layout/package/maintenance/calculator/copy HUD/Thanksgiving. No chatbot or post-matcher imports.
- Tests: `scripts/test-add-template.js` runs remaining tests (`test-packages.js`, `test-checkboxes.js`). Remove or disable any tests referencing deleted features.

Quick sanity checks before finishing
- `rg "chatbot|post-matcher|email-templates|quill" index.html assets/js assets/css scripts` should return nothing relevant.
- Load `index.html` in a browser: no 404s, header + package/maintenance + calculator present, Thanksgiving HUD intact.
- Run `npm test` to exercise remaining suite (after keeping only supported tests).
