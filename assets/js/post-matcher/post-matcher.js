import { createPostMatcherUI } from './post-matcher-ui.js';

let initialized = false;

export function initializePostMatcher() {
  if (initialized) return;
  if (typeof document === 'undefined') return;
  const container = document.querySelector('[data-post-matcher-container]');
  if (!container) return;
  createPostMatcherUI(container);
  initialized = true;
}
