import { bootstrapDom, waitForTasks } from './jsdom-setup.js';

const { document, window, cleanup } = bootstrapDom();

try {
  const { initializeEmailTemplates } = await import('../assets/js/email-templates.js');

  initializeEmailTemplates();
  await waitForTasks();

  const list = document.querySelector('[data-template-list]');
  const firstItem = list?.firstElementChild;

  if (!list || !firstItem) {
    console.log('emailTemplates', JSON.stringify({ templates: 0 }));
    process.exit(1);
  }

  firstItem.dispatchEvent(new window.Event('click', { bubbles: true }));

  const payload = {
    templates: list.children.length,
    selectedName: document.querySelector('[data-field="name"]')?.value ?? '',
    selectedSubject: document.querySelector('[data-field="subject"]')?.value ?? '',
    bodyLength: document.querySelector('[data-field="body"]')?.value.length ?? 0,
  };

  console.log('emailTemplates', JSON.stringify(payload));
} finally {
  cleanup();
}
