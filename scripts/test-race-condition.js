import { logger } from '../assets/js/debug-logger.js';
import { persistState } from '../assets/js/dom.js';
import { stateQueue } from '../assets/js/state-queue.js';

/**
 * Simulate rapid UI updates that previously caused race conditions.
 * Usage (in browser console): testRaceCondition()
 */
export async function testRaceCondition() {
  console.log('🧪 Race Condition Test\n');

  logger.enable('state-queue');
  logger.enable('dom');

  const iterations = 100;
  let completed = 0;
  let errors = 0;

  const root =
    document.querySelector('[data-root-element]') ||
    document.querySelector('.page-shell') ||
    document.body;

  if (!root) {
    console.warn('⚠️ No suitable root element found for persistence test.');
    return { passed: false, completed, errors, reason: 'missing-root' };
  }

  try {
    const tasks = Array.from({ length: iterations }, (_, index) =>
      new Promise(resolve => {
        setTimeout(() => {
          persistState(root)
            .then(() => {
              completed += 1;
              if ((index + 1) % 10 === 0) {
                console.log(`  ✓ Processed ${index + 1}/${iterations}`);
              }
            })
            .catch(error => {
              errors += 1;
              logger.error('race-test', 'Iteration failed', { index, error });
            })
            .finally(resolve);
        }, Math.random() * 50);
      })
    );

    await Promise.all(tasks);
    await stateQueue.whenIdle();

    const cheatsheetState = JSON.parse(localStorage.getItem('solidcam-cheatsheet-state') || '{}');
    const latestState = stateQueue.latestState || {};

    const integrity = {
      stateValid: typeof cheatsheetState === 'object' && cheatsheetState !== null,
      panelsValid: typeof cheatsheetState.panels === 'object' && cheatsheetState.panels !== null,
      packagesValid:
        typeof cheatsheetState.packages === 'object' && cheatsheetState.packages !== null,
      latestStateRecorded:
        typeof latestState === 'object' && latestState !== null,
      stateMatchesQueue:
        JSON.stringify(cheatsheetState.panels || {}) ===
          JSON.stringify(latestState.panels || {}) &&
        JSON.stringify(cheatsheetState.packages || {}) ===
          JSON.stringify(latestState.packages || {}),
      touchedPanels: Object.keys(cheatsheetState.panels || {}).length > 0,
      touchedPackages: Object.keys(cheatsheetState.packages || {}).length > 0
    };

    const passed =
      errors === 0 &&
      integrity.stateValid &&
      integrity.panelsValid &&
      integrity.packagesValid &&
      integrity.latestStateRecorded &&
      integrity.stateMatchesQueue;

    console.log('\n📊 Race Test Summary:', {
      iterations,
      completed,
      errors,
      integrity
    });

    if (passed) {
      console.log('✅ Race condition test passed\n');
    } else {
      console.error('❌ Race condition test failed\n');
    }

    return { passed, completed, errors, integrity };
  } catch (error) {
    logger.error('race-test', 'Unexpected failure', error);
    return { passed: false, completed, errors: errors + 1, error: error?.message };
  }
}

if (typeof window !== 'undefined') {
  window.testRaceCondition = testRaceCondition;
}
