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
    const description = row.querySelector('.package-description')?.textContent?.trim() || '';
    const looseBits = Array.from(row.querySelectorAll('.loose-bit')).map(bit => bit.textContent?.trim()).filter(Boolean);
    const masterGroups = Array.from(row.querySelectorAll('[data-master-group]')).map(group => {
      const label = group.getAttribute('data-master-group');
      const items = Array.from(group.querySelectorAll('.bit-label')).map(bit => bit.textContent?.trim()).filter(Boolean);
      return { label, items };
    });
    return {
      code,
      description,
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
  if (typeof document === 'undefined') return { checkedPackages: [] };
  const checked = Array.from(document.querySelectorAll('.bit-checkbox:checked'));
  return {
    checkedPackages: checked
      .map(cb => cb.closest('tr[data-package]')?.getAttribute('data-package'))
      .filter(Boolean)
  };
}
