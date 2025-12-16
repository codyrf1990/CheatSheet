import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const tests = [
    'test-comprehensive.js', // Runs validation harness
    'test-calculator.js',
    'test-packages.js'
];

async function runTest(script) {
    return new Promise((resolve, reject) => {
        console.log(`\n🏃 Running ${script}...`);
        const child = spawn('node', [path.join(__dirname, script)], {
            stdio: 'inherit',
            env: { ...process.env, FORCE_COLOR: '1' }
        });

        child.on('close', (code) => {
            if (code === 0) {
                console.log(`✅ ${script} Passed`);
                resolve();
            } else {
                console.error(`❌ ${script} Failed with code ${code}`);
                reject(new Error(`${script} failed`));
            }
        });
    });
}

async function runAll() {
    console.log('🚀 Starting Full Test Suite...');
    const start = Date.now();

    try {
        for (const test of tests) {
            await runTest(test);
        }
        console.log(`\n✨ All tests passed in ${Date.now() - start}ms`);
        process.exit(0);
    } catch (error) {
        console.error('\n💥 Test suite failed');
        process.exit(1);
    }
}

runAll();
