const DEFAULT_POLL_INTERVAL = 2000;

export class ChatbotContextProcessor {
  constructor(options = {}) {
    this.interval = Number.isFinite(options.interval)
      ? Math.max(500, options.interval)
      : DEFAULT_POLL_INTERVAL;
    this.snapshot = createEmptySnapshot();
    this.handlers = new Map();
    this.timerId = null;
  }

  start() {
    if (this.timerId) return;
    this.collect();
    const runner = () => this.collect();
    if (typeof window !== 'undefined') {
      this.timerId = window.setInterval(runner, this.interval);
    } else {
      this.timerId = setInterval(runner, this.interval);
    }
  }

  stop() {
    if (!this.timerId) return;
    if (typeof window !== 'undefined') {
      window.clearInterval(this.timerId);
    } else {
      clearInterval(this.timerId);
    }
    this.timerId = null;
  }

  onUpdate(key, callback) {
    if (typeof callback !== 'function') return;
    this.handlers.set(key, callback);
    callback(this.snapshot[key] ?? this.snapshot);
  }

  removeListener(key) {
    this.handlers.delete(key);
  }

  getSnapshot() {
    return { ...this.snapshot };
  }

  collect() {
    const snapshot = {
      timestamp: Date.now(),
      packages: readPackages(),
      templates: readTemplates(),
      selections: readSelections()
    };
    this.snapshot = snapshot;
    this.handlers.forEach((callback, key) => {
      try {
        callback(snapshot[key] ?? snapshot);
      } catch (error) {
        console.warn('Context handler failed', key, error);
      }
    });
  }
}

function createEmptySnapshot() {
  return {
    timestamp: Date.now(),
    packages: [],
    templates: {
      activeId: null,
      total: 0
    },
    selections: {
      checkedPackages: []
    }
  };
}

function readPackages() {
  if (typeof document === 'undefined') return [];
  const rows = Array.from(document.querySelectorAll('.main-table tbody tr[data-package]'));
  return rows.map(row => {
    const code = row.getAttribute('data-package');
    const name =
      row.getAttribute('data-package-name') ||
      row.querySelector('.package-description')?.textContent?.trim() ||
      '';
    const maintenance =
      row.getAttribute('data-maintenance') ||
      row.querySelector('.maint code')?.textContent?.trim() ||
      '';
    const looseBits = Array.from(row.querySelectorAll('.bits > li[data-bit]'))
      .map(bit => bit.getAttribute('data-bit') || bit.querySelector('span')?.textContent?.trim())
      .filter(Boolean);
    const masterGroups = Array.from(row.querySelectorAll('.master-bit')).map(group => {
      const label =
        group.getAttribute('data-master-label') ||
        group.querySelector('.master-label span')?.textContent?.trim() ||
        '';
      const items = Array.from(group.querySelectorAll('.sub-bits li[data-bit] span'))
        .map(bit => bit.textContent?.trim())
        .filter(Boolean);
      return { label, items };
    });
    return {
      code,
      name,
      description: name,
      maintenance,
      looseBits,
      masterGroups
    };
  });
}

function readTemplates() {
  if (typeof document === 'undefined') return { activeId: null, total: 0 };
  const items = Array.from(document.querySelectorAll('[data-template-id]'));
  const active = items.find(item => item.classList.contains('active'));
  return {
    activeId: active?.getAttribute('data-template-id') || null,
    total: items.length
  };
}

function readSelections() {
  if (typeof document === 'undefined') {
    return {
      checkedPackages: [],
      packages: [],
      totalChecked: 0
    };
  }

  const checked = Array.from(document.querySelectorAll('.bit-checkbox:checked'));
  const byPackage = new Map();

  const ensurePackageEntry = pkgRow => {
    const code = pkgRow?.getAttribute('data-package');
    if (!code) return null;
    if (!byPackage.has(code)) {
      const name =
        pkgRow.getAttribute('data-package-name') ||
        pkgRow.querySelector('.package-description')?.textContent?.trim() ||
        '';
      const maintenance = pkgRow.getAttribute('data-maintenance') || '';
      byPackage.set(code, {
        code,
        name,
        maintenance,
        notes: new Set(),
        looseBits: new Set(),
        masterGroups: new Map()
      });
    }
    return byPackage.get(code);
  };

  checked.forEach(cb => {
    const pkgRow = cb.closest('tr[data-package]');
    const entry = ensurePackageEntry(pkgRow);
    if (!entry) return;

    const label = cb.closest('label');
    const text =
      label?.querySelector('span')?.textContent?.trim() ||
      label?.textContent?.trim() ||
      cb.closest('[data-bit]')?.getAttribute('data-bit') ||
      '';

    const masterLabel =
      cb.closest('.master-bit')?.getAttribute('data-master-label') ||
      cb.getAttribute('data-parent') ||
      '';

    if (cb.classList.contains('master-checkbox')) {
      if (masterLabel) {
        const group = entry.masterGroups.get(masterLabel) || { items: new Set(), allSelected: false };
        group.allSelected = true;
        entry.masterGroups.set(masterLabel, group);
      } else if (text) {
        entry.notes.add(text);
      }
    } else if (cb.classList.contains('sub-checkbox')) {
      if (masterLabel) {
        const group = entry.masterGroups.get(masterLabel) || { items: new Set(), allSelected: false };
        if (text) {
          group.items.add(text);
        }
        entry.masterGroups.set(masterLabel, group);
      } else if (text) {
        entry.notes.add(text);
      }
    } else {
      if (text) {
        entry.looseBits.add(text);
      }
    }
  });

  const packages = Array.from(byPackage.values()).map(entry => ({
    code: entry.code,
    name: entry.name,
    maintenance: entry.maintenance,
    looseBits: Array.from(entry.looseBits),
    masterGroups: Array.from(entry.masterGroups.entries()).map(([label, set]) => ({
      label,
      items: set.allSelected ? ['All options'] : Array.from(set.items)
    })),
    notes: Array.from(entry.notes)
  }));

  return {
    checkedPackages: packages.map(pkg => pkg.code),
    packages,
    totalChecked: checked.length
  };
}
