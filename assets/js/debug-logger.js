/**
 * Lightweight debug logger with optional module filtering.
 *
 * Usage:
 *   logger.log('module', 'message', data);
 *   logger.warn('module', 'warning message');
 *   logger.error('module', 'error message', errorObject);
 *   logger.startTimer('label'); logger.endTimer('module', 'label');
 *
 * Console helpers:
 *   DEBUG.enable('module');
 *   DEBUG.disable('module');
 *   DEBUG.clear();
 */
class DebugLogger {
  constructor() {
    this.enabledModules = new Set();
    this.timers = new Map();
    this.showAll = true;
  }

  log(module, message, data) {
    if (!this._shouldLog(module)) return;
    const time = this._timestamp();
    console.log(
      `%c[${time}]%c[${module}]%c ${message}`,
      'color:#999;',
      'color:#0ea5e9;font-weight:bold',
      'color:inherit',
      data ?? ''
    );
  }

  warn(module, message, data) {
    const time = this._timestamp();
    console.warn(
      `%c[${time}]%c[${module}]%c ${message}`,
      'color:#999;',
      'color:#f59e0b;font-weight:bold',
      'color:inherit',
      data ?? ''
    );
  }

  error(module, message, error) {
    const time = this._timestamp();
    console.error(
      `%c[${time}]%c[${module}]%c ${message}`,
      'color:#999;',
      'color:#ef4444;font-weight:bold',
      'color:inherit',
      error ?? ''
    );
  }

  startTimer(label) {
    this.timers.set(label, Date.now());
  }

  endTimer(module, label) {
    const start = this.timers.get(label);
    if (typeof start !== 'number') return null;
    const duration = Date.now() - start;
    this.timers.delete(label);
    if (!this._shouldLog(module)) return duration;
    const status = duration > 100 ? '⚠️' : '✓';
    console.log(
      `%c[${module}]%c ${label}: ${duration}ms ${status}`,
      'color:#06b6d4;font-weight:bold',
      'color:inherit'
    );
    return duration;
  }

  enable(module) {
    this.enabledModules.add(module);
    this.showAll = false;
    console.log(`✅ Debug enabled for "${module}"`);
  }

  disable(module) {
    this.enabledModules.delete(module);
    console.log(`❌ Debug disabled for "${module}"`);
  }

  all() {
    this.enabledModules.clear();
    this.showAll = true;
    console.log('🔓 Debug output enabled for all modules');
  }

  clear() {
    this.enabledModules.clear();
    this.showAll = true;
    console.log('🧹 Debug filters cleared (showing all modules)');
  }

  _shouldLog(module) {
    if (this.showAll) return true;
    return this.enabledModules.has(module);
  }

  _timestamp() {
    return new Date().toLocaleTimeString();
  }
}

export const logger = new DebugLogger();

if (typeof window !== 'undefined') {
  window.DEBUG = {
    enable: module => logger.enable(module),
    all: () => logger.all(),
    disable: module => logger.disable(module),
    clear: () => logger.clear()
  };
}
