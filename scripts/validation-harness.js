import { logger } from '../assets/js/debug-logger.js';
import { testRaceCondition } from './test-race-condition.js';

/**
 * Run both validation checks and print aggregated results.
 * Usage: runQuickValidation()
 */
export async function runQuickValidation() {
  console.clear();
  console.log('🚀 Starting automated validation suite...\n');

  logger.enable('state-queue');

  const startTime = Date.now();
  const results = {};

  try {
    console.log('1️⃣  Race condition validation');
    results.raceCondition = await testRaceCondition();
  } catch (error) {
    logger.error('validation', 'Validation harness failed', error);
    results.error = error?.message ?? 'unexpected-error';
  }

  const totalTime = Date.now() - startTime;
  const allPassed = Object.values(results)
    .filter(value => value && typeof value === 'object' && 'passed' in value)
    .every(value => value.passed);

  console.group(
    `%c${allPassed ? '✅' : '❌'} VALIDATION SUMMARY`,
    allPassed ? 'color:#10b981;font-weight:bold;font-size:14px' : 'color:#ef4444;font-weight:bold;font-size:14px'
  );

  console.log(allPassed ? '\n✅ ALL CHECKS PASSED\n' : '\n❌ SOME CHECKS FAILED\n');
  console.log(`⏱️  Total time: ${totalTime}ms\n`);

  const summaryTable = {
    'Race Condition': {
      status: results.raceCondition?.passed ? '✅ PASS' : '❌ FAIL',
      iterations: results.raceCondition?.completed ?? 'N/A',
      errors: results.raceCondition?.errors ?? 'N/A',
      integrity: results.raceCondition?.integrity ?? 'N/A'
    }
  };

  console.table(summaryTable);

  if (allPassed) {
    console.log('%c✅ READY TO DEPLOY\n', 'color:#10b981;font-weight:bold');
  } else {
    console.log('%c❌ ISSUES DETECTED', 'color:#ef4444;font-weight:bold');
    console.log('• Review logs above for details');
    console.log('• Use DEBUG.enable("state-queue") or DEBUG.enable("message-archive") for deeper insight\n');
  }

  console.groupEnd();

  return { allPassed, totalTime, results };
}

if (typeof window !== 'undefined') {
  window.runQuickValidation = runQuickValidation;
  console.log('%c✨ runQuickValidation() is available for validation', 'color:#8b5cf6;font-weight:bold');
}

