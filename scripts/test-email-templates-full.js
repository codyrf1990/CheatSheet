import { bootstrapDom, waitForTasks } from './jsdom-setup.js';
import 'fake-indexeddb/auto';

const { window, cleanup } = bootstrapDom();
global.window = window;
global.document = window.document;
global.MouseEvent = window.MouseEvent;
global.KeyboardEvent = window.KeyboardEvent;
global.confirm = () => true; // Auto-confirm dialogs

// Mock Quill
class MockQuill {
    constructor(container, options) {
        this.container = container;
        this.options = options;
        this.root = { innerHTML: '' };
        this.clipboard = {
            dangerouslyPasteHTML: (html) => { this.root.innerHTML = html; }
        };
    }
    on(event, handler) {
        this.changeHandler = handler;
    }
    getText() { return 'Mock Text'; }
    getSemanticHTML() { return '<p>Mock HTML</p>'; }
    setText(text) { }
    setContents(delta) { }
    import(name) {
        if (name === 'delta') {
            return class MockDelta {
                constructor() { this.ops = []; }
                insert(text) { this.ops.push({ insert: text }); return this; }
            };
        }
        return { whitelist: [] };
    }
    static register() { }
    static import(name) {
        if (name === 'delta') {
            return class MockDelta {
                constructor() { this.ops = []; }
                insert(text) { this.ops.push({ insert: text }); return this; }
            };
        }
        return { whitelist: [] };
    }
}
window.Quill = MockQuill;
global.Quill = MockQuill;

// Mock Clipboard
if (window.navigator) {
    Object.defineProperty(window.navigator, 'clipboard', {
        value: {
            writeText: async () => { },
            write: async () => { }
        },
        writable: true,
        configurable: true
    });
}

// Mock ClipboardItem
global.ClipboardItem = class MockClipboardItem {
    constructor(data) { this.data = data; }
};

async function runEmailTemplateTests() {
    console.log('📧 Starting Email Template Tests...\n');

    try {
        // Setup DOM
        document.body.innerHTML = `
      <div class="email-template-card">
        <div data-template-toast hidden></div>
        <input data-field="search" type="text">
        <div data-template-list></div>
        <div data-compose></div>
        <form data-editor-form>
          <input data-field="id" type="hidden">
          <input data-field="name" type="text">
          <input data-field="subject" type="text">
          <input data-field="body" type="hidden">
          <div id="email-body-editor"></div>
          <button type="submit">Save</button>
        </form>
        <button data-action="save-template">Save</button>
        <button data-action="new-template">New</button>
        <button data-action="launch-outlook" disabled>Launch</button>
        <div data-preview-warning></div>
      </div>
    `;

        const { initializeEmailTemplates } = await import('../assets/js/email-templates.js');
        initializeEmailTemplates();
        await waitForTasks();

        const list = document.querySelector('[data-template-list]');
        const nameInput = document.querySelector('[data-field="name"]');
        const subjectInput = document.querySelector('[data-field="subject"]');
        const saveBtn = document.querySelector('[data-action="save-template"]');
        const newBtn = document.querySelector('[data-action="new-template"]');

        const tests = [
            {
                name: 'Initial Load',
                run: () => {
                    return list.children.length > 0;
                }
            },
            {
                name: 'Select Template',
                run: () => {
                    const firstItem = list.firstElementChild;
                    firstItem.click();
                    return nameInput.value !== '';
                }
            },
            {
                name: 'Create New Template',
                run: async () => {
                    newBtn.click();
                    nameInput.value = 'Test Template';
                    subjectInput.value = 'Test Subject';
                    saveBtn.click();
                    await waitForTasks();
                    return list.textContent.includes('Test Template');
                }
            },
            {
                name: 'Search Filter',
                run: () => {
                    const searchInput = document.querySelector('[data-field="search"]');
                    searchInput.value = 'Test Template';
                    searchInput.dispatchEvent(new window.Event('input'));
                    return list.children.length === 1;
                }
            },
            {
                name: 'Delete Template',
                run: async () => {
                    // Reset search
                    const searchInput = document.querySelector('[data-field="search"]');
                    searchInput.value = '';
                    searchInput.dispatchEvent(new window.Event('input'));

                    // Find our test template
                    const items = Array.from(list.children);
                    const testItem = items.find(i => i.textContent.includes('Test Template'));

                    if (!testItem) return false;

                    // Mock delete button click
                    // We need to inject the delete button into the item since our mock DOM didn't have the full structure initially, 
                    // but the renderTemplateList function should have created it.
                    const deleteBtn = testItem.querySelector('[data-action="row-delete"]');
                    if (!deleteBtn) return false;

                    deleteBtn.click();
                    await waitForTasks();
                    return !list.textContent.includes('Test Template');
                }
            }
        ];

        let passed = 0;
        for (const test of tests) {
            try {
                const result = await test.run();
                if (result) {
                    console.log(`✅ ${test.name}`);
                    passed++;
                } else {
                    console.error(`❌ ${test.name} Failed`);
                }
            } catch (e) {
                console.error(`❌ ${test.name} Error:`, e);
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

runEmailTemplateTests();
