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
            ${panels.map(renderPanel).join('')}
          </aside>
        </section>
      </main>
    </div>
  `;

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
  registerCopyHandlers(root, () => editMode);
  widthSyncRoot = root;
  requestAnimationFrame(() => syncPanelWidths(root));
  ensureWidthSyncListener();
}

function renderHeader() {
  return `
    <header class="header">
      <div class="header-logo">
        <div class="logo-container">
          <img src="assets/img/solidcam-logo.svg" alt="SolidCAM logo" class="logo">
        </div>
      </div>
      <div class="header-center">
        <h1 class="header-title">SolidCAM Packages &amp; Maintenance Cheat Sheet</h1>
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
  return `
    <a href="${safeHref}" class="${intentClass}" target="_blank" rel="noopener noreferrer">
      ${safeLabel}
    </a>
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
          <th>Included Bits</th>
        </tr>
      </thead>
      <tbody>
        ${packages.map(renderPackageRow).join('')}
      </tbody>
    </table>
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
  registerCopyHandlers(element, () => editMode);

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
  registerCopyHandlers(replacement, () => editMode);
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
  registerCopyHandlers(item, () => editMode);

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

  const maintenance = root.querySelector('.panel[data-panel="maintenance-skus"]');
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

function buildMasterLabelLookup() {
  return packages.reduce((map, pkg) => {
    (pkg.groups || []).forEach(group => {
      map.set(group.masterId, group.label);
    });
    return map;
  }, new Map());
}
