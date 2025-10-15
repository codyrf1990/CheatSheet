import { bootstrapDom, waitForTasks } from './jsdom-setup.js';

const { document, window, cleanup } = bootstrapDom();

try {
  const { initializeEmailTemplates } = await import('../assets/js/email-templates.js');

  initializeEmailTemplates();
  await waitForTasks();

  const addBtn = document.querySelector('[data-action="new-template"]');
  addBtn?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

  const nameInput = document.querySelector('[data-field="name"]');
  const subjectInput = document.querySelector('[data-field="subject"]');
  const bodyInput = document.querySelector('[data-field="body"]');

  if (!nameInput || !subjectInput || !bodyInput) {
    console.log('emailTemplateAdd', JSON.stringify({ success: false, reason: 'missing fields' }));
    process.exit(1);
  }

  nameInput.value = 'Test Template';
  subjectInput.value = 'Testing';
  bodyInput.value = 'Body content';

  const inputEvent = new window.Event('input', { bubbles: true });
  nameInput.dispatchEvent(inputEvent);
  subjectInput.dispatchEvent(inputEvent);
  bodyInput.dispatchEvent(inputEvent);

  document.querySelector('[data-action="save-template"]')?.dispatchEvent(
    new window.MouseEvent('click', { bubbles: true })
  );

  await waitForTasks();

  const list = document.querySelector('[data-template-list]');
  const summary = {
    templates: list?.children.length ?? 0,
    lastName:
      list?.lastElementChild?.querySelector('.email-template-item__title')?.textContent.trim() ??
      '',
  };

  console.log('emailTemplateAdd', JSON.stringify(summary));
} finally {
  cleanup();
}
