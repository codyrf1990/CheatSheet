import { bootstrapDom, waitForTasks } from './jsdom-setup.js';
import 'fake-indexeddb/auto';

const { window, cleanup } = bootstrapDom();
global.window = window;
global.document = window.document;
global.MouseEvent = window.MouseEvent;

// Mock clipboard safely
if (window.navigator) {
    Object.defineProperty(window.navigator, 'clipboard', {
        value: {
            writeText: async () => { },
        },
        writable: true,
        configurable: true
    });
}

async function runCalculatorTests() {
    console.log('🧮 Starting Calculator Tests...\n');

    try {
        // Setup DOM
        document.body.innerHTML = `
      <div class="calculator">
        <div class="calculator-display"></div>
        <div class="calculator-keys">
          <button data-action="clear">AC</button>
          <button data-action="delete">DEL</button>
          <button data-action="sign">+/-</button>
          <button data-action="percent">%</button>
          <button data-operation="/">÷</button>
          <button data-number="7">7</button>
          <button data-number="8">8</button>
          <button data-number="9">9</button>
          <button data-operation="*">×</button>
          <button data-number="4">4</button>
          <button data-number="5">5</button>
          <button data-number="6">6</button>
          <button data-operation="-">-</button>
          <button data-number="1">1</button>
          <button data-number="2">2</button>
          <button data-number="3">3</button>
          <button data-operation="+">+</button>
          <button data-number="0">0</button>
          <button data-action="decimal">.</button>
          <button data-action="equals">=</button>
          <button data-percent="10">10%</button>
        </div>
      </div>
    `;

        const { initializeCalculator } = await import('../assets/js/calculator.js');
        initializeCalculator();

        const display = document.querySelector('.calculator-display');
        const click = (selector) => {
            const btn = document.querySelector(selector);
            if (btn) btn.click();
        };

        const tests = [
            {
                name: 'Basic Addition',
                run: () => {
                    click('[data-action="clear"]');
                    click('[data-number="2"]');
                    click('[data-operation="+"]');
                    click('[data-number="3"]');
                    click('[data-action="equals"]');
                    return display.textContent === '$5.00';
                }
            },
            {
                name: 'Decimal Input',
                run: () => {
                    click('[data-action="clear"]');
                    click('[data-number="1"]');
                    click('[data-action="decimal"]');
                    click('[data-number="5"]');
                    return display.textContent === '$1.50';
                }
            },
            {
                name: 'Chain Operations',
                run: () => {
                    click('[data-action="clear"]');
                    click('[data-number="5"]');
                    click('[data-operation="*"]');
                    click('[data-number="2"]');
                    click('[data-operation="-"]');
                    click('[data-number="3"]');
                    click('[data-action="equals"]');
                    return display.textContent === '$7.00';
                }
            },
            {
                name: 'Division by Zero',
                run: () => {
                    click('[data-action="clear"]');
                    click('[data-number="5"]');
                    click('[data-operation="/"]');
                    click('[data-number="0"]');
                    click('[data-action="equals"]');
                    return display.textContent === 'Error';
                }
            },
            {
                name: 'Percent Button',
                run: () => {
                    click('[data-action="clear"]');
                    click('[data-number="5"]');
                    click('[data-number="0"]');
                    click('[data-action="percent"]');
                    return display.textContent === '$0.50';
                }
            },
            {
                name: 'Quick Percent (10%)',
                run: () => {
                    click('[data-action="clear"]');
                    click('[data-number="1"]');
                    click('[data-number="0"]');
                    click('[data-number="0"]');
                    click('[data-percent="10"]');
                    return display.textContent === '$10.00';
                }
            },
            {
                name: 'Toggle Sign',
                run: () => {
                    click('[data-action="clear"]');
                    click('[data-number="5"]');
                    click('[data-action="sign"]');
                    return display.textContent === '-$5.00';
                }
            },
            {
                name: 'Delete Digit',
                run: () => {
                    click('[data-action="clear"]');
                    click('[data-number="1"]');
                    click('[data-number="2"]');
                    click('[data-action="delete"]');
                    return display.textContent === '$1.00';
                }
            }
        ];

        let passed = 0;
        for (const test of tests) {
            if (test.run()) {
                console.log(`✅ ${test.name}`);
                passed++;
            } else {
                console.error(`❌ ${test.name} Failed. Display: ${display.textContent}`);
            }
        }

        console.log(`\nSummary: ${passed}/${tests.length} Passed`);

        if (passed === tests.length) {
            process.exit(0);
        } else {
            process.exit(1);
        }

    } catch (error) {
        console.error('Test Error:', error);
        process.exit(1);
    } finally {
        cleanup();
    }
}

runCalculatorTests();
