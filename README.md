## SolidCAM Packages & Maintenance Cheat Sheet

Interactive reference for the SolidCAM team that combines the package matrix, maintenance lookups, and a built-in comms toolkit. Everything runs client-side – open `index.html` in any modern browser and you’re ready to work offline.

### What's included

- **Package Bits table** – toggle master packages and individual bits, add custom entries, drag to re-order, and copy codes with a click. State persists locally per browser.
- **Right-side panels** – quick lists for Standalone Modules, Maintenance SKUs, and SolidWorks Maintenance with the same copy and edit affordances.
- **Calculator card** – standard operations, +/- toggle, delete, percent, and a bank of quick percentage buttons (5–30%). Layout: equals is a tall key directly under `+` (spans two rows); the quick % buttons sit on the bottom row beneath `+/−`, `0`, and `.`. After pressing `=` the next number starts a fresh calculation; choosing an operator continues from the result.
- **Email Templates card** – searchable template library with placeholder personalization, copy buttons, "Launch in Outlook" (mailto) handoff, and a full manage mode to add/edit/clone/delete/reorder templates. Defaults can be restored at any time.
- **Halloween Theme** (toggle via `HALLOWEEN_MODE` in `dom.js`) – seasonal overlay with animated spiders (3-8), flying bugs (5-15), skull background, and a hidden easter egg triggered by clicking "Happy Thanksgiving Darryl!!" in Maintenance SKUs (plays the Vader clip when Thanksgiving mode is active).

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

- Run `npm test` (Node 18+) to execute the comprehensive test suite. It covers:
  - **Calculator Logic**: Functional tests for all operations, chaining, and state management.
  - **Email Templates**: CRUD operations, search, and editor interactions.
  - **Package Management**: Bit manipulation, drag-and-drop sorting, and state persistence.
  - **System Validation**: Race condition checks and message archive integrity.
- The test suite uses `jsdom` to simulate a browser environment and `c8` for code coverage analysis.
- Run `npx c8 npm test` to generate a detailed coverage report.

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

### Halloween Theme Implementation

**Toggle:** Set `HALLOWEEN_MODE = true` (line 9 in `assets/js/dom.js`)

**Components:**
- **Background:** Skull wallpaper overlay at 20% opacity (`assets/css/main.css` lines 4543-4552)
- **Animated spiders:** 3-8 crawling spiders using `SpiderController` from `assets/Auz-Bug-8eac7b7/bug-min.js`
- **Flying bugs:** 5-15 flies using `BugController` from same library
- **Jump scare:** Click "Happy Thanksgiving Darryl!!" in Maintenance SKUs to trigger the seasonal Easter egg (Vader clip for Thanksgiving mode)
- **Audio priming:** Loads on first user interaction to fix GitHub Pages autoplay restrictions

**Files modified:**
- `assets/js/dom.js` - Halloween initialization functions (lines 851-1012), jump scare logic (lines 893-957), audio priming (lines 172-198)
- `assets/css/main.css` - Background overlay and jump scare styling (lines 4531-4578)
- `assets/js/data.js` - Added "Happy Thanksgiving Darryl!!" easter egg (line 176)
- `assets/jump-scare/` - Scare image and audio assets

### Thanksgiving Theme Implementation

**Toggle:** Set `THANKSGIVING_MODE = true` (line 10 in `assets/js/dom.js`)

**Components:**
- **Turkey Hunt Game:** Interactive overlay where turkeys wander the screen.
- **Mechanics:** Click turkeys to turn them into roast dinners. Tracks "Feasts" (total caught) and "Streaks" (consecutive catches without missing).
- **Progressive Difficulty:** Turkeys move faster as your Feast count increases (caps at 50).
- **Persistence:** Stats are saved to `localStorage` (`thanksgiving-turkey-stats`).

**Files:**
- `assets/js/turkey-controller.js` - Game logic, sprite animation, and state management.
- `assets/thanksgiving/` - Sprites and assets.

### Support

The project is intentionally framework-free so changes remain lightweight and easy to deploy.
