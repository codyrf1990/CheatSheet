import { logger } from '../assets/js/debug-logger.js';
import { persistState } from '../assets/js/dom.js';

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
          try {
            persistState(root);
            completed += 1;
            if ((index + 1) % 10 === 0) {
              console.log(`  ✓ Processed ${index + 1}/${iterations}`);
            }
          } catch (error) {
            errors += 1;
            logger.error('race-test', 'Iteration failed', { index, error });
          }
          resolve();
        }, Math.random() * 50);
      })
    );

    await Promise.all(tasks);

    const settings = JSON.parse(localStorage.getItem('solidcam.chatbot.settings') || '{}');
    const conversations = JSON.parse(localStorage.getItem('solidcam.chatbot.conversations') || '[]');

    const integrity = {
      settingsValid: typeof settings === 'object' && settings !== null,
      apiKeysObject: typeof settings.apiKeys === 'object',
      conversationsValid: Array.isArray(conversations),
      conversationCount: Array.isArray(conversations) ? conversations.length : 0
    };

    const passed = errors === 0 && integrity.settingsValid && integrity.apiKeysObject && integrity.conversationsValid;

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

