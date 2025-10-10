import { headerLinks, packages, panels } from './data.js';
import { registerCopyHandlers } from './copy.js';
import { enableDrag, disableDrag } from './drag-and-drop.js';
import { loadState, saveState, clearState } from './persistence.js';

let editMode = false;
let packageAddMode = false;
let packageRemoveMode = false;
const panelRemoveModes = new Map();
const masterLabelLookup = buildMasterLabelLookup();
const PACKAGE_SCOPE = 'package-bits';
let widthSyncRoot = null;
let widthSyncListenerAttached = false;
let editModeGuardId = null;
let copyHudEl = null;
let copyHudTimer = null;

export function renderApp(mount) {
  editMode = false;
  document.body.classList.remove('edit-mode');
  packageAddMode = false;
  packageRemoveMode = false;
  panelRemoveModes.clear();

  mount.innerHTML = `
    <div class="page-shell">
      ${renderHeader()}
      <main>
        <section class="block">
          <div class="table-column">
            ${renderPackageHeader()}
            <div class="main-table">
              ${renderPackagesTable()}
            </div>
          </div>
          <aside class="panels">
            ${renderMaintenanceCombinedPanel()}
            ${panels
              .filter(p => !['standalone-modules', 'maintenance-skus', 'solidworks-maintenance'].includes(p.id))
              .map(renderPanel)
              .join('')}
            ${renderCalculatorPanel()}
          </aside>
        </section>
      </main>
    </div>
  `;

  // Ensure copy HUD is present for copy notifications
  ensureCopyHud();

  const root = mount.querySelector('.page-shell');
  const editButton = root.querySelector('#edit-mode-btn');
  const resetOrderButton = root.querySelector('#reset-order-btn');
  const resetChecksButton = root.querySelector('#reset-checkboxes');
  const tableBody = root.querySelector('tbody');

  root.querySelectorAll('.panel').forEach(panel => {
    panelRemoveModes.set(panel.dataset.panel, false);
    setPanelRemoveMode(panel, false);
  });

  updatePackageModeUI(root);

  root.addEventListener('click', event => handleRootClick(event, root));
  tableBody.addEventListener('change', event => handleTableChange(event, root));

  root.querySelectorAll('[data-action="package-row-add"]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      event.preventDefault();
      if (!packageAddMode) return;
      handleAddBit(button, root);
    });
  });

  editButton.addEventListener('click', () => {
    editMode = !editMode;
    document.body.classList.toggle('edit-mode', editMode);
    editButton.classList.toggle('active', editMode);
    editButton.textContent = editMode ? 'Save Order' : 'Edit Order';

    if (editMode) {
      enableDrag(root);
    } else {
      disableDrag(root);
      persistState(root);
    }
  });

  resetOrderButton.addEventListener('click', () => {
    if (confirm('Reset all module and bit order to defaults?')) {
      resetModes(root);
      clearState();
      location.reload();
    }
  });

  resetChecksButton.addEventListener('click', () => {
    root.querySelectorAll('.bit-checkbox').forEach(cb => {
      cb.checked = false;
      cb.indeterminate = false;
    });
    updateMasterCheckboxes(root);
    persistState(root);
  });

  root.addEventListener('dragend', () => {
    if (editMode) {
      persistState(root);
    }
  });
  root.addEventListener('sortable:drop', event => handleSortableDrop(event, root));

  const saved = loadState();
  if (saved) {
    applyState(root, saved);
  }

  updateMasterCheckboxes(root);
  registerCopyHandlers(root, () => editMode, showCopyHud);
  widthSyncRoot = root;
  requestAnimationFrame(() => syncPanelWidths(root));
  ensureWidthSyncListener();

  // Inject About overlay once per render
  if (!root.querySelector('.about-overlay')) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = renderAboutOverlay();
    root.appendChild(wrapper.firstElementChild);
  }

  // Defensive: if the tab is backgrounded and later restored, ensure edit mode is off
  const exitEditIfNeeded = () => exitEditMode(root);
  window.addEventListener('focus', exitEditIfNeeded);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') exitEditIfNeeded();
  });
  window.addEventListener('pageshow', () => exitEditIfNeeded());

  // Periodic guard: if body has edit-mode but internal flag is false, clear it
  if (editModeGuardId) clearInterval(editModeGuardId);
  editModeGuardId = setInterval(() => {
    if (!editMode && document.body.classList.contains('edit-mode')) {
      exitEditMode(root);
    }
  }, 15000);
}

function renderCalculatorPanel() {
  return `
    <section class="panel" data-panel="calculator" data-panel-editable="false" data-panel-title="Calculator">
      <div class="calculator-shell">
        <div class="calculator">
          <div class="calculator-display">0</div>
          <div class="calculator-buttons" aria-label="Calculator buttons">
            <button class="calculator-button clear" data-action="clear">AC</button>
            <button class="calculator-button" data-action="delete">DEL</button>
            <button class="calculator-button operation" data-action="percent">%</button>
            <button class="calculator-button operation" data-operation="/">/</button>
            <button class="calculator-button" data-number="7">7</button>
            <button class="calculator-button" data-number="8">8</button>
            <button class="calculator-button" data-number="9">9</button>
            <button class="calculator-button operation" data-operation="*">x</button>
            <button class="calculator-button" data-number="4">4</button>
            <button class="calculator-button" data-number="5">5</button>
            <button class="calculator-button" data-number="6">6</button>
            <button class="calculator-button operation" data-operation="-">-</button>
            <button class="calculator-button" data-number="1">1</button>
            <button class="calculator-button" data-number="2">2</button>
            <button class="calculator-button" data-number="3">3</button>
            <button class="calculator-button operation" data-operation="+">+</button>
            <button class="calculator-button" data-action="sign">+/-</button>
            <button class="calculator-button" data-number="0">0</button>
            <button class="calculator-button" data-action="decimal">.</button>
            <button class="calculator-button equals" data-action="equals">=</button>
            <div class="calculator-quick-row" aria-label="Quick percentage buttons">
              <button class="calculator-quick-button" type="button" data-percent="5">5%</button>
              <button class="calculator-quick-button" type="button" data-percent="10">10%</button>
              <button class="calculator-quick-button" type="button" data-percent="15">15%</button>
              <button class="calculator-quick-button" type="button" data-percent="20">20%</button>
              <button class="calculator-quick-button" type="button" data-percent="25">25%</button>
              <button class="calculator-quick-button" type="button" data-percent="30">30%</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

function ensureCopyHud() {
  if (copyHudEl) return copyHudEl;
  const el = document.createElement('div');
  el.className = 'copy-hud';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.innerHTML = '<span class="copy-hud__text">Copied</span>';
  document.body.appendChild(el);
  copyHudEl = el;
  // Global fallback: other modules can dispatch this event
  window.addEventListener('copy-hud', (ev) => {
    const dx = ev?.detail?.x;
    const dy = ev?.detail?.y;
    const target = ev?.detail?.target || null;
    if (typeof dx === 'number' && typeof dy === 'number') {
      showCopyHud({ x: dx, y: dy }, 'Copied');
    } else {
      showCopyHud(target, 'Copied');
    }
  });
  return el;
}

// Accept either an element or a click position {x, y} in client coords
function showCopyHud(posOrEl, message = 'Copied') {
  const el = ensureCopyHud();
  const textNode = el.querySelector('.copy-hud__text');
  if (textNode) textNode.textContent = message;

  let top = window.scrollY + window.innerHeight / 2;
  let left = window.scrollX + window.innerWidth / 2;
  if (posOrEl && typeof posOrEl === 'object') {
    if (typeof posOrEl.x === 'number' && typeof posOrEl.y === 'number') {
      // Position exactly where the mouse clicked (client coords + scroll)
      left = window.scrollX + posOrEl.x;
      top = window.scrollY + posOrEl.y;
    } else if (typeof posOrEl.getBoundingClientRect === 'function') {
      const rect = posOrEl.getBoundingClientRect();
      top = rect.top + rect.height / 2 + window.scrollY;
      left = rect.left + rect.width / 2 + window.scrollX;
    }
  }
  el.style.top = `${top}px`;
  el.style.left = `${left}px`;

  el.classList.add('show');
  clearTimeout(copyHudTimer);
  copyHudTimer = setTimeout(() => el.classList.remove('show'), 600);
}

function renderHeader() {
  return `
    <header class="header">
      <div class="header-logo">
        <div class="logo-container">
          <a href="https://solidcam.com/en-us/" target="_blank" rel="noopener noreferrer" class="logo-link" aria-label="Open SolidCAM main site">
            <img src="assets/img/solidcam-logo.svg" alt="SolidCAM logo" class="logo">
          </a>
        </div>
      </div>
      <div class="header-center">
        <h1 class="header-title">Packages &amp; Maintenance Cheat Sheet</h1>
        <div class="link-row">
          ${headerLinks.map(renderHeaderLink).join('')}
        </div>
      </div>
      <div class="header-spacer"></div>
    </header>
  `;
}

function renderHeaderLink(link) {
  const intentClass = `${link.intent}-button`;
  const safeHref = escapeAttr(link.href);
  const safeLabel = escapeHtml(link.label);
  const titleAttr = link.description ? ` title="${escapeAttr(link.description)}"` : '';
  return `
    <a href="${safeHref}" class="${intentClass}" target="_blank" rel="noopener noreferrer"${titleAttr}>
      ${safeLabel}
    </a>
  `;
}

function renderMaintenanceCombinedPanel() {
  const maint = (panels || []).find(p => p.id === 'maintenance-skus');
  const sw = (panels || []).find(p => p.id === 'solidworks-maintenance');
  const maintItems = (maint?.items || []).map(item => createPanelItemMarkup(item)).join('');
  const swItems = (sw?.items || []).map(item => createPanelItemMarkup(item)).join('');

  return `
    <section class="panel" data-panel="maintenance-combined" data-panel-editable="false" data-panel-title="Maintenance SKUs">
      <div class="panel-head">
        <h2>Maintenance SKUs</h2>
      </div>
      <div class="panel-section">
        <ul data-sortable-group="maintenance-skus">
          ${maintItems}
        </ul>
      </div>
      <div class="panel-section">
        <div class="panel-subhead">SolidWorks</div>
        <ul data-sortable-group="solidworks-maintenance">
          ${swItems}
        </ul>
      </div>
    </section>
  `;
}

function renderPackageHeader() {
  return `
    <div class="package-header">
      <div class="package-header-left">
        <h2>PACKAGE BITS</h2>
        <div class="package-header-modes">
          <button
            type="button"
            class="mode-toggle"
            data-action="package-toggle-add-mode"
            aria-pressed="false"
            aria-label="Toggle add mode for package bits"
          >+</button>
          <button
            type="button"
            class="mode-toggle"
            data-action="package-toggle-remove-mode"
            aria-pressed="false"
            aria-label="Toggle remove mode for package bits"
          >&minus;</button>
        </div>
      </div>
      <div class="package-header-controls">
        <button type="button" id="edit-mode-btn" class="edit-mode-btn">Edit Order</button>
        <button type="button" id="reset-order-btn" class="ghost-btn">Reset Order</button>
        <button type="button" id="reset-checkboxes" class="ghost-btn">Reset Checks</button>
      </div>
    </div>
  `;
}

function renderPackagesTable() {
  return `
    <table>
      <thead>
        <tr>
          <th>Package</th>
          <th>Maintenance</th>
          <th class="bits-head"><span>Included Bits</span>
            <button type="button" class="about-btn" data-action="open-about" aria-label="About this cheat sheet">
              <img src="assets/img/about-gold-circle-23095.svg" alt="About">
            </button>
          </th>
        </tr>
      </thead>
      <tbody>
        ${packages.map(renderPackageRow).join('')}
      </tbody>
    </table>
  `;
}

function renderAboutOverlay() {
  const linksMarkup = (headerLinks || [])
    .map(link => {
      const href = escapeAttr(link.href);
      const label = escapeHtml(link.label);
      const desc = link.description ? ` — ${escapeHtml(link.description)}` : '';
      return `<li><a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>${desc}</li>`;
    })
    .join('');

  return `
    <div class="about-overlay" role="dialog" aria-modal="true" aria-hidden="true">
      <div class="about-modal">
        <div class="about-modal-head">
          <h3>About This Cheat Sheet</h3>
          <button type="button" class="about-close" data-action="close-about" aria-label="Close">×</button>
        </div>
        <div class="about-modal-body">
          <p>Quick guide for teammates. Use this page to pick packages, prep customer comms, and generate Outlook-ready emails fast.</p>
          <h4>Sections at a glance</h4>
          <ul>
            <li><strong>Package Bits</strong> (left): choose master groups such as <em>25M</em> and toggle individual bits.</li>
            <li><strong>Standalone Modules</strong>, <strong>Maintenance SKUs</strong>, <strong>SolidWorks Maintenance</strong> (right): reference lists for add-ons and renewals. Cards stay fixed; items inside compress in delete mode.</li>
            <li><strong>Calculator</strong>: dedicated card for quick math with one-tap percentage shortcuts.</li>
            <li><strong>Email Templates</strong>: build, preview, and launch Outlook-ready emails with placeholder personalization.</li>
          </ul>
          <h4>Package + panel workflow</h4>
          <ul>
            <li><strong>Included Bits</strong>: check what applies. Groups like <em>25M</em> expand to multiple items.</li>
            <li><strong>Add / Remove Bit</strong>: enable the mode to insert or delete custom entries.</li>
            <li><strong>Edit Order</strong>: toggle to drag modules, bits, and cards; click again to store the new order.</li>
            <li><strong>Reset Order</strong>: restore defaults and clear custom rows.</li>
            <li><strong>Reset Checks</strong>: uncheck everything without changing layout.</li>
            <li><strong>Copy chips</strong>: click any code chip to copy (copying pauses while editing).</li>
            <li><strong>Autosave</strong>: everything persists per-browser. Use Reset Order if you need a clean slate.</li>
          </ul>
          <h4>Calculator & quick percentages</h4>
          <ul>
            <li>Regular keypad supports decimals, +/- toggle, delete, and chained operations.</li>
            <li>Quick buttons (5%–30%) fill the right column. They calculate the percentage of the current entry or, after choosing an operator, the percentage of the first operand.</li>
          </ul>
          <h4>Email template system</h4>
          <ul>
            <li><strong>Browse panel</strong>: search, pick a template, personalize placeholders, and copy or launch Outlook with subject/body pre-filled.</li>
            <li><strong>Placeholders</strong>: required fields highlight until filled. Values stay scoped to your current session.</li>
            <li><strong>Quick Launch</strong>: the Outlook button uses <code>mailto:</code>; if the URL gets too long, you’ll see a warning and can copy instead.</li>
            <li><strong>Manage mode</strong>: add, edit, clone, delete, and reorder templates. Changes persist locally; Restore Defaults reloads the starter set.</li>
          </ul>
          <h4>Header Links</h4>
          <ul class="about-links">
            ${linksMarkup}
          </ul>
          <h4>Logo</h4>
          <ul>
            <li><strong>SolidCAM logo</strong>: opens the main site —
              <a href="https://solidcam.com/en-us/" target="_blank" rel="noopener noreferrer">solidcam.com/en‑us</a>.
            </li>
          </ul>
          <p>If anything looks off, click Edit Order once, then click it again to save — this refreshes what’s on screen.</p>
        </div>
      </div>
    </div>
  `;
}

function renderPackageRow(pkg) {
  const safeCode = escapeHtml(pkg.code);
  const safeCodeAttr = escapeAttr(pkg.code);
  const safeDescription = escapeHtml(pkg.description);
  const safeMaintenance = escapeHtml(pkg.maintenance);

  return `
    <tr data-package="${safeCodeAttr}">
      <td class="pkg">
        <code>${safeCode}</code>
        <span>${safeDescription}</span>
      </td>
      <td class="maint">
        <code>${safeMaintenance}</code>
      </td>
      <td class="bits-cell">
        <div class="package-bits-wrapper">
          <button
            type="button"
            class="package-add-row-btn"
            data-action="package-row-add"
            aria-label="Add bit to ${safeCodeAttr}"
            title="Add bit"
          >+</button>
          ${renderBitsLayout(pkg)}
        </div>
      </td>
    </tr>
  `;
}

function renderBitsLayout(pkg) {
  const layoutClass = pkg.code === 'SC-Mill' ? 'bits-layout bits-layout--split' : 'bits-layout';
  const scope = getPackageScope(pkg.code);
  const groupMarkup = (pkg.groups || [])
    .map(group => masterBitMarkup({
      masterId: group.masterId,
      label: group.label,
      checked: false,
      indeterminate: false,
      items: (group.bits || []).map(bit => ({ text: bit, checked: false }))
    }, scope))
    .filter(Boolean)
    .join('');

  const looseMarkup = (pkg.looseBits || [])
    .map(bit => looseBitMarkup({ text: bit, checked: false }, scope))
    .join('');

  return `
    <div class="${layoutClass}" data-package-bits="${escapeAttr(pkg.code)}">
      ${groupMarkup ? `<div class="group-column">${groupMarkup}</div>` : ''}
      <ul
        class="bits"
        data-sortable-group="${escapeAttr(pkg.code)}"
        data-sortable-scope="${escapeAttr(scope)}"
      >
        ${looseMarkup}
      </ul>
    </div>
  `;
}

function renderPanel(panel) {
  const safeId = escapeAttr(panel.id);
  const safeTitle = escapeHtml(panel.title);
  const controls = panel.editable
    ? `
      <div class="panel-controls">
        <button
          type="button"
          class="panel-mode-btn"
          data-action="panel-add-item"
          aria-label="Add item to ${escapeAttr(panel.title)}"
        >+</button>
        <button
          type="button"
          class="panel-mode-btn"
          data-action="panel-toggle-remove"
          aria-pressed="false"
          aria-label="Toggle delete mode for ${escapeAttr(panel.title)}"
        >&minus;</button>
      </div>
    `
    : '';

  return `
    <section
      class="panel"
      data-panel="${safeId}"
      data-panel-editable="${panel.editable ? 'true' : 'false'}"
      data-panel-title="${escapeAttr(panel.title)}"
    >
      <div class="panel-head">
        <h2>${safeTitle}</h2>
        ${controls}
      </div>
      <ul data-sortable-group="${safeId}">
        ${panel.items.map(item => createPanelItemMarkup(item)).join('')}
      </ul>
    </section>
  `;
}

function createPanelItemMarkup(text) {
  const safeText = escapeHtml(text);
  return `
    <li data-sortable-item>
      <code>${safeText}</code>
      <button type="button" class="item-btn" data-action="panel-remove-item">×</button>
    </li>
  `;
}

function handleRootClick(event, root) {
  let target = event.target;
  while (target && !(target instanceof HTMLElement)) {
    target = target.parentElement;
  }
  if (!target) return;

  const control = target.closest('[data-action]');
  if (!control) return;

  const action = control.dataset.action;

  switch (action) {
    case 'package-toggle-add-mode':
      togglePackageMode(root, 'add');
      break;
    case 'package-toggle-remove-mode':
      togglePackageMode(root, 'remove');
      break;
    case 'package-row-add':
      event.preventDefault();
      event.stopPropagation();
      if (packageAddMode) {
        handleAddBit(control, root);
      }
      break;
    case 'remove-loose-bit':
    case 'remove-sub-bit':
    case 'remove-master':
      if (packageRemoveMode) {
        handleBitRemoval(action, control, root);
      }
      break;
    case 'panel-add-item':
      handlePanelAdd(control, root);
      break;
    case 'panel-toggle-remove':
      handlePanelToggleRemove(control);
      break;
    case 'panel-remove-item':
      handlePanelRemoveItem(control, root);
      break;
    case 'open-about':
      openAbout(root);
      break;
    case 'close-about':
      closeAbout(root);
      break;
    default:
      break;
  }
}

function handleTableChange(event, root) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;

  if (target.matches('.master-checkbox')) {
    handleMasterToggle(target, root);
    return;
  }

  if (target.matches('.sub-checkbox')) {
    handleSubToggle(target, root);
    return;
  }

  if (target.matches('.bit-checkbox')) {
    persistState(root);
  }
}

function togglePackageMode(root, mode) {
  if (mode === 'add') {
    packageAddMode = !packageAddMode;
    if (packageAddMode) {
      packageRemoveMode = false;
    }
  } else if (mode === 'remove') {
    packageRemoveMode = !packageRemoveMode;
    if (packageRemoveMode) {
      packageAddMode = false;
    }
  }

  updatePackageModeUI(root);
}

function updatePackageModeUI(root) {
  root.classList.toggle('package-add-mode', packageAddMode);
  root.classList.toggle('package-remove-mode', packageRemoveMode);

  const addToggle = root.querySelector('[data-action="package-toggle-add-mode"]');
  const removeToggle = root.querySelector('[data-action="package-toggle-remove-mode"]');

  if (addToggle) {
    addToggle.classList.toggle('active', packageAddMode);
    addToggle.setAttribute('aria-pressed', String(packageAddMode));
  }

  if (removeToggle) {
    removeToggle.classList.toggle('active', packageRemoveMode);
    removeToggle.setAttribute('aria-pressed', String(packageRemoveMode));
  }
}

function handleAddBit(control, root) {
  const row = control.closest('tr[data-package]');
  if (!row) return;
  const pkgCode = row.dataset.package || 'this package';
  const value = prompt(`Add a new bit to ${pkgCode}:`);
  if (!value) return;
  const text = value.trim();
  if (!text) return;

  const bitsList = row.querySelector('ul.bits');
  if (!bitsList) return;
  const scope = bitsList.dataset.sortableScope || getPackageScope(pkgCode);

  const element = htmlToElement(looseBitMarkup({ text, checked: false }, scope));
  bitsList.appendChild(element);
  registerCopyHandlers(element, () => editMode, showCopyHud);

  if (editMode) {
  enableDrag(element);
  }

  persistState(root);
  requestAnimationFrame(() => syncPanelWidths(root));
}

function handleBitRemoval(action, control, root) {
  const row = control.closest('tr[data-package]');
  if (!row) return;
  const layout = row.querySelector('.bits-layout');
  const groupColumn = layout?.querySelector('.group-column');

  if (action === 'remove-loose-bit') {
    const li = control.closest('li');
    li?.remove();
  } else if (action === 'remove-sub-bit') {
    const li = control.closest('li');
    const group = li?.closest('.master-bit');
    li?.remove();
    if (group) {
      const remaining = group.querySelectorAll('.sub-bits li').length;
      if (remaining === 0) {
        group.remove();
      }
    }
  } else if (action === 'remove-master') {
    const group = control.closest('.master-bit');
    group?.remove();
  }

  if (groupColumn && groupColumn.children.length === 0) {
    groupColumn.remove();
  }

  updateMasterCheckboxes(root);
  persistState(root);
  requestAnimationFrame(() => syncPanelWidths(root));
}

function handleSortableDrop(event, root) {
  const detail = event.detail;
  if (!detail) return;
  const { item, from, to } = detail;
  if (!(item instanceof HTMLElement) || !(to instanceof HTMLElement)) {
    updateMasterCheckboxes(root);
    persistState(root);
    requestAnimationFrame(() => syncPanelWidths(root));
    return;
  }

  const movingWithinSameContainer = from === to;
  const toIsBits = to.matches('.bits');
  const toIsSubBits = to.matches('.sub-bits');

  if (!toIsBits && !toIsSubBits) {
    updateMasterCheckboxes(root);
    persistState(root);
    requestAnimationFrame(() => syncPanelWidths(root));
    return;
  }

  if (movingWithinSameContainer) {
    updateMasterCheckboxes(root);
    persistState(root);
    requestAnimationFrame(() => syncPanelWidths(root));
    return;
  }

  const labelSpan = item.querySelector('span');
  if (!labelSpan) {
    updateMasterCheckboxes(root);
    persistState(root);
    requestAnimationFrame(() => syncPanelWidths(root));
    return;
  }

  const text = labelSpan.textContent.trim();
  const checkbox = item.querySelector('.bit-checkbox');
  const checked = checkbox?.checked ?? false;
  const reference = item.nextSibling;

  const pkgRow = to.closest('tr[data-package]');
  const fallbackScope = pkgRow ? getPackageScope(pkgRow.dataset.package) : null;
  const targetScope =
    to.dataset.sortableScope ||
    to.dataset.sortableGroup ||
    fallbackScope ||
    null;

  item.remove();

  let replacement = null;

  if (toIsBits) {
    replacement = htmlToElement(looseBitMarkup({ text, checked }, targetScope));
  } else {
    const master = to.closest('.master-bit');
    const masterId = master?.dataset.master;
    if (!masterId) return;
    replacement = htmlToElement(subBitMarkup(masterId, { text, checked }, targetScope));
  }

  to.insertBefore(replacement, reference);
  registerCopyHandlers(replacement, () => editMode, showCopyHud);
  if (editMode) {
    enableDrag(replacement);
  }

  if (
    from &&
    typeof from.matches === 'function' &&
    from.matches('.sub-bits') &&
    from.children.length === 0
  ) {
    const emptyMaster = from.closest('.master-bit');
    if (emptyMaster && !emptyMaster.querySelector('.sub-bits li')) {
      emptyMaster.remove();
    }
  }

  updateMasterCheckboxes(root);
  persistState(root);
  requestAnimationFrame(() => syncPanelWidths(root));
}

function handlePanelAdd(control, root) {
  const panel = control.closest('.panel');
  if (!panel || panel.dataset.panelEditable !== 'true') return;

  const title = panel.dataset.panelTitle || panel.querySelector('h2')?.textContent || 'this panel';
  const value = prompt(`Add a new item to ${title}:`);
  if (!value) return;
  const text = value.trim();
  if (!text) return;

  const list = panel.querySelector('ul');
  if (!list) return;

  const item = htmlToElement(createPanelItemMarkup(text));
  list.appendChild(item);
  registerCopyHandlers(item, () => editMode, showCopyHud);

  if (editMode) {
    enableDrag(list);
  }

  persistState(root);
  requestAnimationFrame(() => syncPanelWidths(root));
}

function handlePanelToggleRemove(control) {
  const panel = control.closest('.panel');
  if (!panel || panel.dataset.panelEditable !== 'true') return;
  togglePanelRemoveMode(panel);
}

function handlePanelRemoveItem(control, root) {
  const panel = control.closest('.panel');
  if (!panel) return;
  const panelId = panel.dataset.panel;
  if (!panelRemoveModes.get(panelId)) return;

  const item = control.closest('li');
  if (!item) return;
  item.remove();
  persistState(root);
  requestAnimationFrame(() => syncPanelWidths(root));
}

function togglePanelRemoveMode(panel) {
  const panelId = panel.dataset.panel;
  const current = panelRemoveModes.get(panelId) || false;
  setPanelRemoveMode(panel, !current);
}

function setPanelRemoveMode(panel, nextState) {
  const panelId = panel.dataset.panel;
  panelRemoveModes.set(panelId, nextState);
  panel.classList.toggle('panel--remove-mode', nextState);
  const toggle = panel.querySelector('[data-action="panel-toggle-remove"]');
  if (toggle) {
    toggle.classList.toggle('active', nextState);
    toggle.setAttribute('aria-pressed', String(nextState));
  }
  const root = panel.closest('.page-shell');
  if (root) {
    requestAnimationFrame(() => syncPanelWidths(root));
  }
}

function handleMasterToggle(master, root) {
  const parentId = master.dataset.master;
  const group = master.closest('.master-bit');
  const children = group ? group.querySelectorAll(`.sub-checkbox[data-parent="${parentId}"]`) : [];
  children.forEach(child => {
    child.checked = master.checked;
  });
  master.indeterminate = false;
  persistState(root);
}

function handleSubToggle(sub, root) {
  const parentId = sub.dataset.parent;
  const group = sub.closest('.master-bit');
  const master = group?.querySelector('.master-checkbox');
  if (!master) return;

  const children = group.querySelectorAll(`.sub-checkbox[data-parent="${parentId}"]`);
  const checkedCount = Array.from(children).filter(cb => cb.checked).length;

  if (checkedCount === 0) {
    master.checked = false;
    master.indeterminate = false;
  } else if (checkedCount === children.length) {
    master.checked = true;
    master.indeterminate = false;
  } else {
    master.checked = false;
    master.indeterminate = true;
  }
  persistState(root);
}

function updateMasterCheckboxes(root) {
  root.querySelectorAll('.master-checkbox').forEach(master => {
    const parentId = master.dataset.master;
    const group = master.closest('.master-bit');
    if (!group) return;
    const children = group.querySelectorAll(`.sub-checkbox[data-parent="${parentId}"]`);
    if (children.length === 0) {
      master.checked = false;
      master.indeterminate = false;
      return;
    }

    const checkedCount = Array.from(children).filter(cb => cb.checked).length;
    if (checkedCount === 0) {
      master.checked = false;
      master.indeterminate = false;
    } else if (checkedCount === children.length) {
      master.checked = true;
      master.indeterminate = false;
    } else {
      master.checked = false;
      master.indeterminate = true;
    }
  });
}

function collectState(root) {
  const panelState = Array.from(root.querySelectorAll('.panel')).reduce((acc, panel) => {
    const id = panel.dataset.panel;
    acc[id] = Array.from(panel.querySelectorAll('li code')).map(code => code.textContent.trim());
    return acc;
  }, {});

  const packageState = Array.from(root.querySelectorAll('tbody tr')).reduce((acc, row) => {
    const pkgCode = row.dataset.package;
    const bitsList = row.querySelector('ul.bits');
    const bits = bitsList
      ? Array.from(bitsList.querySelectorAll('li')).map(li => {
          const checkbox = li.querySelector('.bit-checkbox');
          const text = li.querySelector('span')?.textContent.trim() ?? '';
          return { text, checked: checkbox?.checked ?? false };
        })
      : [];

    const groups = Array.from(row.querySelectorAll('.master-bit')).map(group => {
      const master = group.querySelector('.master-checkbox');
      const labelText = group.querySelector('.master-label span')?.textContent.trim() ?? '';
      return {
        masterId: master?.dataset.master ?? '',
        label: labelText,
        checked: master?.checked ?? false,
        indeterminate: master?.indeterminate ?? false,
        items: Array.from(group.querySelectorAll('.sub-bits li')).map(item => {
          const checkbox = item.querySelector('.sub-checkbox');
          const text = item.querySelector('span')?.textContent.trim() ?? '';
          return { text, checked: checkbox?.checked ?? false };
        })
      };
    });

    acc[pkgCode] = { bits, groups };
    return acc;
  }, {});

  return { panels: panelState, packages: packageState };
}

function persistState(root) {
  saveState(collectState(root));
}

function applyState(root, state) {
  if (state.panels) {
    Object.entries(state.panels).forEach(([panelId, items]) => {
      const panel = root.querySelector(`.panel[data-panel="${escapeSelector(panelId)}"]`);
      if (!panel) return;
      const list = panel.querySelector('ul');
      if (!list) return;
      list.innerHTML = items.map(item => createPanelItemMarkup(item)).join('');
    });
  }

  if (state.packages) {
    Object.entries(state.packages).forEach(([pkgCode, pkgState]) => {
      const row = root.querySelector(`tr[data-package="${escapeSelector(pkgCode)}"]`);
      if (!row) return;

      const scope = getPackageScope(pkgCode);
      const bitsList = row.querySelector('ul.bits');
      if (bitsList && Array.isArray(pkgState.bits)) {
        bitsList.innerHTML = pkgState.bits.map(bit => looseBitMarkup(bit, scope)).join('');
      }

      const layout = row.querySelector('.bits-layout');
      if (!layout) return;

      const hasGroups = Array.isArray(pkgState.groups) && pkgState.groups.length > 0;
      let groupColumn = layout.querySelector('.group-column');

      if (hasGroups) {
        if (!groupColumn) {
          groupColumn = document.createElement('div');
          groupColumn.className = 'group-column';
          layout.insertAdjacentElement('afterbegin', groupColumn);
        }
        groupColumn.innerHTML = pkgState.groups.map(group => masterBitMarkup(group, scope)).join('');
      } else if (groupColumn) {
        groupColumn.remove();
      }
    });
  }

  root.querySelectorAll('.master-checkbox[data-indeterminate="true"]').forEach(master => {
    master.indeterminate = true;
    master.removeAttribute('data-indeterminate');
  });

  if (editMode) {
    enableDrag(root);
  }

  requestAnimationFrame(() => syncPanelWidths(root));
}

function masterBitMarkup(group, scope) {
  const label = group.label ?? masterLabelLookup.get(group.masterId) ?? '';
  const items = (group.items || []).map(item => normaliseBit(item)).filter(item => item.text);
  if (!label && items.length === 0) {
    return '';
  }

  const checkedAttr = group.checked ? ' checked' : '';
  const indeterminateAttr = group.indeterminate ? ' data-indeterminate="true"' : '';
  const safeMasterId = escapeAttr(group.masterId);
  const safeLabel = escapeHtml(label);
  const safeScopeAttr = scope ? ` data-sortable-scope="${escapeAttr(scope)}"` : '';

  const itemsMarkup = items
    .map(item => subBitMarkup(group.masterId, item, scope))
    .join('');

  if (!itemsMarkup) {
    return '';
  }

  return `
    <div class="master-bit" data-master="${safeMasterId}" data-master-label="${escapeAttr(label)}">
      <div class="master-header">
        <label class="master-label">
          <input type="checkbox" class="bit-checkbox master-checkbox" data-master="${safeMasterId}"${checkedAttr}${indeterminateAttr}>
          <span>${safeLabel}</span>
        </label>
        <button type="button" class="bit-remove-btn master-remove-btn" data-action="remove-master" aria-label="Remove ${escapeAttr(label)} group">×</button>
      </div>
      <ul class="sub-bits" data-sortable-group="${safeMasterId}"${safeScopeAttr}>
        ${itemsMarkup}
      </ul>
    </div>
  `;
}

function subBitMarkup(masterId, bit, scope) {
  const normalised = normaliseBit(bit);
  const checkedAttr = normalised.checked ? ' checked' : '';
  const safeText = escapeHtml(normalised.text);
  const safeAttrText = escapeAttr(normalised.text);
  const safeMasterId = escapeAttr(masterId);
  const scopeAttr = scope ? ` data-sortable-scope="${escapeAttr(scope)}"` : '';

  return `
    <li data-sortable-item data-bit="${safeAttrText}"${scopeAttr}>
      <label>
        <input type="checkbox" class="bit-checkbox sub-checkbox" data-parent="${safeMasterId}"${checkedAttr}>
        <span>${safeText}</span>
      </label>
      <button type="button" class="bit-remove-btn" data-action="remove-sub-bit" aria-label="Remove ${safeAttrText}">×</button>
    </li>
  `;
}

function looseBitMarkup(bit, scope) {
  const normalised = normaliseBit(bit);
  const checkedAttr = normalised.checked ? ' checked' : '';
  const safeText = escapeHtml(normalised.text);
  const safeAttrText = escapeAttr(normalised.text);
  const scopeAttr = scope ? ` data-sortable-scope="${escapeAttr(scope)}"` : '';

  return `
    <li data-sortable-item data-bit="${safeAttrText}"${scopeAttr}>
      <label>
        <input type="checkbox" class="bit-checkbox"${checkedAttr}>
        <span>${safeText}</span>
      </label>
      <button type="button" class="bit-remove-btn" data-action="remove-loose-bit" aria-label="Remove ${safeAttrText}">×</button>
    </li>
  `;
}

function normaliseBit(bit) {
  if (typeof bit === 'string') {
    return { text: bit, checked: false };
  }
  return {
    text: bit?.text ?? '',
    checked: Boolean(bit?.checked)
  };
}

function htmlToElement(markup) {
  const template = document.createElement('template');
  template.innerHTML = markup.trim();
  return template.content.firstElementChild;
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value = '') {
  return escapeHtml(value);
}

function resetModes(root) {
  packageAddMode = false;
  packageRemoveMode = false;
  updatePackageModeUI(root);
  root.querySelectorAll('.panel').forEach(panel => setPanelRemoveMode(panel, false));
}

function exitEditMode(root) {
  if (!editMode) return;
  editMode = false;
  document.body.classList.remove('edit-mode');
  const editButton = root.querySelector('#edit-mode-btn');
  if (editButton) {
    editButton.classList.remove('active');
    editButton.textContent = 'Edit Order';
  }
  disableDrag(root);
}

function escapeSelector(value = '') {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return String(value).replace(/([ !"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~])/g, '\\$1');
}

function getPackageScope(pkgCode) {
  return PACKAGE_SCOPE;
}

function syncPanelWidths(root) {
  if (!root || typeof window === 'undefined') return;

  if (window.matchMedia && window.matchMedia('(max-width: 1024px)').matches) {
    document.documentElement.style.removeProperty('--right-panel-width');
    document.documentElement.style.removeProperty('--layout-content-width');
    return;
  }

  const maintenance =
    root.querySelector('.panel[data-panel="maintenance-skus"]') ||
    root.querySelector('.panel[data-panel="maintenance-combined"]') ||
    root.querySelector('.panels .panel');
  if (maintenance) {
    const panelWidth = maintenance.getBoundingClientRect().width;
    if (Number.isFinite(panelWidth) && panelWidth > 0) {
      document.documentElement.style.setProperty(
        '--right-panel-width',
        `${Math.ceil(panelWidth)}px`
      );
    }
  }

  const block = root.querySelector('.block');
  if (!block) return;

  const tableColumn = block.querySelector('.table-column');
  const panelsColumn = block.querySelector('.panels');
  const blockRect = block.getBoundingClientRect();
  let left = blockRect.left;
  let right = blockRect.right;

  if (tableColumn) {
    const rect = tableColumn.getBoundingClientRect();
    if (Number.isFinite(rect.left) && Number.isFinite(rect.right)) {
      left = Math.min(left, rect.left);
      right = Math.max(right, rect.right);
    }
  }

  if (panelsColumn) {
    const rect = panelsColumn.getBoundingClientRect();
    if (Number.isFinite(rect.left) && Number.isFinite(rect.right)) {
      left = Math.min(left, rect.left);
      right = Math.max(right, rect.right);
    }
  }

  const width = Math.max(0, right - left);

  document.documentElement.style.setProperty(
    '--layout-content-width',
    `${Math.ceil(width || blockRect.width)}px`
  );
}

function ensureWidthSyncListener() {
  if (widthSyncListenerAttached || typeof window === 'undefined') return;
  const handler = () => {
    if (widthSyncRoot) {
      syncPanelWidths(widthSyncRoot);
    }
  };
  window.addEventListener('resize', handler);
  widthSyncListenerAttached = true;
}

function openAbout(root) {
  const overlay = root.querySelector('.about-overlay');
  if (!overlay) return;
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
}

function closeAbout(root) {
  const overlay = root.querySelector('.about-overlay');
  if (!overlay) return;
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');
}

function buildMasterLabelLookup() {
  return packages.reduce((map, pkg) => {
    (pkg.groups || []).forEach(group => {
      map.set(group.masterId, group.label);
    });
    return map;
  }, new Map());
}
