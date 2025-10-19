const DEFAULT_POLL_INTERVAL = 2000;

export class ChatbotContextProcessor {
  constructor(options = {}) {
    this.interval = Number.isFinite(options.interval)
      ? Math.max(500, options.interval)
      : DEFAULT_POLL_INTERVAL;
    this.snapshot = createEmptySnapshot();
    this.handlers = new Map();
    this.timerId = null;
    this.collectInProgress = false;
    this.packageCache = new Map();
    this.packageBuffer = [];
    this.templateBuffer = { activeId: null, total: 0 };
    this.selectionBuffer = createSelectionBuffer();
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
    const value = key && this.snapshot[key] !== undefined ? this.snapshot[key] : this.snapshot;
    callback(cloneSnapshotValue(value, key));
  }

  removeListener(key) {
    this.handlers.delete(key);
  }

  getSnapshot() {
    return cloneSnapshot(this.snapshot);
  }

  collect() {
    if (this.collectInProgress) {
      return;
    }
    this.collectInProgress = true;

    try {
      const timestamp = Date.now();
      const packages = readPackagesIntoBuffer(this.packageBuffer, this.packageCache);
      const templates = readTemplatesIntoBuffer(this.templateBuffer);
      const selections = readSelectionsIntoBuffer(this.selectionBuffer);

      updateSnapshot(this.snapshot, timestamp, packages, templates, selections);

      this.handlers.forEach((callback, key) => {
        const value = key && this.snapshot[key] !== undefined ? this.snapshot[key] : this.snapshot;
        try {
          callback(cloneSnapshotValue(value, key));
        } catch (error) {
          console.warn('Context handler failed', key, error);
        }
      });
    } finally {
      this.collectInProgress = false;
    }
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
      checkedPackages: [],
      packages: [],
      totalChecked: 0
    }
  };
}

function createSelectionBuffer() {
  return {
    byPackage: new Map(),
    checkedPackages: [],
    packages: [],
    totalChecked: 0
  };
}

function createPackageEntry() {
  return {
    code: '',
    name: '',
    description: '',
    maintenance: '',
    looseBits: [],
    masterGroups: []
  };
}

function createPackageView() {
  return {
    code: '',
    name: '',
    description: '',
    maintenance: '',
    looseBits: [],
    masterGroups: []
  };
}

function createMasterGroupEntry() {
  return {
    label: '',
    items: []
  };
}

function createSelectionPackageView() {
  return {
    code: '',
    name: '',
    maintenance: '',
    looseBits: [],
    masterGroups: [],
    notes: []
  };
}

function createSelectionEntry(code) {
  return {
    code,
    name: '',
    maintenance: '',
    notes: new Set(),
    looseBits: new Set(),
    masterGroups: new Map(),
    active: false,
    seen: false,
    output: createSelectionPackageView()
  };
}

function createSelectionGroup() {
  return {
    items: new Set(),
    allSelected: false
  };
}

function updateSnapshot(snapshot, timestamp, packages, templates, selections) {
  snapshot.timestamp = timestamp;
  updatePackagesView(snapshot.packages, packages);
  updateTemplateView(snapshot.templates, templates);
  updateSelectionsView(snapshot.selections, selections);
}

function updatePackagesView(targetPackages, sourcePackages) {
  ensureArraySize(targetPackages, sourcePackages.length, createPackageView);
  for (let index = 0; index < sourcePackages.length; index += 1) {
    const source = sourcePackages[index];
    const target = targetPackages[index];
    target.code = source.code;
    target.name = source.name;
    target.description = source.description;
    target.maintenance = source.maintenance;
    copyStringArray(target.looseBits, source.looseBits);
    ensureArraySize(target.masterGroups, source.masterGroups.length, createMasterGroupEntry);
    for (let groupIndex = 0; groupIndex < source.masterGroups.length; groupIndex += 1) {
      const sourceGroup = source.masterGroups[groupIndex];
      const targetGroup = target.masterGroups[groupIndex];
      targetGroup.label = sourceGroup.label;
      copyStringArray(targetGroup.items, sourceGroup.items);
    }
    target.masterGroups.length = source.masterGroups.length;
  }
  targetPackages.length = sourcePackages.length;
}

function updateTemplateView(target, source) {
  target.activeId = source.activeId || null;
  target.total = Number.isFinite(source.total) ? source.total : 0;
}

function updateSelectionsView(target, buffer) {
  copyStringArray(target.checkedPackages, buffer.checkedPackages);
  target.totalChecked = buffer.totalChecked;
  ensureArraySize(target.packages, buffer.packages.length, createSelectionPackageView);
  for (let index = 0; index < buffer.packages.length; index += 1) {
    const source = buffer.packages[index];
    const targetPackage = target.packages[index];
    targetPackage.code = source.code;
    targetPackage.name = source.name;
    targetPackage.maintenance = source.maintenance;
    copyStringArray(targetPackage.looseBits, source.looseBits);
    copyStringArray(targetPackage.notes, source.notes);
    ensureArraySize(targetPackage.masterGroups, source.masterGroups.length, createMasterGroupEntry);
    for (let groupIndex = 0; groupIndex < source.masterGroups.length; groupIndex += 1) {
      const sourceGroup = source.masterGroups[groupIndex];
      const targetGroup = targetPackage.masterGroups[groupIndex];
      targetGroup.label = sourceGroup.label;
      copyStringArray(targetGroup.items, sourceGroup.items);
    }
    targetPackage.masterGroups.length = source.masterGroups.length;
  }
  target.packages.length = buffer.packages.length;
}

function readPackagesIntoBuffer(buffer, cache) {
  buffer.length = 0;
  if (typeof document === 'undefined') {
    cache.clear();
    return buffer;
  }

  const rows = Array.from(document.querySelectorAll('.main-table tbody tr[data-package]'));
  const seen = new Set();

  rows.forEach(row => {
    const code = row.getAttribute('data-package');
    if (!code) {
      return;
    }
    seen.add(code);
    let entry = cache.get(code);
    if (!entry) {
      entry = createPackageEntry();
      cache.set(code, entry);
    }
    entry.code = code;
    entry.name =
      row.getAttribute('data-package-name') ||
      row.querySelector('.package-description')?.textContent?.trim() ||
      '';
    entry.description = entry.name;
    entry.maintenance =
      row.getAttribute('data-maintenance') ||
      row.querySelector('.maint code')?.textContent?.trim() ||
      '';
    entry.looseBits.length = 0;
    row
      .querySelectorAll('.bits > li[data-bit]')
      .forEach(bit => {
        const text = bit.getAttribute('data-bit') || bit.querySelector('span')?.textContent?.trim();
        if (text) {
          entry.looseBits.push(text);
        }
      });
    const groups = Array.from(row.querySelectorAll('.master-bit'));
    ensureArraySize(entry.masterGroups, groups.length, createMasterGroupEntry);
    for (let index = 0; index < groups.length; index += 1) {
      const groupEl = groups[index];
      const groupEntry = entry.masterGroups[index];
      groupEntry.label =
        groupEl.getAttribute('data-master-label') ||
        groupEl.querySelector('.master-label span')?.textContent?.trim() ||
        '';
      copyNodeListText(groupEntry.items, groupEl.querySelectorAll('.sub-bits li[data-bit] span'));
    }
    entry.masterGroups.length = groups.length;
    buffer.push(entry);
  });

  cache.forEach((_, code) => {
    if (!seen.has(code)) {
      cache.delete(code);
    }
  });

  return buffer;
}

function readTemplatesIntoBuffer(buffer) {
  if (typeof document === 'undefined') {
    buffer.activeId = null;
    buffer.total = 0;
    return buffer;
  }
  const items = Array.from(document.querySelectorAll('[data-template-id]'));
  const active = items.find(item => item.classList.contains('active'));
  buffer.activeId = active?.getAttribute('data-template-id') || null;
  buffer.total = items.length;
  return buffer;
}

function readSelectionsIntoBuffer(buffer) {
  const { byPackage } = buffer;
  buffer.checkedPackages.length = 0;
  buffer.packages.length = 0;
  buffer.totalChecked = 0;

  byPackage.forEach(entry => {
    entry.active = false;
    entry.seen = false;
    entry.notes.clear();
    entry.looseBits.clear();
    entry.masterGroups.forEach(group => {
      group.items.clear();
      group.allSelected = false;
    });
  });

  if (typeof document === 'undefined') {
    return buffer;
  }

  const checked = Array.from(document.querySelectorAll('.bit-checkbox:checked'));
  buffer.totalChecked = checked.length;
  const order = [];

  checked.forEach(cb => {
    const pkgRow = cb.closest('tr[data-package]');
    if (!pkgRow) return;
    const code = pkgRow.getAttribute('data-package');
    if (!code) return;

    let entry = byPackage.get(code);
    if (!entry) {
      entry = createSelectionEntry(code);
      byPackage.set(code, entry);
    }
    entry.active = true;
    if (!entry.seen) {
      entry.seen = true;
      order.push(entry);
    }
    entry.code = code;
    entry.name =
      pkgRow.getAttribute('data-package-name') ||
      pkgRow.querySelector('.package-description')?.textContent?.trim() ||
      '';
    entry.maintenance = pkgRow.getAttribute('data-maintenance') || '';

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
        const group = getOrCreateSelectionGroup(entry, masterLabel);
        group.allSelected = true;
      } else if (text) {
        entry.notes.add(text);
      }
    } else if (cb.classList.contains('sub-checkbox')) {
      if (masterLabel) {
        const group = getOrCreateSelectionGroup(entry, masterLabel);
        if (text) {
          group.items.add(text);
        }
      } else if (text) {
        entry.notes.add(text);
      }
    } else if (text) {
      entry.looseBits.add(text);
    }
  });

  byPackage.forEach((entry, code) => {
    if (!entry.active) {
      byPackage.delete(code);
    }
  });

  order.forEach(entry => {
    buffer.checkedPackages.push(entry.code);
    populateSelectionOutput(entry);
    buffer.packages.push(entry.output);
  });

  return buffer;
}

function getOrCreateSelectionGroup(entry, label) {
  let group = entry.masterGroups.get(label);
  if (!group) {
    group = createSelectionGroup();
    entry.masterGroups.set(label, group);
  }
  return group;
}

function populateSelectionOutput(entry) {
  const output = entry.output;
  output.code = entry.code;
  output.name = entry.name;
  output.maintenance = entry.maintenance;
  copySetToArray(output.looseBits, entry.looseBits);
  copySetToArray(output.notes, entry.notes);
  output.masterGroups.length = 0;
  let groupIndex = 0;
  entry.masterGroups.forEach((group, label) => {
    if (!group.allSelected && group.items.size === 0) {
      return;
    }
    ensureArraySize(output.masterGroups, groupIndex + 1, createMasterGroupEntry);
    const outputGroup = output.masterGroups[groupIndex];
    outputGroup.label = label;
    outputGroup.items.length = 0;
    if (group.allSelected) {
      outputGroup.items.push('All options');
    } else {
      copySetToArray(outputGroup.items, group.items);
    }
    groupIndex += 1;
  });
  output.masterGroups.length = groupIndex;
}

function copyStringArray(target, source) {
  target.length = 0;
  source.forEach(value => target.push(value));
}

function copySetToArray(target, source) {
  target.length = 0;
  source.forEach(value => target.push(value));
}

function copyNodeListText(target, nodeList) {
  target.length = 0;
  nodeList.forEach(node => {
    const text = node?.textContent?.trim();
    if (text) {
      target.push(text);
    }
  });
}

function ensureArraySize(array, size, factory) {
  while (array.length < size) {
    array.push(factory());
  }
  if (array.length > size) {
    array.length = size;
  }
}

function cloneSnapshot(snapshot) {
  return {
    timestamp: snapshot.timestamp,
    packages: clonePackages(snapshot.packages),
    templates: cloneTemplates(snapshot.templates),
    selections: cloneSelections(snapshot.selections)
  };
}

function clonePackages(packages) {
  return packages.map(pkg => ({
    code: pkg.code,
    name: pkg.name,
    description: pkg.description,
    maintenance: pkg.maintenance,
    looseBits: pkg.looseBits.slice(),
    masterGroups: pkg.masterGroups.map(group => ({
      label: group.label,
      items: group.items.slice()
    }))
  }));
}

function cloneTemplates(templates) {
  return {
    activeId: templates.activeId || null,
    total: Number.isFinite(templates.total) ? templates.total : 0
  };
}

function cloneSelections(selections) {
  return {
    checkedPackages: selections.checkedPackages.slice(),
    packages: selections.packages.map(pkg => ({
      code: pkg.code,
      name: pkg.name,
      maintenance: pkg.maintenance,
      looseBits: pkg.looseBits.slice(),
      masterGroups: pkg.masterGroups.map(group => ({
        label: group.label,
        items: group.items.slice()
      })),
      notes: pkg.notes.slice()
    })),
    totalChecked: selections.totalChecked
  };
}

function cloneSnapshotValue(value, key) {
  if (key === 'packages') {
    return clonePackages(value);
  }
  if (key === 'templates') {
    return cloneTemplates(value);
  }
  if (key === 'selections') {
    return cloneSelections(value);
  }
  return cloneSnapshot(value);
}
