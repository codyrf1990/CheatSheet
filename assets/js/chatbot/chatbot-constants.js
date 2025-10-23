export const STATUS_READY = 'ready';
export const STATUS_THINKING = 'thinking';
export const STATUS_ERROR = 'error';

export const SIDEBAR_NAMES = ['conversations', 'settings'];

export const MODE_PACKAGE = 'package';
export const MODE_GENERAL = 'general';

export const MODE_DEFS = {
  [MODE_PACKAGE]: {
    id: MODE_PACKAGE,
    label: 'Package Assistant',
    title: 'SolidCAM Package Architect',
    subtitle: 'Guide reps through packages, maintenance, and dongles',
    placeholder: 'Ask about SolidCAM packages, maintenance SKUs, or dongles...'
  },
  [MODE_GENERAL]: {
    id: MODE_GENERAL,
    label: 'General Assistant',
    title: 'SolidCAM Enterprise Assistant',
    subtitle: 'Support the team with research, communication, and policy',
    placeholder: 'Ask the SolidCAM team assistant anything internal...'
  }
};

export const MODE_LIST = [MODE_PACKAGE, MODE_GENERAL];

export const MAX_EFFECTIVE_MESSAGES = 1000;
export const MIN_REQUIRED_MESSAGE_CAPACITY = 2;

/**
 * Feature flags remain in the codebase for quick rollback,
 * but Phase 3 shipped with all new managers enabled. The object
 * is frozen to prevent runtime mutation – update documentation
 * before modifying these defaults.
 */
export const FEATURE_TOGGLES = Object.freeze({
  USE_MODE_MANAGER: true,
  USE_CONVERSATION_MANAGER: true,
  USE_STATE_MANAGER: true,
  USE_EVENT_HANDLERS: true
});

export function sanitizeMode(mode) {
  return mode === MODE_GENERAL ? MODE_GENERAL : MODE_PACKAGE;
}
