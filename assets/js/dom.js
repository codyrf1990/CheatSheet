import { headerLinks, packages, panels } from './data.js';
import { registerCopyHandlers, bindCopyHandler } from './copy.js';
import { enableDrag, disableDrag } from './drag-and-drop.js';
import { loadState, clearState } from './persistence.js';
import { stateQueue } from './state-queue.js';
import { logger } from './debug-logger.js';
import { PageSystem } from './page-system.js';

// Thanksgiving mode toggle - set to false after Thanksgiving
const THANKSGIVING_MODE = true;

let editMode = false;
let packageAddMode = false;
let packageRemoveMode = false;
const panelRemoveModes = new Map();
const masterLabelLookup = buildMasterLabelLookup();
const PACKAGE_SCOPE = 'package-bits';
const EDIT_MODE_GUARD_INTERVAL = 15000;
let widthSyncRoot = null;
let widthSyncListenerAttached = false;
let widthSyncScheduled = false;
let lastRightPanelWidth = null;
let lastLayoutContentWidth = null;
let widthSyncDirty = false;
let editModeGuardId = null;
let copyHudEl = null;
let copyHudTimer = null;
let pageSystem = null;

export function renderApp(mount) {
  editMode = false;
  document.body.classList.remove('edit-mode');
  packageAddMode = false;
  packageRemoveMode = false;
  panelRemoveModes.clear();

  // Initialize page system
  if (!pageSystem) {
    pageSystem = new PageSystem();
    pageSystem.load();
  }

  mount.innerHTML = `
    <div class="page-shell">
      ${renderHeader()}
      ${renderPageSystemControls()}
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

  // Tab-switching event handler for products modal
  root.addEventListener('click', event => {
    const tab = event.target.closest('.products-tab');
    if (!tab) return;

    const tabName = tab.dataset.tab;
    const modal = tab.closest('[data-modal="current-products"]');
    if (!modal) return;

    // Update active tab
    modal.querySelectorAll('.products-tab').forEach(t => t.classList.remove('is-active'));
    tab.classList.add('is-active');

    // Update content
    const contentArea = modal.querySelector('[data-products-content]');
    if (contentArea) {
      let html = '';
      switch (tabName) {
        case 'overview':
          html = renderProductsOverview();
          break;
        case 'milling':
          html = renderMillingModules();
          break;
        case 'other':
          html = renderOtherModules();
          break;
        case 'training':
          html = renderTrainingDiscounts();
          break;
        case 'posts':
          html = renderPostProcessors();
          break;
      }
      contentArea.innerHTML = html;
      contentArea.scrollTop = 0;
    }
  });

  // Global click listener to close operations dropdown when clicking outside
  document.addEventListener('click', event => {
    const operationsMenu = document.querySelector('[data-operations-menu]');
    const operationsDropdown = event.target.closest('.operations-dropdown');
    if (operationsMenu && !operationsMenu.hidden && !operationsDropdown) {
      operationsMenu.hidden = true;
    }
  });

  tableBody.addEventListener('change', event => handleTableChange(event, root));
  root.addEventListener('change', event => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.matches('.panel-item-checkbox')) {
      persistState(root);
    }
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

      // Reset current pages (keeps saved companies)
      if (pageSystem) {
        pageSystem.resetPages();
      }

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

  // Load current page state from page system
  if (pageSystem) {
    const pageState = pageSystem.getCurrentPageState();
    if (pageState && (pageState.panels || pageState.packages)) {
      applyState(root, pageState);
    }
  }

  // Attach page system event listeners
  attachPageSystemListeners(root);

  // Setup auto-save
  setupAutoSave(root);

  updateMasterCheckboxes(root);
  registerCopyHandlers(root, () => editMode, showCopyHud);
  root.querySelectorAll('.bits li, .sub-bits li, .master-bit').forEach(item => {
    bindBitCopyHandler(item, () => editMode, showCopyHud);
  });
  widthSyncRoot = root;
  schedulePanelWidthSync(root);
  ensureWidthSyncListener();

  // Inject About overlay once per render
  if (!root.querySelector('.about-overlay')) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = renderAboutOverlay();
    root.appendChild(wrapper.firstElementChild);
  }

  // Inject Sales Tax modal once per render
  if (!root.querySelector('[data-modal="sales-tax"]')) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = renderSalesTaxModal();
    root.appendChild(wrapper.firstElementChild);
  }

  // Inject Current Products modal once per render
  if (!root.querySelector('[data-modal="current-products"]')) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = renderCurrentProductsModal();
    root.appendChild(wrapper.firstElementChild);
  }

  // Setup modal backdrop click and keyboard handlers
  setupModalBackdropHandlers(root);
  setupModalKeyboardHandlers(root);

  // Inject Thanksgiving overlay if enabled
  if (THANKSGIVING_MODE && !root.querySelector('.thanksgiving-overlay')) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = renderThanksgivingOverlay();
    root.appendChild(wrapper.firstElementChild);
    // Initialize turkey hunt game
    initTurkeyHunt();
  }

  // Defensive: if the tab is backgrounded and later restored, ensure edit mode is off
  const exitEditIfNeeded = () => exitEditMode(root);
  window.addEventListener('focus', exitEditIfNeeded);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') exitEditIfNeeded();
  });
  window.addEventListener('pageshow', () => exitEditIfNeeded());

  // Periodic guard: if body has edit-mode but internal flag is false, clear it
  if (typeof window !== 'undefined' && window.__TEST_ENV__) {
    if (editModeGuardId) {
      clearInterval(editModeGuardId);
      editModeGuardId = null;
    }
  } else {
    if (editModeGuardId) clearInterval(editModeGuardId);
    editModeGuardId = setInterval(() => {
      if (!editMode && document.body.classList.contains('edit-mode')) {
        exitEditMode(root);
      }
    }, EDIT_MODE_GUARD_INTERVAL);
  }
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

  let top = window.innerHeight / 2;
  let left = window.innerWidth / 2;
  if (posOrEl && typeof posOrEl === 'object') {
    if (typeof posOrEl.x === 'number' && typeof posOrEl.y === 'number') {
      left = posOrEl.x;
      top = posOrEl.y;
    } else if (typeof posOrEl.getBoundingClientRect === 'function') {
      const rect = posOrEl.getBoundingClientRect();
      top = rect.top + rect.height / 2;
      left = rect.left + rect.width / 2;
    }
  }
  el.style.top = `${top}px`;
  el.style.left = `${left}px`;

  el.classList.add('show');
  clearTimeout(copyHudTimer);
  copyHudTimer = setTimeout(() => el.classList.remove('show'), 600);
}

/**
 * Binds double-click copy handler to a bit's text span.
 * Double-click copies the bit text to clipboard without affecting checkbox state.
 * Copying is disabled during edit mode (consistent with code chips).
 *
 * @param {HTMLElement} listItem - The <li> or container element with the bit
 * @param {Function} isEditMode - Function returning current edit mode state
 * @param {Function} onCopy - Callback for copy notification (receives pos, text)
 */
function bindBitCopyHandler(listItem, isEditMode, onCopy) {
  if (!listItem) return;

  const textSpan = listItem.querySelector('label > span');
  if (!textSpan || textSpan.dataset.copyBound === 'true') return;

  textSpan.dataset.copyBound = 'true';

  textSpan.addEventListener('dblclick', async e => {
    if (isEditMode()) return;

    e.preventDefault();
    e.stopPropagation();

    const text = textSpan.textContent.trim();
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);

      textSpan.classList.add('bit-copied');
      setTimeout(() => textSpan.classList.remove('bit-copied'), 400);

      const pos = { x: e.clientX, y: e.clientY };
      if (typeof onCopy === 'function') {
        onCopy(pos, text);
      }

      window.dispatchEvent(
        new CustomEvent('copy-hud', {
          detail: { x: pos.x, y: pos.y, target: textSpan, text }
        })
      );
    } catch (error) {
      console.error('Clipboard copy failed for bit:', text, error);
    }
  });
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
          <div class="operations-dropdown">
            <button type="button"
                    class="operations-button"
                    data-action="toggle-operations"
                    title="Operations menu">
              Operations
            </button>
            <div class="operations-menu" data-operations-menu hidden>
              <button data-action="open-sales-tax">Sales Tax Guide</button>
              <button data-action="open-current-products">Product Catalog</button>
            </div>
          </div>
        </div>
      </div>
      <div class="header-spacer"></div>
    </header>
  `;
}

function renderHeaderLink(link) {
  const intentClass = `${link.intent}-button`;
  const safeLabel = escapeHtml(link.label);
  const titleAttr = link.description ? ` title="${escapeAttr(link.description)}"` : '';

  // If this is a modal button, render as button with data-action
  if (link.isModal) {
    return `
      <button type="button" class="${intentClass}" data-action="open-${link.intent}"${titleAttr}>
        ${safeLabel}
      </button>
    `;
  }

  // Otherwise render as external link
  const safeHref = escapeAttr(link.href);
  return `
    <a href="${safeHref}" class="${intentClass}" target="_blank" rel="noopener noreferrer"${titleAttr}>
      ${safeLabel}
    </a>
  `;
}

function renderPageSystemControls() {
  if (!pageSystem) return '';

  const company = pageSystem.getCurrentCompany();
  if (!company) return '';

  const pages = company.pages;
  const currentId = company.currentPageId;

  return `
    <div class="page-system">
      <button class="page-system-info-btn" data-action="toggle-page-system-help" type="button" title="How to use">
        <img src="assets/img/about-gold-circle-23095.svg" alt="About">
      </button>

      <div class="page-system-help-tooltip" data-page-system-help hidden>
        <div class="page-system-help-content">
          <h3>How to Use Page System</h3>
          <ul>
            <li><strong>Company Dropdown:</strong> Select and switch between different companies</li>
            <li><strong>🏢 New Company:</strong> Create a new company</li>
            <li><strong>✏️ Rename:</strong> Rename the current company</li>
            <li><strong>📋 Duplicate:</strong> Create a copy of the current company</li>
            <li><strong>🗑️ Delete:</strong> Delete the current company</li>
            <li><strong>Page Tabs:</strong> Click to switch between pages. Double-click a tab to rename it</li>
            <li><strong>+ New:</strong> Create a new page in the current company</li>
            <li><strong>📋 Copy:</strong> Duplicate the current page</li>
            <li><strong>🗑️ Delete:</strong> Delete the current page</li>
          </ul>
        </div>
      </div>

      <div class="page-system-company-row">
        <div class="page-system-company">
          ${renderCompanyDropdown()}
        </div>

        <div class="company-actions-row">
          <button class="page-action-btn page-action-btn--company" data-action="new-company-quick" title="Create new company">🏢 New Company</button>
          <button class="company-action-btn" data-action="rename-company" type="button" title="Rename current company">✏️ Rename</button>
          <button class="company-action-btn" data-action="duplicate-company" type="button" title="Duplicate current company">📋 Duplicate</button>
          <button class="company-action-btn company-action-btn--danger" data-action="delete-company" type="button" title="Delete current company">🗑️ Delete</button>
        </div>
      </div>

      <div class="page-system-tabs">
        <div class="page-tabs" data-page-tabs>
          ${pages.map(page => `
            <button
              class="page-tab${page.id === currentId ? ' active' : ''}"
              data-page-id="${escapeAttr(page.id)}"
              title="Double-click to rename"
            >${escapeHtml(page.name)}</button>
          `).join('')}
        </div>
        <div class="page-actions">
          <button class="page-action-btn" data-action="new-page" title="Create new page">+ New</button>
          <button class="page-action-btn" data-action="copy-page" title="Duplicate current page">📋 Copy</button>
          <button class="page-action-btn" data-action="delete-page" title="Delete current page">🗑️ Delete</button>
        </div>
      </div>
    </div>
  `;
}

function renderCompanyDropdown() {
  if (!pageSystem || !pageSystem.currentCompanyId) return '';

  const current = pageSystem.getCurrentCompany();
  if (!current) return '';

  const allCompanies = pageSystem.companies;
  const favorites = pageSystem.getFavorites();
  const recent = pageSystem.getRecent(10);
  const statusIcon = '●'; // Will be updated dynamically by updateSaveStatus

  return `
    <div class="company-dropdown">
      <button
        class="company-dropdown-trigger"
        data-action="toggle-company-dropdown"
        type="button"
      >
        ${escapeHtml(current.name)} <span class="status-indicator saved">${statusIcon}</span> ▼
      </button>

      <div class="company-dropdown-menu" data-company-menu hidden>
        <div class="company-dropdown-header">
          <span class="save-status" data-save-time>Auto-saved</span>
          <span class="company-total-count">${allCompanies.length} ${allCompanies.length === 1 ? 'Company' : 'Companies'}</span>
        </div>

        <div class="company-dropdown-section">
          <input
            type="search"
            class="company-search-input"
            placeholder="🔍 Search companies..."
            data-action="search-companies"
          />
        </div>

        ${favorites.length > 0 ? `
          <div class="company-dropdown-section">
            <div class="company-section-title">⭐ Favorites (${favorites.length})</div>
            <div class="company-list">
              ${favorites.map(company => {
    const isCurrent = company.id === current.id;
    return `
                  <div class="company-list-item-wrapper">
                    <button
                      class="company-list-item${isCurrent ? ' active' : ''}"
                      data-action="switch-company"
                      data-company-id="${escapeAttr(company.id)}"
                      type="button"
                    >
                      ${escapeHtml(company.name)} ${isCurrent ? '●' : ''}
                    </button>
                    <button
                      class="favorite-toggle active"
                      data-action="toggle-favorite"
                      data-company-id="${escapeAttr(company.id)}"
                      title="Remove from favorites"
                      type="button"
                    >★</button>
                  </div>
                `;
  }).join('')}
            </div>
          </div>
        ` : ''}

        ${recent.length > 0 ? `
          <div class="company-dropdown-section">
            <div class="company-section-title">🕒 Recent (${recent.length})</div>
            <div class="company-list">
              ${recent.map(company => {
    const isCurrent = company.id === current.id;
    const isFavorite = pageSystem.favoriteCompanyIds.includes(company.id);
    return `
                  <div class="company-list-item-wrapper">
                    <button
                      class="company-list-item${isCurrent ? ' active' : ''}"
                      data-action="switch-company"
                      data-company-id="${escapeAttr(company.id)}"
                      type="button"
                    >
                      ${escapeHtml(company.name)} ${isCurrent ? '●' : ''}
                    </button>
                    <button
                      class="favorite-toggle${isFavorite ? ' active' : ''}"
                      data-action="toggle-favorite"
                      data-company-id="${escapeAttr(company.id)}"
                      title="${isFavorite ? 'Remove from favorites' : 'Add to favorites'}"
                      type="button"
                    >${isFavorite ? '★' : '☆'}</button>
                  </div>
                `;
  }).join('')}
            </div>
          </div>
        ` : ''}

        <div class="company-dropdown-section" data-search-results-section hidden>
          <div class="company-section-title">Search Results</div>
          <div class="company-list" data-search-results-list></div>
        </div>

        <div class="company-dropdown-section company-dropdown-section--centered">
          <div class="company-search-hint">💡 Use search to find companies</div>
          <button class="company-browse-btn" data-action="browse-all-companies" type="button">
            📋 Browse All →
          </button>
        </div>

        <div class="company-dropdown-section">
          <button class="company-new-btn" data-action="new-company" type="button">+ New Company</button>
        </div>
      </div>
    </div>
  `;
}

function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function renderMaintenanceCombinedPanel() {
  const maint = (panels || []).find(p => p.id === 'maintenance-skus');
  const sw = (panels || []).find(p => p.id === 'solidworks-maintenance');
  const maintItems = (maint?.items || [])
    .map(item => createPanelItemMarkup(item, { withCheckbox: true }))
    .join('');
  const swItems = (sw?.items || [])
    .map(item => createPanelItemMarkup(item, { withCheckbox: true }))
    .join('');

  const controls = `
      <div class="panel-controls">
        <button
          type="button"
          class="panel-mode-btn"
          data-action="panel-add-item"
          aria-label="Add item to Maintenance SKUs"
        >+</button>
        <button
          type="button"
          class="panel-mode-btn"
          data-action="panel-toggle-remove"
          aria-pressed="false"
          aria-label="Toggle delete mode for Maintenance SKUs"
        >&minus;</button>
      </div>
    `;

  return `
    <section class="panel" data-panel="maintenance-combined" data-panel-editable="true" data-panel-title="Maintenance SKUs">
      <div class="panel-head">
        <h2>Maintenance SKUs</h2>
        ${controls}
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
    <div class="about-overlay" role="dialog" aria-modal="true">
      <div class="about-modal">
        <div class="about-modal-head">
          <h3>About This Cheat Sheet</h3>
          <button type="button" class="about-close" data-action="close-about" aria-label="Close">×</button>
        </div>
        <div class="about-modal-body">
          <p>Quick guide for teammates. Use this page to pick packages, prep customer comms, and generate Outlook-ready emails fast.</p>
          <h4>Sections at a glance</h4>
          <ul>
            <li><strong>Package Bits</strong> (left column): pick master groups such as <em>25M</em>, expand their items, and toggle individual bits.</li>
            <li><strong>Right-hand panels</strong> (<em>Standalone Modules</em>, <em>Maintenance SKUs</em>, <em>SolidWorks Maintenance</em>): quick-reference lists for add-ons and renewals. The cards stay fixed; rows compress when delete mode is active.</li>
            <li><strong>Calculator</strong>: fast math plus one-tap percentage shortcuts, anchored under the maintenance panels.</li>
            <li><strong>Email Templates</strong>: build, preview, and launch Outlook-ready drafts with placeholder personalization.</li>
          </ul>
          <h4>Package & panel workflow</h4>
          <ul>
            <li><strong>Included Bits</strong>: tick the bits that apply. Master groups like <em>25M</em> expand to show all bundled items. <strong>Double-click any bit name</strong> to copy it to your clipboard.</li>
            <li><strong>Add / Remove Bit</strong>: switch modes to insert or delete custom entries inside a package list.</li>
            <li><strong>Edit Order</strong>: toggles drag-and-drop across packages, loose bits, and reference panels; click again to save the layout.</li>
            <li><strong>Reset Order</strong>: restore the default ordering and remove custom rows.</li>
            <li><strong>Reset Checks</strong>: clear every checkbox without touching layout or custom rows.</li>
            <li><strong>Copy chips</strong>: click any code chip to copy—copying pauses automatically while editing.</li>
            <li><strong>Autosave</strong>: selections and layout persist per browser profile; use Reset Order for a clean slate.</li>
          </ul>
          <h4>Calculator & quick percentages</h4>
          <ul>
            <li>Keypad supports decimals, <code>+/−</code>, delete/backspace, and chained operations.</li>
            <li>Layout: the <strong>=</strong> key sits beneath <strong>+</strong> and spans two rows. Quick percentage buttons (5%–30%) sit along the bottom row under <code>+/−</code>, <code>0</code>, and <code>.</code>.</li>
            <li>Behavior: after pressing <strong>=</strong>, entering a number starts fresh; choosing an operator continues using the previous result.</li>
            <li>Quick % buttons calculate against the current entry, or—once you pick an operator—the first operand.</li>
          </ul>
          <h4>Email template system</h4>
          <ul>
            <li><strong>Browse panel</strong>: search templates, select one, personalize the placeholders, and copy or launch Outlook with subject/body pre-filled.</li>
            <li><strong>Placeholders</strong>: required fields highlight until filled. Values remain scoped to your session.</li>
            <li><strong>Quick Launch</strong>: the Outlook button uses <code>mailto:</code>; if content exceeds the size limit you’ll get a warning and can copy instead.</li>
            <li><strong>Manage mode</strong>: add, edit, clone, delete, and reorder templates via the hover move arrows. Changes persist locally; Restore Defaults reloads the starter set.</li>
          </ul>
          <h4>Maintenance Specialist Notes</h4>
          <p><strong>Important Technical Discovery — Hardware Dongle Network Licenses</strong></p>
          <ul>
            <li>For network hardware dongles (Mini USB or Mini Ethernet), renewals must be based on <strong>profiles</strong>, not buckets.</li>
            <li>Product key network licenses can continue to use bucket-based renewals.</li>
            <li>This impacts existing estimates built against buckets — revise them when a hardware dongle is confirmed.</li>
          </ul>
          <p><strong>SW Pro Net licensing quirk:</strong> accounts can show three dongles, but only one is the primary SolidWorks key.</p>
          <p><strong>Sim 5x Level Logic — Concise Reference (Profile-based dongles only)</strong></p>
          <table class="about-note-table" aria-label="Sim 5x level mapping">
            <thead>
              <tr>
                <th scope="col">Sim 5x Bit</th>
                <th scope="col">Sim 5x Level</th>
                <th scope="col">Maps To</th>
                <th scope="col">Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>0</strong></td>
                <td>Any</td>
                <td>None</td>
                <td>Bit disabled — ignore level.</td>
              </tr>
              <tr>
                <td><strong>1</strong></td>
                <td>"3 Axis" or "1"</td>
                <td><strong>SC-HSS-Maint</strong> only</td>
                <td>Restricted to 3-axis HSS.</td>
              </tr>
              <tr>
                <td><strong>1</strong></td>
                <td>"3/4 Axis"</td>
                <td><strong>SC-HSS-Maint</strong> + <strong>SC-Sim4x-Maint</strong></td>
                <td>Allows 4-axis simultaneous.</td>
              </tr>
              <tr>
                <td><strong>1</strong></td>
                <td>Blank / empty</td>
                <td>Check all 5-axis bits</td>
                <td>Unrestricted — follow package default logic.</td>
              </tr>
            </tbody>
          </table>
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

function renderSalesTaxModal() {
  return `
    <div class="about-overlay" data-modal="sales-tax" role="dialog" aria-modal="true">
      <div class="about-modal">
        <div class="about-modal-head">
          <h3>U.S. Sales Tax Guide 2025</h3>
          <button type="button" class="about-close" data-action="close-modal" aria-label="Close">×</button>
        </div>
        <div class="about-modal-body">
          <h4>States Required to Collect Sales Tax</h4>
          <p>The following states impose a state-level sales tax and require businesses with nexus to collect and remit sales tax on taxable goods and services:</p>
          <ul>
            <li>Arizona</li>
            <li>Colorado</li>
            <li>Pennsylvania</li>
            <li>South Carolina</li>
            <li>Tennessee</li>
            <li>Utah</li>
            <li>Washington</li>
            <li>Wisconsin</li>
            <li>Indiana</li>
            <li>Massachusetts</li>
            <li>Minnesota</li>
            <li>North Carolina</li>
            <li>Ohio</li>
            <li>Michigan</li>
          </ul>
          <p>These states generally tax tangible personal property and some services, with variations by state and locality.</p>

          <h4>States Exempt from State Sales Tax</h4>
          <p>These states do not impose a statewide sales tax on goods or services:</p>
          <ul>
            <li>Alaska <em>(Note: Some localities in Alaska impose local sales taxes)</em></li>
            <li>Delaware</li>
            <li>Montana</li>
            <li>New Hampshire</li>
            <li>Oregon</li>
          </ul>
          <p>Residents and businesses in these states do not pay state sales tax but should check local rules and other taxes like use tax, income tax, or business taxes.</p>

          <h4>States with Notable Exceptions on Sales Tax (Example: California)</h4>
          <p>California is a state with a state sales tax but it has complex rules and specific exemptions for certain products and services, including:</p>
          <ul>
            <li>Sales tax exemptions on most food products for human consumption</li>
            <li>Partial exemptions on certain medical devices</li>
            <li>Specific rules on services, digital goods, and other categories</li>
          </ul>
          <p>California's combined state and local sales tax rates can be as high as 16.75%, with nuanced rules about taxability by product category.</p>
        </div>
      </div>
    </div>
  `;
}

function renderCurrentProductsModal() {
  return `
    <div class="about-overlay" data-modal="current-products" role="dialog" aria-modal="true">
      <div class="about-modal modal--products" style="max-width: 95vw; width: 900px; max-height: 85vh; display: flex; flex-direction: column;">
        <div class="about-modal-head modal__header-row" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3 class="modal__title" style="margin: 0;">SolidCAM Product Catalog</h3>
          <button type="button" class="about-close modal__close-btn" data-action="close-modal" aria-label="Close">×</button>
        </div>
        <div class="products-tabs">
          <button class="products-tab is-active" data-tab="overview">Overview</button>
          <button class="products-tab" data-tab="milling">Milling</button>
          <button class="products-tab" data-tab="other">Other Modules</button>
          <button class="products-tab" data-tab="training">Training</button>
          <button class="products-tab" data-tab="posts">Post Processors</button>
        </div>
        <div class="about-modal-body products-content" data-products-content style="flex: 1; overflow-y: auto; padding-right: 0.5rem;">
          ${renderProductsOverview()}
        </div>
      </div>
    </div>
  `;
}

function renderProductsOverview() {
  return `
    <div class="products-section">
      <h4 class="products-section__title">Foundational Packages</h4>
      <div class="products-table">
        <div class="products-row products-row--header">
          <span>Product</span>
          <span>SKU</span>
          <span>Description</span>
        </div>
        <div class="products-row">
          <strong>SolidCAM Milling</strong>
          <code>SC-Mill</code>
          <span>2.5D toolpaths, 4th/5th indexing, C Axis Wrap, AFRM, Multi-Depth Drilling, HSS</span>
        </div>
        <div class="products-row">
          <strong>SolidCAM Turning</strong>
          <code>SC-Turn</code>
          <span>Foundational 2 Axis Turning including Back Spindle</span>
        </div>
      </div>
    </div>

    <div class="products-section">
      <h4 class="products-section__title">SW Bundles</h4>
      <div class="products-table">
        <div class="products-row products-row--header">
          <span>Product</span>
          <span>SKU</span>
          <span>Note</span>
        </div>
        <div class="products-row">
          <strong>Milling + SOLIDWORKS</strong>
          <code>SW-SC-Mill</code>
          <span>Adjust description to specific SW version</span>
        </div>
        <div class="products-row">
          <strong>Turning + SOLIDWORKS</strong>
          <code>SW-SC-Turn</code>
          <span>Adjust description to specific SW version</span>
        </div>
      </div>
    </div>

    <div class="products-section">
      <h4 class="products-section__title">Upgrade Packages</h4>
      <div class="products-table">
        <div class="products-row products-row--header">
          <span>Package</span>
          <span>SKU</span>
          <span>Includes</span>
        </div>
        <div class="products-row">
          <strong>Advanced Milling</strong>
          <code>SC-Mill-Adv</code>
          <span>iMachining 2D, Edge Breaking, Advanced Machine Simulation</span>
        </div>
        <div class="products-row">
          <strong>3D High Performance</strong>
          <code>SC-Mill-3D</code>
          <span>iMachining 3D, HSM (Requires iMachining 2D)</span>
        </div>
        <div class="products-row">
          <strong>5 Axis Milling</strong>
          <code>SC-Mill-5Axis</code>
          <span>Sim 4/5 Axis, Auto 3+2, Rotary, HSM to 5X Conversion, Geodesic, SWARF, Multiaxis</span>
        </div>
      </div>
    </div>

    <div class="products-section">
      <h4 class="products-section__title">SOLIDWORKS Product Codes</h4>
      <div class="products-grid">
        <div class="product-code-item">
          <code>SW-P</code>
          <span>Parts</span>
        </div>
        <div class="product-code-item">
          <code>SW-PA</code>
          <span>Parts & Assemblies</span>
        </div>
        <div class="product-code-item">
          <code>SW-Std</code>
          <span>Standard</span>
        </div>
        <div class="product-code-item">
          <code>SW-Pro</code>
          <span>Professional</span>
        </div>
        <div class="product-code-item">
          <code>SW-Std-Net</code>
          <span>Standard Networked</span>
        </div>
        <div class="product-code-item">
          <code>SW-Pro-Net</code>
          <span>Professional Networked</span>
        </div>
      </div>
      <p class="products-note">Add <code>-Maint</code> suffix for maintenance SKUs</p>
    </div>
  `;
}

function renderMillingModules() {
  return `
    <div class="products-section">
      <h4 class="products-section__title">Milling Modules</h4>
      <div class="products-list">
        <div class="product-item">
          <div class="product-item__header">
            <strong>2.5D Milling + AFRM</strong>
            <code>SC-25M</code>
          </div>
          <p>Profile, Pocket, Drilling, Automatic Feature Recognition, Multi-Depth-Drilling, 4th/5th Indexing, C Axis Wrap</p>
        </div>
        <div class="product-item">
          <div class="product-item__header">
            <strong>High-Speed Surfacing (HSS)</strong>
            <code>SC-HSS</code>
          </div>
          <p>Surface machining strategies for efficient, smooth, gouge-free toolpaths on prismatic and 3D parts</p>
        </div>
        <div class="product-item">
          <div class="product-item__header">
            <strong>High-Speed Roughing (HSR)</strong>
            <code>SC-HSR</code>
          </div>
          <p>Overall roughing of complex 3D parts (molds/dies), optimized for high-speed continuous motion</p>
        </div>
        <div class="product-item">
          <div class="product-item__header">
            <strong>High-Speed Machining (HSM)</strong>
            <code>SC-HSM</code>
          </div>
          <p>Roughing and finishing of complex 3D parts, includes HSR</p>
        </div>
        <div class="product-item">
          <div class="product-item__header">
            <strong>iMachining 2D</strong>
            <code>SC-iMach2d</code>
          </div>
          <p>Constant tool engagement, knowledge-based Technology Wizard for feeds/speeds/step-downs</p>
        </div>
        <div class="product-item">
          <div class="product-item__header">
            <strong>iMachining 3D</strong>
            <code>SC-iMach3D</code>
          </div>
          <p>Automated roughing and rest roughing for 3D parts</p>
        </div>
        <div class="product-item">
          <div class="product-item__header">
            <strong>Simultaneous 4 Axis</strong>
            <code>SC-Sim4x</code>
          </div>
          <p>Continuous 4-axis movement with collision checking</p>
        </div>
        <div class="product-item">
          <div class="product-item__header">
            <strong>Simultaneous 5 Axis Standard</strong>
            <code>SC-Sim5x</code>
          </div>
          <p>Auto 3+2 Roughing, Rotary, HSM to 5X Conversion, Contour, Multi Axis Drilling, Geodesic, SWARF</p>
        </div>
        <div class="product-item">
          <div class="product-item__header">
            <strong>Edge Breaking</strong>
            <code>SC-EdgeBreak</code>
          </div>
          <p>Automatic deburring with precise tool orientation</p>
        </div>
        <div class="product-item">
          <div class="product-item__header">
            <strong>Edge Trimming</strong>
            <code>SC-EdgeTrim</code>
          </div>
          <p>Precise trimming of thin materials</p>
        </div>
        <div class="product-item">
          <div class="product-item__header">
            <strong>Auto 3+2 Roughing</strong>
            <code>SC-Auto32</code>
          </div>
          <p>Intelligent 3+2 axis positioning and machining</p>
        </div>
        <div class="product-item">
          <div class="product-item__header">
            <strong>Multiaxis</strong>
            <code>SC-Multiaxis</code>
          </div>
          <p>Material removal on complex parts (impellers, turbine blades)</p>
        </div>
        <div class="product-item">
          <div class="product-item__header">
            <strong>Port</strong>
            <code>SC-Port</code>
          </div>
          <p>Intake/exhaust ducts with tapered lollipop tools</p>
        </div>
        <div class="product-item">
          <div class="product-item__header">
            <strong>Multiblade</strong>
            <code>SC-Multiblade</code>
          </div>
          <p>Impellers and bladed disks machining</p>
        </div>
      </div>
    </div>
  `;
}

function renderOtherModules() {
  return `
    <div class="products-section">
      <h4 class="products-section__title">Turning Modules</h4>
      <div class="products-list">
        <div class="product-item">
          <div class="product-item__header">
            <strong>Multi-Turret Sync</strong>
            <code>SC-MTS</code>
          </div>
          <p>Coordinates multiple turrets for simultaneous machining operations</p>
        </div>
        <div class="product-item">
          <div class="product-item__header">
            <strong>Swiss</strong>
            <code>SC-Swiss</code>
          </div>
          <p>Advanced programming for Swiss CNC machines</p>
        </div>
      </div>
    </div>

    <div class="products-section">
      <h4 class="products-section__title">Add-on Modules</h4>
      <div class="products-list">
        <div class="product-item">
          <div class="product-item__header">
            <strong>Machine Simulation</strong>
            <code>SC-MachSim</code>
          </div>
          <p>Advanced collision detection and toolpath verification using 3D machine models</p>
        </div>
        <div class="product-item">
          <div class="product-item__header">
            <strong>Solid Probe</strong>
            <code>SC-Probe</code>
          </div>
          <p>Home definition, On-Machine Verification, Tool Presetter Support, Probe cycle support</p>
        </div>
        <div class="product-item">
          <div class="product-item__header">
            <strong>Vericut Integration</strong>
            <code>SC-Vericut</code>
          </div>
          <p>Integration for Vericut G-code Simulation software</p>
        </div>
      </div>
    </div>

    <div class="products-section">
      <h4 class="products-section__title">SolidShop</h4>
      <div class="products-list">
        <div class="product-item">
          <div class="product-item__header">
            <strong>CIMCO Editor</strong>
            <code>SolidShop-Editor</code>
          </div>
          <p>G-Code editor with reliable editing, simulation and communication tools</p>
        </div>
        <div class="product-item">
          <div class="product-item__header">
            <strong>SolidCAM for Operators</strong>
            <code>SC-4Op</code>
          </div>
          <p>Shop floor program modifications and simulations (Windows tablets)</p>
        </div>
        <div class="product-item">
          <div class="product-item__header">
            <strong>Operators - Sim Only</strong>
            <code>SC-4Op-Sim</code>
          </div>
          <p>Simulation access only at the machine</p>
        </div>
      </div>
    </div>
  `;
}

function renderTrainingDiscounts() {
  return `
    <div class="products-section">
      <h4 class="products-section__title">Training Credits</h4>
      <p class="products-note">Credits apply to 1 hour remote training or $100 toward onsite training</p>
      <div class="products-grid">
        <div class="product-code-item">
          <code>SC-Mill</code>
          <span>2 credits</span>
        </div>
        <div class="product-code-item">
          <code>SC-Mill-Adv</code>
          <span>1 credit</span>
        </div>
        <div class="product-code-item">
          <code>SC-Mill-3D</code>
          <span>2 credits</span>
        </div>
        <div class="product-code-item">
          <code>SC-Mill-5Axis</code>
          <span>2 credits</span>
        </div>
        <div class="product-code-item">
          <code>SC-MTS</code>
          <span>2 credits</span>
        </div>
      </div>
    </div>

    <div class="products-section">
      <h4 class="products-section__title">Training Hours & Onsite</h4>
      <div class="products-table">
        <div class="products-row products-row--header">
          <span>SKU</span>
          <span>Description</span>
          <span>Price</span>
        </div>
        <div class="products-row">
          <code>Train-2hr</code>
          <span>One 2-hour 1-on-1 web training (expires 12 mo)</span>
          <strong>$350</strong>
        </div>
        <div class="products-row">
          <code>Train-8hr</code>
          <span>Four 2-hour 1-on-1 web sessions (expires 12 mo)</span>
          <strong>$1,295</strong>
        </div>
        <div class="products-row">
          <code>Train-Onsite</code>
          <span>Onsite training per day (+ travel costs)</span>
          <strong>$2,500</strong>
        </div>
      </div>
    </div>

    <div class="products-section">
      <h4 class="products-section__title">Discounts</h4>
      <div class="products-list">
        <div class="product-item">
          <div class="product-item__header">
            <strong>Standard Promotions</strong>
          </div>
          <p>10% off 2nd seat+ on single order OR up to 5% discretionary</p>
        </div>
        <div class="product-item">
          <div class="product-item__header">
            <strong>Renewals</strong>
          </div>
          <p>Year 2: 5% off • Year 3: 10% off</p>
        </div>
      </div>
      <div class="products-table" style="margin-top: 0.75rem;">
        <div class="products-row products-row--header">
          <span>Code</span>
          <span>Usage</span>
        </div>
        <div class="products-row">
          <code>Discount-Software</code>
          <span>All software discounts</span>
        </div>
        <div class="products-row">
          <code>Discount-Post</code>
          <span>Post discounts (requires Post Manager approval)</span>
        </div>
        <div class="products-row">
          <code>VCD</code>
          <span>Valued Customer Discount (pre-2025 CLR customers)</span>
        </div>
        <div class="products-row">
          <code>Tier-Discount</code>
          <span>Based on Total Software Value (TSV)</span>
        </div>
      </div>
      <div class="products-note" style="margin-top: 0.75rem;">
        <strong>Tier Discounts (based on TSV):</strong><br>
        Tier 3 ($100k-$199k): 10% off<br>
        Tier 2 ($200k-$299k): 15% off<br>
        Tier 1 ($300k+): 20% off
      </div>
    </div>
  `;
}

function renderPostProcessors() {
  return `
    <div class="products-section">
      <h4 class="products-section__title">Post Processor Services</h4>
      <p class="products-note">Lead time: 4-6 weeks. * = Simulation required</p>
      <div class="products-list">
        <div class="product-item">
          <div class="product-item__header">
            <strong>3X Milling</strong>
            <code>Post-3X</code> / <code>Post-3X-Derv</code>
          </div>
        </div>
        <div class="product-item">
          <div class="product-item__header">
            <strong>4X Milling</strong>
            <code>Post-4X</code> / <code>Post-4X-Derv</code>
          </div>
        </div>
        <div class="product-item">
          <div class="product-item__header">
            <strong>5X Milling</strong>
            <code>Post-5X</code> / <code>Post-5X-Derv</code>
          </div>
        </div>
        <div class="product-item">
          <div class="product-item__header">
            <strong>Turning</strong>
            <code>Post-Turn</code> / <code>Post-Turn-Derv</code>
          </div>
        </div>
        <div class="product-item">
          <div class="product-item__header">
            <strong>Mill-Turn 1 Channel</strong>
            <code>Post-MT1</code> / <code>Post-MT1-Derv</code>
          </div>
        </div>
        <div class="product-item">
          <div class="product-item__header">
            <strong>Mill-Turn 2 Channel *</strong>
            <code>Post-MT2</code> / <code>Post-MT2-Derv</code>
          </div>
        </div>
        <div class="product-item">
          <div class="product-item__header">
            <strong>Mill-Turn 3+ Channel *</strong>
            <code>Post-MT3</code> / <code>Post-MT3-Derv</code>
          </div>
        </div>
        <div class="product-item">
          <div class="product-item__header">
            <strong>Swiss Basic *</strong>
            <code>Post-Swiss</code> / <code>Post-Swiss-Derv</code>
          </div>
        </div>
        <div class="product-item">
          <div class="product-item__header">
            <strong>Swiss Advanced *</strong>
            <code>Post-Swiss-Adv</code> / <code>Post-Swiss-Adv-Derv</code>
          </div>
        </div>
        <div class="product-item">
          <div class="product-item__header">
            <strong>Swiss 3+ Channel *</strong>
            <code>Post-Swiss-3Ch</code> / <code>Post-Swiss-3Ch-Derv</code>
          </div>
        </div>
      </div>
    </div>

    <div class="products-section">
      <h4 class="products-section__title">Machine Simulation Development</h4>
      <p class="products-note">Customer must supply SolidWorks models of machine</p>
      <div class="products-grid">
        <div class="product-code-item">
          <code>PSim-3X</code>
          <span>3X Milling</span>
        </div>
        <div class="product-code-item">
          <code>PSim-4X</code>
          <span>4X Milling</span>
        </div>
        <div class="product-code-item">
          <code>PSim-5X</code>
          <span>5X Milling</span>
        </div>
        <div class="product-code-item">
          <code>PSim-Turn</code>
          <span>Turning</span>
        </div>
        <div class="product-code-item">
          <code>PSim-MT1</code>
          <span>Mill-Turn 1Ch</span>
        </div>
        <div class="product-code-item">
          <code>PSim-MT2</code>
          <span>Mill-Turn 2Ch</span>
        </div>
        <div class="product-code-item">
          <code>PSim-MT3</code>
          <span>Mill-Turn 3+Ch</span>
        </div>
        <div class="product-code-item">
          <code>PSim-Swiss</code>
          <span>Swiss Basic</span>
        </div>
        <div class="product-code-item">
          <code>PSim-Swiss-Adv</code>
          <span>Swiss Advanced</span>
        </div>
        <div class="product-code-item">
          <code>PSim-Swiss-3Ch</code>
          <span>Swiss 3+Ch</span>
        </div>
      </div>
    </div>

    <div class="products-section">
      <h4 class="products-section__title">Maintenance</h4>
      <div class="product-item">
        <div class="product-item__header">
          <strong>Post Processor Maintenance</strong>
          <code>Post-Maint</code>
        </div>
      </div>
    </div>
  `;
}

function renderThanksgivingOverlay() {
  // Generate 15 falling leaves with random positions and delays
  const leaves = Array.from({ length: 15 }, (_, i) => {
    const leafType = (i % 5) + 1; // Rotate through 5 leaf images
    const leftPos = Math.random() * 100; // Random horizontal position (0-100%)
    const delay = Math.random() * 20; // Random delay 0-20s
    const duration = 12 + Math.random() * 8; // Random fall speed 12-20s
    const scale = 0.7 + Math.random() * 0.6; // Random size 0.7-1.3x

    return `
      <img
        src="assets/thanksgiving/sprites/leaf-${leafType}.png"
        class="autumn-leaf"
        style="
          left: ${leftPos}%;
          animation-delay: ${delay}s;
          animation-duration: ${duration}s;
          transform: scale(${scale});
        "
        alt=""
        aria-hidden="true"
      >
    `;
  }).join('');

  return `
    <div class="thanksgiving-overlay">
      ${leaves}
    </div>
  `;
}

function triggerTurkeyExplosion() {
  // Play loud gobble sound
  const gobbleSound = new Audio('assets/thanksgiving/sounds/turkey-gobble.mp3');
  gobbleSound.volume = 0.8;
  gobbleSound.play().catch(e => console.log('Gobble blocked:', e));

  // Screen shake effect
  document.body.style.animation = 'shake 0.5s';
  setTimeout(() => {
    document.body.style.animation = '';
  }, 500);

  // Spawn extra turkeys for fun
  if (typeof window.TurkeyController !== 'undefined') {
    // Temporarily boost turkey count - spawn 5 extra turkeys
    const extraTurkeys = Array.from({ length: 5 }, () => {
      setTimeout(() => {
        new window.TurkeyController({
          minBugs: 1,
          maxBugs: 1,
          minSpeed: 15,
          maxSpeed: 25,
          mouseOver: 'nothing', // Click only, no hover
          canDie: true,
          canFly: false,
          minDelay: 0,
          maxDelay: 100,
          imageSprite: 'assets/thanksgiving/sprites/turkey-sprite.png',
          bugWidth: 156,        // Correct sprite dimensions
          bugHeight: 132,
          num_frames: 6,
          numDeathTypes: 1,
          zoom: 6
        });
      }, Math.random() * 500);
    });
  }
}

function playPanelVideo(src) {
  const safeSrc = escapeAttr(src);
  const existing = document.querySelector('.panel-video-overlay');
  if (existing) {
    const existingVideo = existing.querySelector('video');
    if (existingVideo) {
      existingVideo.pause();
    }
    existing.remove();
  }

  const overlay = document.createElement('div');
  overlay.className = 'panel-video-overlay';
  overlay.innerHTML = `
    <div class="panel-video-backdrop" data-action="close-video"></div>
    <div class="panel-video-container">
      <button type="button" class="panel-video-close" data-action="close-video" aria-label="Close video">×</button>
      <video src="${safeSrc}" class="panel-video-player" controls autoplay playsinline></video>
    </div>
  `;
  document.body.appendChild(overlay);

  const video = overlay.querySelector('video');
  const cleanup = () => {
    const currentVideo = overlay.querySelector('video');
    if (currentVideo) {
      currentVideo.pause();
      currentVideo.currentTime = 0;
    }
    if (overlay.isConnected) {
      overlay.remove();
    }
    document.removeEventListener('keydown', onKeyDown);
  };

  const onKeyDown = event => {
    if (event.key === 'Escape') {
      cleanup();
    }
  };

  overlay.querySelectorAll('[data-action="close-video"]').forEach(el => {
    el.addEventListener('click', cleanup, { once: true });
  });

  document.addEventListener('keydown', onKeyDown);

  if (video) {
    const attemptPlay = () => {
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          video.muted = true;
          video.play().catch(() => {
            // If playback still fails, leave the controls visible for manual start
            video.muted = false;
          });
        });
      }
    };

    // Attempt immediate playback; browsers treat this as user-initiated due to click
    attemptPlay();
  }
}

function initTurkeyHunt() {
  if (!THANKSGIVING_MODE) return;

  // Check if TurkeyController is loaded
  if (typeof window.TurkeyController === 'undefined') {
    console.warn('TurkeyController not loaded yet, retrying...');
    setTimeout(initTurkeyHunt, 100);
    return;
  }

  // Set crosshair cursor for turkey hunting
  document.body.classList.add('turkey-hunt-active');

  // Create audio elements (modern browsers allow muted autoplay)
  const gobbleSound = new Audio('assets/thanksgiving/sounds/turkey-gobble.mp3');
  const gunshotSound = new Audio('assets/thanksgiving/sounds/gunshot.mp3');
  const hitSound = new Audio('assets/thanksgiving/sounds/hit.mp3');

  const audioRegistry = [
    { element: gobbleSound, volume: 0.6 },
    { element: gunshotSound, volume: 0.4 },
    { element: hitSound, volume: 0.5 }
  ];

  audioRegistry.forEach(({ element, volume }) => {
    element.volume = volume;
    element.preload = 'auto';
    element.playsInline = true;
    element.load();
    element.muted = false;
  });

  let audioUnlocked = false;

  const unlockAudio = () => {
    if (audioUnlocked) return;
    audioUnlocked = true;

    audioRegistry.forEach(({ element, volume }) => {
      element.volume = volume;
      element.muted = false;
    });

    document.removeEventListener('pointerdown', unlockAudio, true);
    document.removeEventListener('keydown', unlockAudio, true);
  };

  document.addEventListener('pointerdown', unlockAudio, true);
  document.addEventListener('keydown', unlockAudio, true);

  // Initialize turkeys with hunt settings - SAVE INSTANCE GLOBALLY
  window.turkeyControllerInstance = new window.TurkeyController({
    minBugs: 5,
    maxBugs: 8,
    minSpeed: 16,
    maxSpeed: 32,
    mouseOver: 'nothing', // NO HOVER! Click only
    canDie: true,
    canFly: false,
    minDelay: 500,
    maxDelay: 4000,
    imageSprite: 'assets/thanksgiving/sprites/turkey-sprite.png',
    bugWidth: 156,        // Actual sprite frame width (624÷4)
    bugHeight: 132,       // Actual sprite frame height (528÷4)
    num_frames: 6,        // 6-frame walk animation (sprite_1 through sprite_6)
    numDeathTypes: 1,     // Cooked turkey death animation
    zoom: 6               // Slightly smaller zoom for bigger sprite
  });

  // Expose streak functions for turkey controller
  window.resetStreakCounter = window.resetStreakCounter || function () { };

  // Streak timeout: reset after 4 seconds of no kills
  let lastKillTime = 0;
  let streakTimeoutTimer = null;

  function resetStreakTimeout() {
    if (streakTimeoutTimer) {
      clearTimeout(streakTimeoutTimer);
    }

    lastKillTime = Date.now();

    streakTimeoutTimer = setTimeout(() => {
      if (window.resetStreakCounter) {
        window.resetStreakCounter();
      }
    }, 4000); // 4 second timeout
  }

  // Random turkey gobbles - 5% chance every 2 seconds
  setInterval(() => {
    if (!audioUnlocked) return;

    if (Math.random() < 0.05) {
      gobbleSound.currentTime = 0;
      const playAttempt = gobbleSound.play();
      if (playAttempt && typeof playAttempt.catch === 'function') {
        playAttempt.catch(e => console.log('Gobble audio blocked:', e));
      }
    }
  }, 2000);

  // CLICK-TO-SHOOT: Manual turkey hunting!
  // Use event delegation for dynamically created turkey elements
  document.addEventListener('click', (e) => {
    const turkeyElement = e.target.closest('.bug'); // Bug library uses .bug class
    if (turkeyElement && THANKSGIVING_MODE && window.turkeyControllerInstance) {
      // Find the turkey object from the controller's bugs array
      const turkeys = window.turkeyControllerInstance.bugs;
      const turkey = turkeys.find(t => t.bug === turkeyElement);

      // Only shoot if turkey is alive
      if (turkey && turkey.alive) {
        unlockAudio();

        // Play gunshot immediately
        gunshotSound.currentTime = 0;
        const gunshotAttempt = gunshotSound.play();
        if (gunshotAttempt && typeof gunshotAttempt.catch === 'function') {
          gunshotAttempt.catch(e => console.log('Gunshot audio blocked:', e));
        }

        // Play metal clang impact sound shortly after gunshot
        setTimeout(() => {
          hitSound.currentTime = 0;
          const hitAttempt = hitSound.play();
          if (hitAttempt && typeof hitAttempt.catch === 'function') {
            hitAttempt.catch(e => console.log('Hit audio blocked:', e));
          }
        }, 100); // 100ms delay for realistic impact timing

        // Kill the turkey (triggers custom death animation)
        turkey.die();
        resetStreakTimeout();
      }
    }

    // Detect misses - any click that's NOT on a turkey
    if (!turkeyElement && THANKSGIVING_MODE) {
      // Don't count clicks on feast counter itself
      const isFeastCounter = e.target.closest('.feast-counter');
      if (!isFeastCounter) {
        if (window.resetStreakCounter) {
          window.resetStreakCounter();
        }
        if (streakTimeoutTimer) {
          clearTimeout(streakTimeoutTimer);
          streakTimeoutTimer = null;
        }
      }
    }
  });
}

function renderPackageRow(pkg) {
  const safeCode = escapeHtml(pkg.code);
  const safeCodeAttr = escapeAttr(pkg.code);
  const safeDescription = escapeHtml(pkg.description);
  const safeDescriptionAttr = escapeAttr(pkg.description);
  const safeMaintenance = escapeHtml(pkg.maintenance);
  const safeMaintenanceAttr = escapeAttr(pkg.maintenance);

  return `
    <tr data-package="${safeCodeAttr}" data-package-name="${safeDescriptionAttr}" data-maintenance="${safeMaintenanceAttr}">
      <td class="pkg">
        <code class="package-code">${safeCode}</code>
        <span class="package-description">${safeDescription}</span>
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

function panelSupportsCheckboxes(panelId) {
  return ['maintenance-combined', 'maintenance-skus', 'solidworks-maintenance'].includes(panelId);
}

function createPanelItemMarkup(item, options = {}) {
  const text = typeof item === 'string' ? item : item?.text ?? '';
  const safeText = escapeHtml(text);
  const shouldRenderCheckbox =
    options.withCheckbox === true ||
    (typeof item === 'object' && item !== null && 'checked' in item);
  if (shouldRenderCheckbox) {
    const checked = typeof item === 'object' && item?.checked ? ' checked' : '';
    const ariaLabelText = text ? `Toggle ${text}` : 'Toggle item';
    const safeAria = escapeAttr(ariaLabelText);
    return `
      <li data-sortable-item>
        <div class="panel-item-main">
          <input type="checkbox" class="bit-checkbox panel-item-checkbox"${checked} aria-label="${safeAria}">
          <code>${safeText}</code>
        </div>
        <button type="button" class="item-btn" data-action="panel-remove-item">×</button>
      </li>
    `;
  }
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

  // Check if clicking "Happy Thanksgiving!" in panel items
  if (THANKSGIVING_MODE && target.tagName === 'CODE') {
    const text = target.textContent?.trim();
    if (text === 'Happy Thanksgiving Darryl!!') {
      event.preventDefault();
      event.stopPropagation();
      playPanelVideo('assets/img/vader.mp4');
      return;
    }
  }

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
    case 'toggle-operations':
      handleToggleOperations();
      break;
    case 'open-sales-tax':
      closeOperationsMenu();
      openModal(root, 'sales-tax');
      break;
    case 'open-current-products':
      closeOperationsMenu();
      openModal(root, 'current-products');
      break;
    case 'close-modal':
      closeModal(root);
      break;
    default:
      break;
  }
}

function handleToggleOperations() {
  const menu = document.querySelector('[data-operations-menu]');
  if (menu) {
    menu.hidden = !menu.hidden;
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
  element.querySelectorAll('code').forEach(code => bindCopyHandler(code, () => editMode, showCopyHud));
  bindBitCopyHandler(element, () => editMode, showCopyHud);

  if (editMode) {
    enableDrag(element);
  }

  persistState(root);
  schedulePanelWidthSync(root);
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
  schedulePanelWidthSync(root);
}

function handleSortableDrop(event, root) {
  const detail = event.detail;
  if (!detail) return;
  const { item, from, to } = detail;
  if (!(item instanceof HTMLElement) || !(to instanceof HTMLElement)) {
    updateMasterCheckboxes(root);
    persistState(root);
    schedulePanelWidthSync(root);
    return;
  }

  const movingWithinSameContainer = from === to;
  const toIsBits = to.matches('.bits');
  const toIsSubBits = to.matches('.sub-bits');

  if (!toIsBits && !toIsSubBits) {
    updateMasterCheckboxes(root);
    persistState(root);
    schedulePanelWidthSync(root);
    return;
  }

  if (movingWithinSameContainer) {
    updateMasterCheckboxes(root);
    persistState(root);
    schedulePanelWidthSync(root);
    return;
  }

  const labelSpan = item.querySelector('span');
  if (!labelSpan) {
    updateMasterCheckboxes(root);
    persistState(root);
    schedulePanelWidthSync(root);
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
  replacement
    .querySelectorAll('code')
    .forEach(code => bindCopyHandler(code, () => editMode, showCopyHud));
  bindBitCopyHandler(replacement, () => editMode, showCopyHud);
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
  schedulePanelWidthSync(root);
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

  const panelId = panel.dataset.panel || '';
  const itemMarkup = createPanelItemMarkup(text, {
    withCheckbox: panelSupportsCheckboxes(panelId)
  });
  const item = htmlToElement(itemMarkup);
  list.appendChild(item);
  item.querySelectorAll('code').forEach(code => bindCopyHandler(code, () => editMode, showCopyHud));

  if (editMode) {
    enableDrag(list);
  }

  persistState(root);
  schedulePanelWidthSync(root);
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
  schedulePanelWidthSync(root);
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
    schedulePanelWidthSync(root);
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
  const masters = root.querySelectorAll('.master-checkbox');
  masters.forEach(master => {
    const parentId = master.dataset.master;
    const group = master.closest('.master-bit');
    if (!group) return;

    const children = group.querySelectorAll(`.sub-checkbox[data-parent="${parentId}"]`);
    if (children.length === 0) {
      master.checked = false;
      master.indeterminate = false;
      return;
    }

    let anyChecked = false;
    let allChecked = true;

    for (const child of children) {
      if (child.checked) {
        anyChecked = true;
        if (anyChecked && !allChecked) break;
      } else {
        allChecked = false;
        if (!allChecked && anyChecked) break;
      }
    }

    if (!anyChecked) {
      master.checked = false;
      master.indeterminate = false;
    } else if (allChecked) {
      master.checked = true;
      master.indeterminate = false;
    } else {
      master.checked = false;
      master.indeterminate = true;
    }
  });
}

function collectState(root) {
  const panelState = {};

  root.querySelectorAll('.panel').forEach(panel => {
    const panelId = panel.dataset.panel;

    // Special case: maintenance-combined has TWO separate lists
    if (panelId === 'maintenance-combined') {
      // Save maintenance-skus list separately
      const maintList = panel.querySelector('[data-sortable-group="maintenance-skus"]');
      if (maintList) {
        panelState['maintenance-skus'] = Array.from(maintList.querySelectorAll('li')).map(li => {
          const checkbox = li.querySelector('.panel-item-checkbox');
          const code = li.querySelector('code');
          const text = code?.textContent.trim() ?? li.textContent.trim();
          return checkbox ? { text, checked: checkbox.checked } : text;
        });
      }

      // Save solidworks-maintenance list separately
      const swList = panel.querySelector('[data-sortable-group="solidworks-maintenance"]');
      if (swList) {
        panelState['solidworks-maintenance'] = Array.from(swList.querySelectorAll('li')).map(li => {
          const checkbox = li.querySelector('.panel-item-checkbox');
          const code = li.querySelector('code');
          const text = code?.textContent.trim() ?? li.textContent.trim();
          return checkbox ? { text, checked: checkbox.checked } : text;
        });
      }
    } else {
      // Normal panels: single list
      const list = panel.querySelector('ul');
      if (list) {
        panelState[panelId] = Array.from(list.querySelectorAll('li')).map(li => {
          const checkbox = li.querySelector('.panel-item-checkbox');
          const code = li.querySelector('code');
          const text = code?.textContent.trim() ?? li.textContent.trim();
          return checkbox ? { text, checked: checkbox.checked } : text;
        });
      }
    }
  });

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

const persistState = root => {
  if (!root) return Promise.resolve(false);
  try {
    const snapshot = collectState(root);

    // Save to page system (current page)
    // CRITICAL FIX #1: Use correct method name (was savePageState, should be saveCurrentPageState)
    // CRITICAL FIX #2: Use getCurrentPageId() method, not .currentPageId property (doesn't exist!)
    if (pageSystem) {
      const pageId = pageSystem.getCurrentPageId();
      if (pageId) {
        pageSystem.saveCurrentPageState(pageId, snapshot);
      }
    }

    // Also save to stateQueue for backwards compatibility
    const changeType = determineChangeType(root);
    const metadata = {
      rootId: root.id || 'root',
      elementCount: root.querySelectorAll('*').length
    };
    logger.log('dom', 'Persist request queued', {
      changeType,
      elementCount: metadata.elementCount
    });
    return stateQueue
      .enqueue(snapshot, changeType, metadata)
      .catch(error => {
        console.error('[DOM Persistence Error]', error);
        throw error;
      });
  } catch (error) {
    console.error('[DOM Persistence Error]', error);
    return Promise.reject(error);
  }
};

function determineChangeType(root) {
  if (!root || typeof root.querySelector !== 'function') {
    return 'ui_change';
  }
  try {
    if (root.querySelector('[data-changing="panels"]')) return 'panel_change';
    if (root.querySelector('[data-changing="packages"]')) return 'package_change';
  } catch (error) {
    console.warn('[DOM Persistence] Unable to determine change type', error);
  }
  return 'ui_change';
}

export { persistState };

function applyState(root, state) {
  // CRITICAL FIX: Reset to default state before applying
  // This prevents old company's data from remaining when switching to empty state

  // Clear ALL editable panels - rebuild from state only (no fallbacks)
  root.querySelectorAll('.panel[data-panel-editable="true"]').forEach(panel => {
    panel.querySelectorAll('ul').forEach(list => {
      list.innerHTML = '';
    });
  });

  // Uncheck all package checkboxes (don't delete them)
  root.querySelectorAll('tbody tr').forEach(row => {
    row.querySelectorAll('ul.bits .bit-checkbox').forEach(cb => cb.checked = false);
    row.querySelectorAll('.master-checkbox').forEach(cb => {
      cb.checked = false;
      cb.indeterminate = false;
    });
    row.querySelectorAll('.sub-checkbox').forEach(cb => cb.checked = false);
  });

  // Rebuild panels from state, with fallback to defaults for maintenance panels
  const panelsToRender = new Map();

  // First, collect all panels from state
  if (state.panels) {
    Object.entries(state.panels).forEach(([panelId, items]) => {
      panelsToRender.set(panelId, items);
    });
  }

  // Add defaults for maintenance panels if not in state
  // This ensures maintenance SKUs always show up even for new companies
  const maintenancePanelIds = ['maintenance-skus', 'solidworks-maintenance'];
  maintenancePanelIds.forEach(panelId => {
    if (!panelsToRender.has(panelId)) {
      const defaultPanel = panels.find(p => p.id === panelId);
      if (defaultPanel && defaultPanel.items) {
        panelsToRender.set(panelId, defaultPanel.items);
      }
    }
  });

  // Now render all panels (state + defaults)
  panelsToRender.forEach((items, panelId) => {
    if (panelId === 'maintenance-skus' || panelId === 'solidworks-maintenance') {
      // Maintenance panels: two lists inside one panel
      const combinedPanel = root.querySelector('.panel[data-panel="maintenance-combined"]');
      if (!combinedPanel) return;
      const list = combinedPanel.querySelector(`[data-sortable-group="${escapeSelector(panelId)}"]`);
      if (!list) return;
      list.innerHTML = items
        .map(item => createPanelItemMarkup(item, { withCheckbox: true }))
        .join('');
      list.querySelectorAll('code').forEach(code => bindCopyHandler(code, () => editMode, showCopyHud));
    } else {
      // Other editable panels: single list
      const panel = root.querySelector(`.panel[data-panel="${escapeSelector(panelId)}"]`);
      if (!panel) return;
      const list = panel.querySelector('ul');
      if (!list) return;
      const supportsCheckbox = panelSupportsCheckboxes(panelId);
      list.innerHTML = items
        .map(item => createPanelItemMarkup(item, { withCheckbox: supportsCheckbox }))
        .join('');
      list.querySelectorAll('code').forEach(code => bindCopyHandler(code, () => editMode, showCopyHud));
    }
  });

  if (state.packages) {
    Object.entries(state.packages).forEach(([pkgCode, pkgState]) => {
      const row = root.querySelector(`tr[data-package="${escapeSelector(pkgCode)}"]`);
      if (!row) return;

      // Apply loose bit states (check the appropriate checkboxes)
      if (Array.isArray(pkgState.bits)) {
        pkgState.bits.forEach(bit => {
          const bitText = typeof bit === 'string' ? bit : bit.text;
          const bitChecked = typeof bit === 'string' ? false : (bit.checked ?? false);

          // Find the checkbox for this bit by matching the text
          const bitItems = row.querySelectorAll('ul.bits li');
          for (const item of bitItems) {
            const span = item.querySelector('span');
            if (span && span.textContent.trim() === bitText) {
              const checkbox = item.querySelector('.bit-checkbox');
              if (checkbox) {
                checkbox.checked = bitChecked;
              }
              break;
            }
          }
        });
      }

      // Apply group states (master bits)
      if (Array.isArray(pkgState.groups)) {
        pkgState.groups.forEach(group => {
          const masterId = group.masterId;
          const masterCheckbox = row.querySelector(`.master-checkbox[data-master="${escapeSelector(masterId)}"]`);

          if (masterCheckbox) {
            masterCheckbox.checked = group.checked ?? false;
            masterCheckbox.indeterminate = group.indeterminate ?? false;

            // Apply sub-bit states
            if (Array.isArray(group.items)) {
              group.items.forEach(subBit => {
                const subText = typeof subBit === 'string' ? subBit : subBit.text;
                const subChecked = typeof subBit === 'string' ? false : (subBit.checked ?? false);

                // Find the sub-bit checkbox
                const masterBit = masterCheckbox.closest('.master-bit');
                if (masterBit) {
                  const subItems = masterBit.querySelectorAll('.sub-bits li');
                  for (const item of subItems) {
                    const span = item.querySelector('span');
                    if (span && span.textContent.trim() === subText) {
                      const checkbox = item.querySelector('.sub-checkbox');
                      if (checkbox) {
                        checkbox.checked = subChecked;
                      }
                      break;
                    }
                  }
                }
              });
            }
          }
        });
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

  root.querySelectorAll('.bits li, .sub-bits li, .master-bit').forEach(item => {
    bindBitCopyHandler(item, () => editMode, showCopyHud);
  });

  schedulePanelWidthSync(root);
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
          <span data-copyable-bit="true">${safeLabel}</span>
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
        <span data-copyable-bit="true">${safeText}</span>
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
        <span data-copyable-bit="true">${safeText}</span>
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

function schedulePanelWidthSync(root) {
  if (typeof window === 'undefined') return;

  if (root) {
    widthSyncRoot = root;
  }
  widthSyncDirty = true;
  if (!widthSyncRoot || widthSyncScheduled) return;

  widthSyncScheduled = true;
  window.requestAnimationFrame(() => {
    widthSyncScheduled = false;
    const targetRoot = widthSyncRoot;
    if (targetRoot) {
      syncPanelWidths(targetRoot);
    }
  });
}

function syncPanelWidths(root) {
  if (!root || typeof window === 'undefined') return;
  if (!widthSyncDirty) return;
  widthSyncDirty = false;

  if (window.matchMedia && window.matchMedia('(max-width: 1024px)').matches) {
    if (lastRightPanelWidth !== null) {
      document.documentElement.style.removeProperty('--right-panel-width');
      lastRightPanelWidth = null;
    }
    if (lastLayoutContentWidth !== null) {
      document.documentElement.style.removeProperty('--layout-content-width');
      lastLayoutContentWidth = null;
    }
    return;
  }

  const maintenance =
    root.querySelector('.panel[data-panel="maintenance-skus"]') ||
    root.querySelector('.panel[data-panel="maintenance-combined"]') ||
    root.querySelector('.panels .panel');
  if (maintenance) {
    const panelWidth = maintenance.getBoundingClientRect().width;
    if (Number.isFinite(panelWidth) && panelWidth > 0) {
      const computedWidth = `${Math.ceil(panelWidth)}px`;
      if (computedWidth !== lastRightPanelWidth) {
        document.documentElement.style.setProperty('--right-panel-width', computedWidth);
        lastRightPanelWidth = computedWidth;
      }
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

  const layoutWidth = `${Math.ceil(width || blockRect.width)}px`;
  if (layoutWidth !== lastLayoutContentWidth) {
    document.documentElement.style.setProperty('--layout-content-width', layoutWidth);
    lastLayoutContentWidth = layoutWidth;
  }
}

function ensureWidthSyncListener() {
  if (widthSyncListenerAttached || typeof window === 'undefined') return;
  const handler = () => {
    widthSyncDirty = true;
    schedulePanelWidthSync(widthSyncRoot);
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

function openModal(root, modalName) {
  const overlay = root.querySelector(`[data-modal="${modalName}"]`);
  if (!overlay) return;
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
}

function closeModal(root) {
  const overlays = root.querySelectorAll('[data-modal]');
  overlays.forEach(overlay => {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
  });
}

function closeOperationsMenu() {
  const menu = document.querySelector('[data-operations-menu]');
  if (menu) menu.hidden = true;
}

function setupModalBackdropHandlers(root) {
  const overlays = root.querySelectorAll('.about-overlay');
  overlays.forEach(overlay => {
    overlay.addEventListener('click', event => {
      // Only close if clicking directly on the overlay (backdrop), not the modal content
      if (event.target === overlay) {
        // Check if this is a data-modal or the about modal
        if (overlay.hasAttribute('data-modal')) {
          closeModal(root);
        } else {
          closeAbout(root);
        }
      }
    });
  });
}

function setupModalKeyboardHandlers(root) {
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      // Close all modals (both about and data-modals)
      closeAbout(root);
      closeModal(root);
    }
  });
}

// ========================================
// Page System Event Handlers
// ========================================

// CRITICAL FIX: Track document listeners to prevent memory leaks
// Store references so they can be removed when UI refreshes
let documentClickListener = null;

function cleanupPageSystemListeners() {
  // Remove old document listeners before adding new ones
  if (documentClickListener) {
    document.removeEventListener('click', documentClickListener);
    documentClickListener = null;
  }
}

function attachPageSystemListeners(root) {
  // CRITICAL FIX: Remove old listeners first to prevent memory leaks
  // Each UI refresh was adding new document listeners without removing old ones
  cleanupPageSystemListeners();

  // Help tooltip toggle
  const helpBtn = root.querySelector('[data-action="toggle-page-system-help"]');
  const helpTooltip = root.querySelector('[data-page-system-help]');
  if (helpBtn && helpTooltip) {
    helpBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = helpTooltip.hasAttribute('hidden');
      if (isHidden) {
        helpTooltip.removeAttribute('hidden');
      } else {
        helpTooltip.setAttribute('hidden', '');
      }
    });

    // Close tooltip when clicking outside
    // CRITICAL FIX: Store reference so it can be removed later
    documentClickListener = (e) => {
      if (!helpTooltip.hasAttribute('hidden') &&
        !helpTooltip.contains(e.target) &&
        !helpBtn.contains(e.target)) {
        helpTooltip.setAttribute('hidden', '');
      }
    };
    document.addEventListener('click', documentClickListener);
  }

  // Company dropdown toggle
  const dropdownTrigger = root.querySelector('[data-action="toggle-company-dropdown"]');
  if (dropdownTrigger) {
    dropdownTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      handleDropdownToggle(root);
    });
  }

  // Company actions
  const newCompanyBtn = root.querySelector('[data-action="new-company"]');
  if (newCompanyBtn) {
    newCompanyBtn.addEventListener('click', () => handleNewCompany(root));
  }

  // Quick new company button (in page actions)
  const newCompanyQuickBtn = root.querySelector('[data-action="new-company-quick"]');
  if (newCompanyQuickBtn) {
    newCompanyQuickBtn.addEventListener('click', () => handleNewCompany(root));
  }

  const duplicateBtn = root.querySelector('[data-action="duplicate-company"]');
  if (duplicateBtn) {
    duplicateBtn.addEventListener('click', () => handleDuplicateCompany(root));
  }

  const renameBtn = root.querySelector('[data-action="rename-company"]');
  if (renameBtn) {
    renameBtn.addEventListener('click', () => handleRenameCurrentCompany(root));
  }

  const deleteBtn = root.querySelector('[data-action="delete-company"]');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => handleDeleteCurrentCompany(root));
  }

  // Browse All button
  const browseBtn = root.querySelector('[data-action="browse-all-companies"]');
  if (browseBtn) {
    browseBtn.addEventListener('click', () => {
      openBrowseAllModal(root);
    });
  }

  // Search input
  const searchInput = root.querySelector('[data-action="search-companies"]');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      handleSearchCompanies(e.target, root);
    });
  }

  // Attach listeners for company switch and favorite toggle
  attachDropdownActionListeners(root);

  // Page tab click handler
  const pageTabs = root.querySelector('[data-page-tabs]');
  if (pageTabs) {
    pageTabs.addEventListener('click', (e) => {
      if (e.target.matches('.page-tab')) {
        handlePageSwitch(e.target.dataset.pageId, root);
      }
    });

    pageTabs.addEventListener('dblclick', (e) => {
      if (e.target.matches('.page-tab')) {
        handlePageRename(e.target.dataset.pageId, root);
      }
    });
  }

  // Page action buttons
  const newPageBtn = root.querySelector('[data-action="new-page"]');
  if (newPageBtn) {
    newPageBtn.addEventListener('click', () => handlePageNew(root));
  }

  const copyPageBtn = root.querySelector('[data-action="copy-page"]');
  if (copyPageBtn) {
    copyPageBtn.addEventListener('click', () => handlePageCopy(root));
  }

  const deletePageBtn = root.querySelector('[data-action="delete-page"]');
  if (deletePageBtn) {
    deletePageBtn.addEventListener('click', () => handlePageDelete(root));
  }
}

function handlePageSwitch(pageId, root) {
  const company = pageSystem?.getCurrentCompany();
  if (!company || pageId === company.currentPageId) return;

  // Save current page state before switching
  const currentState = collectState(root);
  const currentPage = company.pages.find(p => p.id === company.currentPageId);
  if (currentPage) {
    currentPage.state = currentState;
  }

  // Switch to new page
  pageSystem.switchToPage(pageId);

  // Apply new page state
  const newState = pageSystem.getCurrentPageState();
  applyState(root, newState);

  // Update master checkboxes
  updateMasterCheckboxes(root);

  // Re-render page controls to update active tab
  refreshPageSystemUI(root);
}

function handlePageRename(pageId, root) {
  const company = pageSystem.getCurrentCompany();
  if (!company) return;

  const currentName = pageSystem.getPageName(pageId);
  const newName = prompt('Rename page (max 8 characters):', currentName);

  if (!newName) return;

  // CRITICAL FIX: Validate page name
  const trimmed = newName.trim().substring(0, 8);
  if (!trimmed) {
    alert('Page name cannot be empty.');
    return;
  }

  if (trimmed === currentName) return;

  // CRITICAL FIX: Check for duplicate page names (excluding current page)
  const exists = company.pages.some(p => p.id !== pageId && p.name === trimmed);
  if (exists) {
    alert(`A page named "${trimmed}" already exists.\nPlease choose a different name.`);
    return;
  }

  pageSystem.renamePage(pageId, trimmed);
  refreshPageSystemUI(root);
}

function handlePageNew(root) {
  const company = pageSystem.getCurrentCompany();
  if (!company) return;

  // Save current page state
  const currentState = collectState(root);
  const currentPage = company.pages.find(p => p.id === company.currentPageId);
  if (currentPage) {
    currentPage.state = currentState;
  }

  // Create new empty page
  const pageNum = company.pages.length + 1;
  const newPage = pageSystem.createPage(`P${pageNum}`);

  // Switch to new page with empty state
  pageSystem.switchToPage(newPage.id);
  applyState(root, { panels: {}, packages: {} });
  updateMasterCheckboxes(root);

  refreshPageSystemUI(root);
}

function handlePageCopy(root) {
  const company = pageSystem.getCurrentCompany();
  if (!company) return;

  // Save current page state
  const currentState = collectState(root);
  const currentPage = company.pages.find(p => p.id === company.currentPageId);
  if (currentPage) {
    currentPage.state = currentState;
  }

  // Copy page
  const pageNum = company.pages.length + 1;
  const newPage = pageSystem.copyPage(company.currentPageId, `P${pageNum}`);

  if (!newPage) {
    alert('Failed to copy page.');
    return;
  }

  // Switch to copied page
  pageSystem.switchToPage(newPage.id);
  applyState(root, newPage.state);
  updateMasterCheckboxes(root);

  refreshPageSystemUI(root);
}

function handlePageDelete(root) {
  const company = pageSystem.getCurrentCompany();
  if (!company || company.pages.length === 1) {
    alert('Cannot delete the last page.');
    return;
  }

  const pageName = pageSystem.getCurrentPageName();
  if (!confirm(`Delete page "${pageName}"?`)) return;

  // CRITICAL FIX: Cancel pending auto-save before deleting page
  // This prevents auto-save from trying to save to a deleted page
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = null;
  }

  const nextPageId = pageSystem.deletePage(company.currentPageId);

  const newState = pageSystem.getCurrentPageState();
  applyState(root, newState);
  updateMasterCheckboxes(root);

  refreshPageSystemUI(root);
}


/**
 * Auto-save functionality
 */
let autoSaveTimeout = null;

function setupAutoSave(root) {
  const triggerAutoSave = () => {
    if (autoSaveTimeout) clearTimeout(autoSaveTimeout);

    updateSaveStatus('saving');

    // CRITICAL FIX: Capture company and page context NOW (not when callback executes)
    // This prevents race conditions when user switches companies before auto-save fires
    const companyId = pageSystem.currentCompanyId;
    const pageId = pageSystem.getCurrentPageId();

    autoSaveTimeout = setTimeout(() => {
      try {
        const state = collectState(root);

        // Use captured IDs, not current context
        const company = pageSystem.companies.find(c => c.id === companyId);
        if (!company) {
          // CRITICAL FIX: Company was deleted while auto-save was pending
          console.warn('[Auto-save] Company no longer exists:', companyId);
          updateSaveStatus('error');
          return;
        }

        const page = company.pages.find(p => p.id === pageId);
        if (!page) {
          // CRITICAL FIX: Page was deleted while auto-save was pending
          console.warn('[Auto-save] Page no longer exists:', pageId);
          updateSaveStatus('error');
          return;
        }

        // Save state to the captured company/page
        page.state = state;
        company.updatedAt = Date.now();
        pageSystem.save();
        updateSaveStatus('saved');
      } catch (error) {
        console.error('[Auto-save error]', error);
        updateSaveStatus('error');
      }
    }, 500);
  };

  // Listen to all change events
  root.addEventListener('change', triggerAutoSave);
  root.addEventListener('sortable:drop', triggerAutoSave);

  // Also trigger on manual actions
  root.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]');
    if (action && ['panel-remove-item', 'package-remove-bit'].includes(action.dataset.action)) {
      triggerAutoSave();
    }
  });
}

function updateSaveStatus(status) {
  const indicator = document.querySelector('.status-indicator');
  const saveTime = document.querySelector('[data-save-time]');

  if (indicator) {
    if (status === 'saving') {
      indicator.textContent = '○';
      indicator.className = 'status-indicator saving';
    } else if (status === 'saved') {
      indicator.textContent = '●';
      indicator.className = 'status-indicator saved';
      if (saveTime) {
        saveTime.textContent = 'Auto-saved just now';
        updateRelativeTime();
      }
    } else if (status === 'error') {
      indicator.textContent = '⚠';
      indicator.className = 'status-indicator error';
    }
  }
}

let relativeTimeInterval = null;

function updateRelativeTime() {
  if (relativeTimeInterval) clearInterval(relativeTimeInterval);

  const saveTime = document.querySelector('[data-save-time]');
  if (!saveTime) return;

  const company = pageSystem.getCurrentCompany();
  if (!company) return;

  const updateTime = () => {
    const seconds = Math.floor((Date.now() - company.updatedAt) / 1000);
    if (seconds < 5) {
      saveTime.textContent = 'Auto-saved just now';
    } else if (seconds < 60) {
      saveTime.textContent = `Auto-saved ${seconds}s ago`;
    } else if (seconds < 3600) {
      saveTime.textContent = `Auto-saved ${Math.floor(seconds / 60)}m ago`;
    } else {
      saveTime.textContent = `Auto-saved ${Math.floor(seconds / 3600)}h ago`;
    }
  };

  updateTime();
  relativeTimeInterval = setInterval(updateTime, 5000);
}

/**
 * Company dropdown handlers
 */
let currentDropdownCloseHandler = null;

function handleDropdownToggle(root) {
  const menu = root.querySelector('[data-company-menu]');
  if (!menu) return;

  const isHidden = menu.hasAttribute('hidden');

  if (isHidden) {
    // Open dropdown
    menu.removeAttribute('hidden');

    // Close on click outside
    setTimeout(() => {
      if (currentDropdownCloseHandler) {
        document.removeEventListener('click', currentDropdownCloseHandler);
      }

      currentDropdownCloseHandler = (e) => {
        if (!e.target.closest('.company-dropdown')) {
          closeDropdown(root);
        }
      };
      document.addEventListener('click', currentDropdownCloseHandler);
    }, 0);
  } else {
    // Close dropdown
    closeDropdown(root);
  }
}

function closeDropdown(root) {
  const menu = root.querySelector('[data-company-menu]');
  if (menu) {
    menu.setAttribute('hidden', '');
  }

  if (currentDropdownCloseHandler) {
    document.removeEventListener('click', currentDropdownCloseHandler);
    currentDropdownCloseHandler = null;
  }
}

function handleSwitchCompany(companyId, root) {
  // CRITICAL FIX: Flush pending auto-save before switching
  // This prevents race conditions where auto-save fires after context change
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);

    // Save current state immediately before switching
    try {
      const state = collectState(root);
      const currentCompany = pageSystem.getCurrentCompany();
      if (currentCompany) {
        const page = currentCompany.pages.find(p => p.id === currentCompany.currentPageId);
        if (page) {
          page.state = state;
          currentCompany.updatedAt = Date.now();
          pageSystem.save();
        }
      }
    } catch (error) {
      console.error('[Pre-switch save error]', error);
    }

    autoSaveTimeout = null;
  }

  if (!pageSystem.switchToCompany(companyId)) {
    alert('Failed to switch company');
    return;
  }

  // Apply new company's current page state
  const newState = pageSystem.getCurrentPageState();
  applyState(root, newState);
  updateMasterCheckboxes(root);

  // Re-render UI
  refreshPageSystemUI(root);
  updateSaveStatus('saved');
}

function handleNewCompany(root) {
  const name = prompt('New company name:', 'Untitled Company');
  if (!name) return;

  // CRITICAL FIX: Validate company name
  const trimmed = name.trim();
  if (!trimmed) {
    alert('Company name cannot be empty.');
    return;
  }

  // CRITICAL FIX: Check for duplicate names
  const exists = pageSystem.companies.some(c => c.name === trimmed);
  if (exists) {
    alert(`A company named "${trimmed}" already exists.\nPlease choose a different name.`);
    return;
  }

  const company = pageSystem.createCompany(trimmed);

  // Apply empty state
  applyState(root, { panels: {}, packages: {} });
  updateMasterCheckboxes(root);

  // Re-render UI
  refreshPageSystemUI(root);
  updateSaveStatus('saved');
}

function handleDuplicateCompany(root) {
  const current = pageSystem.getCurrentCompany();
  if (!current) return;

  const copy = pageSystem.duplicateCompany(current.id);
  if (!copy) {
    alert('Failed to duplicate company');
    return;
  }

  // Switch to the copy
  pageSystem.switchToCompany(copy.id);

  // Apply state
  const newState = pageSystem.getCurrentPageState();
  applyState(root, newState);
  updateMasterCheckboxes(root);

  // Re-render UI
  refreshPageSystemUI(root);
  updateSaveStatus('saved');
}

function handleRenameCurrentCompany(root) {
  const current = pageSystem.getCurrentCompany();
  if (!current) return;

  const newName = prompt('Rename company:', current.name);
  if (!newName) return;

  // CRITICAL FIX: Validate company name
  const trimmed = newName.trim();
  if (!trimmed) {
    alert('Company name cannot be empty.');
    return;
  }

  if (trimmed === current.name) return;

  // CRITICAL FIX: Check for duplicate names (excluding current company)
  const exists = pageSystem.companies.some(c => c.id !== current.id && c.name === trimmed);
  if (exists) {
    alert(`A company named "${trimmed}" already exists.\nPlease choose a different name.`);
    return;
  }

  if (pageSystem.renameCurrentCompany(trimmed)) {
    refreshPageSystemUI(root);
    updateSaveStatus('saved');
  } else {
    alert('Failed to rename company');
  }
}

function handleDeleteCurrentCompany(root) {
  const current = pageSystem.getCurrentCompany();
  if (!current) return;

  if (pageSystem.companies.length === 1) {
    alert('Cannot delete the last company.');
    return;
  }

  if (!confirm(`Delete company "${current.name}"?\n\nThis cannot be undone.`)) {
    return;
  }

  // CRITICAL FIX: Cancel pending auto-save before deleting company
  // This prevents auto-save from trying to save to a deleted company
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = null;
  }

  const nextId = pageSystem.deleteCompany(current.id);

  // Apply new company's state
  const newState = pageSystem.getCurrentPageState();
  applyState(root, newState);
  updateMasterCheckboxes(root);

  // Re-render UI
  refreshPageSystemUI(root);
  updateSaveStatus('saved');
}

function handleToggleFavorite(companyId, root) {
  pageSystem.toggleFavorite(companyId);
  refreshPageSystemUI(root);
  // Don't close dropdown - user might want to toggle multiple favorites
}

/**
 * Company search handler
 */
let searchTimeout = null;

function handleSearchCompanies(input, root) {
  if (searchTimeout) clearTimeout(searchTimeout);

  searchTimeout = setTimeout(() => {
    const query = input.value.trim();
    const menu = root.querySelector('[data-company-menu]');
    if (!menu) return;

    const searchResultsSection = menu.querySelector('[data-search-results-section]');
    const searchHint = menu.querySelector('.company-search-hint');

    if (!query) {
      // Empty search - hide results, show hint
      if (searchResultsSection) searchResultsSection.setAttribute('hidden', '');
      if (searchHint) searchHint.style.display = 'block';
    } else {
      // Active search - show results, hide hint
      const results = pageSystem.searchCompanies(query);
      renderSearchResults(results, root);
      if (searchHint) searchHint.style.display = 'none';
    }
  }, 150);
}

function renderSearchResults(results, root) {
  const menu = root.querySelector('[data-company-menu]');
  if (!menu) return;

  const current = pageSystem.getCurrentCompany();
  const searchResultsSection = menu.querySelector('[data-search-results-section]');
  const searchResultsList = menu.querySelector('[data-search-results-list]');

  if (!searchResultsSection || !searchResultsList) return;

  if (results.length === 0) {
    searchResultsList.innerHTML = '<p class="no-results">No companies found</p>';
  } else {
    searchResultsList.innerHTML = results.map(company => {
      const isCurrent = company.id === current.id;
      const isFavorite = pageSystem.favoriteCompanyIds.includes(company.id);
      return `
        <div class="company-list-item-wrapper">
          <button
            class="company-list-item${isCurrent ? ' active' : ''}"
            data-action="switch-company"
            data-company-id="${escapeAttr(company.id)}"
            type="button"
          >
            ${escapeHtml(company.name)} ${isCurrent ? '●' : ''}
          </button>
          <button
            class="favorite-toggle${isFavorite ? ' active' : ''}"
            data-action="toggle-favorite"
            data-company-id="${escapeAttr(company.id)}"
            title="${isFavorite ? 'Remove from favorites' : 'Add to favorites'}"
            type="button"
          >${isFavorite ? '★' : '☆'}</button>
        </div>
      `;
    }).join('');
  }

  searchResultsSection.removeAttribute('hidden');
  attachDropdownActionListeners(root);
}

function attachDropdownActionListeners(root) {
  // Switch company
  root.querySelectorAll('[data-action="switch-company"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const companyId = btn.dataset.companyId;
      handleSwitchCompany(companyId, root);
    });
  });

  // Toggle favorite
  root.querySelectorAll('[data-action="toggle-favorite"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const companyId = btn.dataset.companyId;
      handleToggleFavorite(companyId, root);
    });
  });
}

/**
 * Browse All Modal
 */
function renderBrowseAllModal() {
  const companies = pageSystem.companies;
  const current = pageSystem.getCurrentCompany();

  // Group by first letter
  const grouped = companies.reduce((acc, company) => {
    const letter = company.name[0].toUpperCase();
    if (!acc[letter]) acc[letter] = [];
    acc[letter].push(company);
    return acc;
  }, {});

  const letters = Object.keys(grouped).sort();

  return `
    <div class="browse-modal-overlay" data-modal="browse-all">
      <div class="browse-modal">
        <div class="browse-modal-header">
          <h3>All Companies (${companies.length})</h3>
          <button class="browse-modal-close" data-action="close-browse-modal" type="button">×</button>
        </div>

        <div class="browse-modal-search">
          <input
            type="search"
            placeholder="🔍 Search..."
            data-action="search-browse-companies"
            class="browse-search-input"
          />
        </div>

        <div class="browse-modal-body">
          ${letters.map(letter => `
            <div class="browse-letter-group">
              <div class="browse-letter-header">${letter}</div>
              ${grouped[letter].map(company => {
    const isCurrent = company.id === current.id;
    const isFavorite = pageSystem.favoriteCompanyIds.includes(company.id);
    return `
                  <div class="browse-company-item">
                    <button
                      class="browse-company-btn${isCurrent ? ' active' : ''}"
                      data-action="switch-company-modal"
                      data-company-id="${escapeAttr(company.id)}"
                      type="button"
                    >
                      <span class="browse-company-name">${escapeHtml(company.name)}</span>
                      <span class="browse-company-meta">${company.pages.length} page${company.pages.length !== 1 ? 's' : ''}</span>
                    </button>
                    <button
                      class="browse-favorite-btn${isFavorite ? ' active' : ''}"
                      data-action="toggle-favorite-modal"
                      data-company-id="${escapeAttr(company.id)}"
                      type="button"
                    >${isFavorite ? '★' : '☆'}</button>
                  </div>
                `;
  }).join('')}
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function openBrowseAllModal(root) {
  const existing = document.querySelector('[data-modal="browse-all"]');
  if (existing) existing.remove();

  document.body.insertAdjacentHTML('beforeend', renderBrowseAllModal());
  attachBrowseModalListeners(root);
}

function attachBrowseModalListeners(root) {
  const modal = document.querySelector('[data-modal="browse-all"]');
  if (!modal) return;

  // Close button
  const closeBtn = modal.querySelector('[data-action="close-browse-modal"]');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeBrowseModal);
  }

  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeBrowseModal();
  });

  // Switch company
  modal.querySelectorAll('[data-action="switch-company-modal"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const companyId = btn.dataset.companyId;
      closeBrowseModal();
      handleSwitchCompany(companyId, root);
    });
  });

  // Toggle favorite
  modal.querySelectorAll('[data-action="toggle-favorite-modal"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const companyId = btn.dataset.companyId;
      pageSystem.toggleFavorite(companyId);
      // Re-render modal
      closeBrowseModal();
      setTimeout(() => openBrowseAllModal(root), 0);
    });
  });

  // Search
  const searchInput = modal.querySelector('[data-action="search-browse-companies"]');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      handleBrowseSearch(e.target.value, root);
    });
  }
}

function closeBrowseModal() {
  const modal = document.querySelector('[data-modal="browse-all"]');
  if (modal) modal.remove();
}

function handleBrowseSearch(query, root) {
  const modal = document.querySelector('[data-modal="browse-all"]');
  if (!modal) return;

  const items = modal.querySelectorAll('.browse-company-item');
  const lowerQuery = query.toLowerCase();

  items.forEach(item => {
    const btn = item.querySelector('.browse-company-btn');
    const name = btn.querySelector('.browse-company-name').textContent.toLowerCase();

    if (name.includes(lowerQuery)) {
      item.style.display = '';
    } else {
      item.style.display = 'none';
    }
  });

  // Hide empty letter groups
  const groups = modal.querySelectorAll('.browse-letter-group');
  groups.forEach(group => {
    const visibleItems = group.querySelectorAll('.browse-company-item:not([style*="display: none"])');
    if (visibleItems.length === 0) {
      group.style.display = 'none';
    } else {
      group.style.display = '';
    }
  });
}

function refreshPageSystemUI(root) {
  const pageSystemEl = root.querySelector('.page-system');
  if (!pageSystemEl) return;

  // Replace the page system HTML
  pageSystemEl.outerHTML = renderPageSystemControls();

  // Re-attach event listeners to the new elements
  attachPageSystemListeners(root);
}

function buildMasterLabelLookup() {
  return packages.reduce((map, pkg) => {
    (pkg.groups || []).forEach(group => {
      map.set(group.masterId, group.label);
    });
    return map;
  }, new Map());
}
