import {
  tierDefinitions,
  getManufacturers,
  filterMachines,
  getMachineById
} from './post-matcher-data.js';
import {
  createCompany,
  getAllCompanies,
  getCurrentCompany,
  getCurrentCompanyId,
  setCurrentCompany,
  addMachineToCompany,
  removeMachineFromCompany,
  updateMachineNotes,
  exportCompanyToCSV,
  deleteCompany,
  loadCompany
} from './post-matcher-company.js';

const FAVORITES_KEY = 'post-matcher.favorites.v1';

const state = {
  root: null,
  filters: {
    manufacturer: 'all',
    tier: 'all',
    search: ''
  },
  catalog: [],
  companies: [],
  currentCompany: null,
  toastTimer: null,
  favorites: loadFavorites()
};

export function createPostMatcherUI(container) {
  if (!container) return;
  state.catalog = filterMachines(state.filters);
  container.innerHTML = renderShell();
  state.root = container.querySelector('.post-matcher');
  bindEvents();
  refreshCompanyState();
  renderCatalog();
  renderFavorites();
}

function renderShell() {
  const manufacturerOptions = ['<option value="all">All manufacturers</option>',
    ...getManufacturers().map(item => `
      <option value="${item.name}">${item.name}</option>
    `)
  ].join('');

  const tierOptions = ['<option value="all">All tiers</option>',
    ...Object.entries(tierDefinitions).map(([value, data]) => `
      <option value="${value}">${data.label}</option>
    `)
  ].join('');

  return `
    <div class="post-matcher">
      <div class="post-matcher__columns">
        <section class="post-matcher__card post-matcher__card--catalog">
          <div class="card-header">
            <div>
              <h3>Machine Catalog</h3>
              <p>Predetermined machine → SKU mapping, ready to add.</p>
            </div>
            <span class="pill" data-catalog-count>${state.catalog.length} machines</span>
          </div>
          <div class="catalog-favorites" data-favorites></div>
          <div class="catalog-filters">
            <label>
              <span>Manufacturer</span>
              <select data-filter="manufacturer">${manufacturerOptions}</select>
            </label>
            <label>
              <span>Tier</span>
              <select data-filter="tier">${tierOptions}</select>
            </label>
            <label class="catalog-search">
              <span>Search</span>
              <input type="search" data-filter="search" placeholder="Model, SKU, or keyword">
            </label>
          </div>
          <div class="catalog-table-wrapper">
            <table class="catalog-table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Manufacturer</th>
                  <th>SKU</th>
                  <th>Tier</th>
                  <th>Price</th>
                  <th></th>
                </tr>
              </thead>
              <tbody data-catalog-body></tbody>
            </table>
          </div>
        </section>
        <section class="post-matcher__card post-matcher__card--company" data-company-card>
          <div class="card-header">
            <div>
              <h3>Company Machines</h3>
              <p>Attach machines to a customer, add notes, and copy SKUs.</p>
            </div>
            <div class="company-selector">
              <div class="company-selector__input-wrapper">
                <input type="search"
                       data-company-search
                       placeholder="Search companies..."
                       class="company-selector__search"
                       autocomplete="off">
                <button class="post-matcher-btn post-matcher-btn--ghost" data-action="new-company">New</button>
              </div>
              <div class="company-selector__list" data-company-list hidden></div>
            </div>
          </div>
          <div class="company-toolbar">
            <button class="post-matcher-btn post-matcher-btn--ghost post-matcher-btn--sm" data-action="copy-skus">Copy SKUs</button>
            <button class="post-matcher-btn post-matcher-btn--ghost post-matcher-btn--sm" data-action="copy-summary">Copy Summary</button>
            <button class="post-matcher-btn post-matcher-btn--ghost post-matcher-btn--sm" data-action="export-company">Export CSV</button>
            <button class="post-matcher-btn post-matcher-btn--ghost post-matcher-btn--sm" data-action="delete-company">Delete</button>
          </div>
          <div data-company-machines class="company-machines"></div>
        </section>
      </div>
      <div class="post-matcher-toast" data-toast hidden></div>
    </div>
  `;
}

function bindEvents() {
  const root = state.root;
  if (!root) return;
  root.addEventListener('input', handleInput);
  root.addEventListener('change', handleChange);
  root.addEventListener('click', handleClick);
  root.addEventListener('focusin', handleFocus);
  root.addEventListener('focusout', handleBlur);
  root.addEventListener('keydown', handleKeyDown);
}

function handleInput(event) {
  const target = event.target;
  if (target.matches('[data-filter="search"]')) {
    state.filters.search = target.value;
    refreshCatalog();
  }
  if (target.matches('[data-company-search]')) {
    renderCompanyList();
  }
}

function handleChange(event) {
  const target = event.target;
  if (target.matches('[data-filter="manufacturer"]')) {
    state.filters.manufacturer = target.value || 'all';
    refreshCatalog();
    return;
  }
  if (target.matches('[data-filter="tier"]')) {
    state.filters.tier = target.value || 'all';
    refreshCatalog();
    return;
  }
  if (target.matches('[data-company-select]')) {
    const nextId = target.value || null;
    setCurrentCompany(nextId);
    refreshCompanyState();
  }
}

function handleClick(event) {
  const action = event.target.closest('[data-action]');
  if (!action) return;

  // Add visual feedback for copy actions
  if (action.dataset.action?.startsWith('copy-')) {
    action.classList.add('copied');
    setTimeout(() => action.classList.remove('copied'), 400);
    // Dispatch copy-hud event for visual feedback
    const pos = { x: event.clientX, y: event.clientY };
    window.dispatchEvent(
      new CustomEvent('copy-hud', {
        detail: { x: pos.x, y: pos.y, target: action, text: action.textContent?.trim() || '' }
      })
    );
  }

  switch (action.dataset.action) {
    case 'select-company': {
      const companyId = action.dataset.companyId;
      if (companyId) {
        setCurrentCompany(companyId);
        refreshCompanyState();
        // Clear search input and hide list
        const searchInput = state.root?.querySelector('[data-company-search]');
        if (searchInput) {
          searchInput.value = '';
          searchInput.blur();
        }
      }
      break;
    }
    case 'toggle-favorite': {
      const id = action.dataset.machineId;
      toggleFavorite(id);
      renderFavorites();
      renderCatalog();
      break;
    }
    case 'new-company': {
      const name = prompt('Company name');
      if (!name) return;
      createCompany(name);
      refreshCompanyState();
      showToast(`Created ${name}`);
      break;
    }
    case 'delete-company': {
      const companyId = getCurrentCompanyId();
      if (!companyId) {
        showToast('No company selected');
        return;
      }
      if (confirm('Delete this company and its machines?')) {
        deleteCompany(companyId);
        refreshCompanyState();
        showToast('Company deleted');
      }
      break;
    }
    case 'export-company': {
      const companyId = getCurrentCompanyId();
      if (!companyId) {
        showToast('Select a company first');
        return;
      }
      exportCompanyToCSV(companyId);
      break;
    }
    case 'copy-skus': {
      const company = state.currentCompany;
      if (!company || !company.machines.length) {
        showToast('No machines to copy');
        return;
      }
      const payload = company.machines
        .map(machine => `${machine.fullName} — ${machine.sku}`)
        .join('\n');
      copyToClipboard(payload, 'SKUs copied');
      break;
    }
    case 'copy-summary': {
      const companyId = getCurrentCompanyId();
      if (!companyId) {
        showToast('Select a company first');
        return;
      }
      const company = loadCompany(companyId);
      if (!company || !company.machines.length) {
        showToast('No machines to summarize');
        return;
      }
      const payload = formatCompanySummary(company);
      copyToClipboard(payload, 'Summary copied');
      break;
    }
    case 'catalog-add': {
      const machineId = action.dataset.machineId;
      handleAddMachine(machineId);
      break;
    }
    case 'copy-machine-name': {
      const name = action.dataset.name;
      copyToClipboard(name, 'Machine name copied');
      break;
    }
    case 'copy-catalog-sku': {
      const sku = action.dataset.sku;
      copyToClipboard(sku, 'SKU copied');
      break;
    }
    case 'remove-machine': {
      const companyId = getCurrentCompanyId();
      const machineId = action.closest('[data-company-machine]')?.dataset.companyMachine;
      if (companyId && machineId) {
        removeMachineFromCompany(companyId, machineId);
        refreshCompanyState();
        showToast('Machine removed');
      }
      break;
    }
    case 'copy-machine-sku-only': {
      const sku = action.dataset.sku;
      copyToClipboard(sku, 'SKU copied');
      break;
    }
    case 'copy-machine-price': {
      const price = action.dataset.price;
      copyToClipboard(price, 'Price copied');
      break;
    }
    case 'copy-machine-tier': {
      const tier = action.dataset.tier;
      copyToClipboard(tier, 'Tier copied');
      break;
    }
    case 'copy-machine-sku': {
      const machineId = action.closest('[data-company-machine]')?.dataset.companyMachine;
      const company = state.currentCompany;
      const machine = company?.machines.find(item => item.id === machineId);
      if (machine) {
        copyToClipboard(`${machine.fullName} — ${machine.sku}`, 'SKU copied');
      }
      break;
    }
    case 'copy-machine-detail': {
      const machineId = action.closest('[data-company-machine]')?.dataset.companyMachine;
      const company = state.currentCompany;
      const machine = company?.machines.find(item => item.id === machineId);
      if (machine) {
        const payload = `${machine.fullName} — ${machine.sku} (${machine.skuName}) ${formatCurrency(machine.price)}`;
        copyToClipboard(payload, 'Details copied');
      }
      break;
    }
    case 'edit-notes':
    case 'add-note': {
      enterNoteEditMode(action.closest('[data-company-machine]'));
      break;
    }
    case 'save-notes': {
      const companyId = getCurrentCompanyId();
      if (!companyId) return;
      const host = action.closest('[data-company-machine]');
      const textarea = host?.querySelector('[data-notes-textarea]');
      if (host && textarea) {
        updateMachineNotes(companyId, host.dataset.companyMachine, textarea.value.trim());
        refreshCompanyState();
        showToast('Notes saved');
      }
      break;
    }
    case 'cancel-notes': {
      exitNoteEditMode(action.closest('[data-company-machine]'));
      break;
    }
    default:
      break;
  }
}

function handleFocus(event) {
  const target = event.target;
  if (target.matches('[data-company-search]')) {
    // Show list when search input is focused
    renderCompanyList();
  }
}

function handleBlur(event) {
  const target = event.target;
  if (target.matches('[data-company-search]')) {
    // Use setTimeout to allow click events on list items to fire first
    setTimeout(() => {
      const list = state.root?.querySelector('[data-company-list]');
      if (list && document.activeElement !== target) {
        list.hidden = true;
      }
    }, 200);
  }
}

function handleKeyDown(event) {
  const target = event.target;
  if (!target.matches('[data-company-search]')) return;

  const list = state.root?.querySelector('[data-company-list]');
  if (!list || list.hidden) return;

  const items = Array.from(list.querySelectorAll('[data-action="select-company"]'));
  if (!items.length) return;

  const currentIndex = items.findIndex(item => item.matches(':focus, .is-highlighted'));

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
      items[nextIndex]?.focus();
      break;
    case 'ArrowUp':
      event.preventDefault();
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
      items[prevIndex]?.focus();
      break;
    case 'Enter':
      if (currentIndex >= 0) {
        event.preventDefault();
        items[currentIndex]?.click();
      }
      break;
    case 'Escape':
      event.preventDefault();
      target.value = '';
      list.hidden = true;
      target.blur();
      break;
  }
}

function refreshCatalog() {
  state.catalog = filterMachines(state.filters);
  renderCatalog();
}

function renderCatalog() {
  const tableBody = state.root?.querySelector('[data-catalog-body]');
  const count = state.root?.querySelector('[data-catalog-count]');
  if (!tableBody) return;
  const current = state.currentCompany;
  const shouldRenderTable =
    state.filters.manufacturer !== 'all' || Boolean(state.filters.search.trim());
  if (!shouldRenderTable) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="catalog-table__empty">
          Select a manufacturer or search to view machines.
        </td>
      </tr>
    `;
  } else if (!state.catalog.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="catalog-table__empty">
          No machines match your filters.
        </td>
      </tr>
    `;
  } else {
    tableBody.innerHTML = state.catalog
      .map(machine => {
        const alreadyAdded = current?.machines?.some(item => item.id === machine.id);
        const tierLabel = tierDefinitions[machine.tier]?.label ?? `Tier ${machine.tier}`;
        const favorite = state.favorites.has(machine.id);
        return `
          <tr>
            <td>
              <strong>${escapeHtml(machine.model)}</strong>
            </td>
            <td>${escapeHtml(machine.manufacturer)}</td>
            <td>
              <button class="sku-chip" data-action="copy-catalog-sku" data-name="${escapeHtml(machine.fullName)}" data-sku="${machine.sku}">${escapeHtml(machine.sku)}</button>
            </td>
            <td>${escapeHtml(tierLabel)}</td>
            <td>${formatCurrency(machine.price)}</td>
            <td class="catalog-table__actions">
              <button class="post-matcher-btn post-matcher-btn--sm" data-action="catalog-add" data-machine-id="${machine.id}" ${alreadyAdded ? 'disabled' : ''}>${alreadyAdded ? 'Added' : 'Add'}</button>
              <button class="favorite-toggle ${favorite ? 'is-active' : ''}" data-action="toggle-favorite" data-machine-id="${machine.id}" title="${favorite ? 'Remove favorite' : 'Add favorite'}">★</button>
            </td>
          </tr>
        `;
      })
      .join('');
  }
  if (count) {
    count.textContent = `${state.catalog.length} machines`;
  }
}

function renderFavorites() {
  const mount = state.root?.querySelector('[data-favorites]');
  if (!mount) return;
  if (state.favorites.size === 0) {
    mount.innerHTML = '<p class="favorite-empty">Favorite your go-to machines for quick access.</p>';
    return;
  }
  const cards = Array.from(state.favorites)
    .map(id => getMachineById(id))
    .filter(Boolean)
    .map(machine => {
      const tierLabel = tierDefinitions[machine.tier]?.label ?? `Tier ${machine.tier}`;
      return `
        <article class="favorite-card">
          <div>
            <p class="favorite-card__name">${escapeHtml(machine.fullName)}</p>
            <p class="favorite-card__meta">${escapeHtml(tierLabel)} • ${formatCurrency(machine.price)}</p>
          </div>
          <div class="favorite-card__actions">
            <button class="sku-chip" data-action="copy-catalog-sku" data-name="${escapeHtml(machine.fullName)}" data-sku="${machine.sku}">${escapeHtml(machine.sku)}</button>
            <button class="post-matcher-btn post-matcher-btn--sm" data-action="catalog-add" data-machine-id="${machine.id}">Add</button>
            <button class="favorite-toggle is-active" data-action="toggle-favorite" data-machine-id="${machine.id}" title="Remove favorite">★</button>
          </div>
        </article>
      `;
    })
    .join('');
  mount.innerHTML = `
    <div class="favorite-header">
      <div>
        <h4>Favorites</h4>
        <p>Pinned machines stay available even without filtering.</p>
      </div>
      <span class="pill">${state.favorites.size}</span>
    </div>
    <div class="favorite-grid">${cards}</div>
  `;
}

function handleAddMachine(machineId) {
  const company = state.currentCompany;
  if (!company) {
    showToast('Create or select a company first');
    return;
  }
  const machine = getMachineById(machineId);
  if (!machine) {
    showToast('Machine not found');
    return;
  }
  addMachineToCompany(company.id, machine);
  refreshCompanyState();
  showToast(`${machine.fullName} added to ${company.name}`);
}

function refreshCompanyState() {
  const companies = getAllCompanies();
  let current = getCurrentCompany();
  if (!current && companies.length) {
    current = companies[0];
    setCurrentCompany(current.id);
  }
  state.companies = companies;
  state.currentCompany = current ?? null;
  renderCompanySelector(companies, current?.id ?? '');
  renderCompanyMachines(current);
  renderCatalog();
  renderFavorites();
}

function renderCompanySelector(companies, currentId) {
  const searchInput = state.root?.querySelector('[data-company-search]');
  if (!searchInput) return;

  if (!companies.length) {
    toggleCompanyControls(true);
    // Store empty state
    state.allCompanies = [];
    state.currentCompanyId = '';
    renderCompanyList();
    return;
  }

  // Sort companies: current company first, then alphabetically
  const sortedCompanies = [...companies].sort((a, b) => {
    if (a.id === currentId) return -1;
    if (b.id === currentId) return 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  // Store in state for filtering
  state.allCompanies = sortedCompanies;
  state.currentCompanyId = currentId || '';

  toggleCompanyControls(false);

  // Update the search input to show current company name
  const currentCompany = companies.find(c => c.id === currentId);
  if (currentCompany && searchInput.value === '') {
    searchInput.placeholder = currentCompany.name;
  }

  // Render the list (initially hidden until user focuses/types)
  renderCompanyList();
}

function renderCompanyList() {
  const list = state.root?.querySelector('[data-company-list]');
  const searchInput = state.root?.querySelector('[data-company-search]');
  if (!list || !searchInput) return;

  const companies = state.allCompanies || [];
  const currentId = state.currentCompanyId || '';
  const searchTerm = searchInput.value.toLowerCase().trim();

  // If no search term and not focused, hide list
  if (!searchTerm && document.activeElement !== searchInput) {
    list.hidden = true;
    return;
  }

  // Filter companies based on search term
  const filteredCompanies = searchTerm
    ? companies.filter(c => c.name.toLowerCase().includes(searchTerm))
    : companies;

  // Render list
  if (!filteredCompanies.length) {
    list.innerHTML = '<div class="company-selector__empty">No companies found</div>';
    list.hidden = false;
    return;
  }

  list.innerHTML = filteredCompanies
    .map((company, index) => {
      const isCurrent = company.id === currentId;
      return `
        <button
          class="company-selector__item ${isCurrent ? 'is-current' : ''}"
          data-action="select-company"
          data-company-id="${company.id}"
          data-index="${index}"
          type="button">
          <span class="company-selector__item-name">${escapeHtml(company.name)}</span>
          ${isCurrent ? '<span class="company-selector__item-check">✓</span>' : ''}
        </button>
      `;
    })
    .join('');

  list.hidden = false;
}

function renderCompanyMachines(company) {
  const mount = state.root?.querySelector('[data-company-machines]');
  if (!mount) return;
  if (!company) {
    mount.innerHTML = '<p class="company-empty">Create a company to start building a list.</p>';
    return;
  }
  if (!company.machines.length) {
    mount.innerHTML = '<p class="company-empty">No machines yet. Use the catalog to add them.</p>';
    return;
  }
  mount.innerHTML = company.machines
    .map(machine => renderCompanyMachine(machine))
    .join('');
}

function renderCompanyMachine(machine) {
  const tierLabel = tierDefinitions[machine.tier]?.label ?? `Tier ${machine.tier}`;
  const hasNotes = Boolean(machine.notes);
  return `
    <article class="company-machine" data-company-machine="${machine.id}" data-tier="${machine.tier}">
      <div class="company-machine__row">
        <div>
          <button class="sku-chip company-machine__name-chip" data-action="copy-machine-name" data-name="${escapeHtml(machine.fullName)}">${escapeHtml(machine.fullName)}</button>
          <div class="company-machine__meta">
            <button class="sku-chip" data-action="copy-machine-sku-only" data-sku="${escapeHtml(machine.sku)}">${escapeHtml(machine.sku)}</button>
            <button class="sku-chip" data-action="copy-machine-price" data-price="${formatCurrency(machine.price)}">${formatCurrency(machine.price)}</button>
            <button class="sku-chip" data-action="copy-machine-tier" data-tier="${escapeHtml(tierLabel)}">${escapeHtml(tierLabel)}</button>
          </div>
        </div>
        <div class="company-machine__actions">
          <button data-action="copy-machine-detail" title="Copy full details">Full</button>
          <button data-action="remove-machine" title="Remove">×</button>
        </div>
      </div>
      <div class="company-machine__notes">
        <div data-notes-display ${hasNotes ? '' : 'hidden'}>
          <p class="machine-notes-text">${escapeHtml(machine.notes || '')}</p>
          <button class="machine-notes-edit-btn" data-action="edit-notes">Edit Note</button>
        </div>
        <div data-notes-empty ${hasNotes ? 'hidden' : ''}>
          <button class="machine-notes-edit-btn" data-action="add-note">+ Add Note</button>
        </div>
        <div class="machine-notes-edit" data-notes-edit hidden>
          <textarea rows="3" class="machine-notes-textarea" data-notes-textarea placeholder="Add notes about this machine...">${escapeHtml(machine.notes || '')}</textarea>
          <div class="machine-notes-actions">
            <button class="post-matcher-btn post-matcher-btn--sm" data-action="save-notes">Save</button>
            <button class="post-matcher-btn post-matcher-btn--ghost post-matcher-btn--sm" data-action="cancel-notes">Cancel</button>
          </div>
        </div>
      </div>
    </article>
  `;
}

function enterNoteEditMode(element) {
  if (!element) return;
  element.querySelector('[data-notes-edit]')?.removeAttribute('hidden');
  element.querySelector('[data-notes-display]')?.setAttribute('hidden', 'true');
  element.querySelector('[data-notes-empty]')?.setAttribute('hidden', 'true');
  element.querySelector('[data-notes-textarea]')?.focus();
}

function exitNoteEditMode(element) {
  if (!element) return;
  const textarea = element.querySelector('[data-notes-textarea]');
  const hasText = Boolean(textarea?.value.trim());
  element.querySelector('[data-notes-edit]')?.setAttribute('hidden', 'true');
  if (hasText) {
    element.querySelector('[data-notes-display]')?.removeAttribute('hidden');
    element.querySelector('[data-notes-empty]')?.setAttribute('hidden', 'true');
  } else {
    element.querySelector('[data-notes-display]')?.setAttribute('hidden', 'true');
    element.querySelector('[data-notes-empty]')?.removeAttribute('hidden');
  }
}

function toggleCompanyControls(disabled) {
  state.root
    ?.querySelectorAll('.company-toolbar button')
    .forEach(button => {
      button.disabled = disabled;
    });
}

function formatCompanySummary(company) {
  const lines = [`Company: ${company.name}`];
  company.machines.forEach(machine => {
    lines.push(`- ${machine.fullName} — ${machine.sku} (${machine.skuName}) ${formatCurrency(machine.price)}`);
    if (machine.notes) {
      lines.push(`  Notes: ${machine.notes}`);
    }
  });
  return lines.join('\n');
}

function copyToClipboard(text, message) {
  if (!navigator?.clipboard) {
    showToast('Clipboard unavailable');
    return;
  }
  navigator.clipboard
    .writeText(text)
    .then(() => showToast(message))
    .catch(() => showToast('Unable to copy'));
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value ?? 0);
}

function escapeHtml(value = '') {
  return value
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showToast(message) {
  const toast = state.root?.querySelector('[data-toast]');
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  toast.classList.add('is-visible');
  if (state.toastTimer) {
    clearTimeout(state.toastTimer);
  }
  state.toastTimer = setTimeout(() => {
    toast.classList.remove('is-visible');
    toast.hidden = true;
  }, 2200);
}

function loadFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch (error) {
    console.warn('Unable to load favorites', error);
    return new Set();
  }
}

function saveFavorites() {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(state.favorites)));
  } catch (error) {
    console.warn('Unable to save favorites', error);
  }
}

function toggleFavorite(machineId) {
  if (!machineId) return;
  if (state.favorites.has(machineId)) {
    state.favorites.delete(machineId);
    showToast('Removed favorite');
  } else {
    state.favorites.add(machineId);
    showToast('Added to favorites');
  }
  saveFavorites();
}
