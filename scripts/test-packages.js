import { bootstrapDom, waitForTasks } from './jsdom-setup.js';

const { document, window, cleanup } = bootstrapDom();

try {
  const { renderApp } = await import('../assets/js/dom.js');
  const { initializeCalculator } = await import('../assets/js/calculator.js');
  const { initializeEmailTemplates } = await import('../assets/js/email-templates.js');

  const mount = document.getElementById('app');
  renderApp(mount);
  initializeCalculator();
  initializeEmailTemplates();
  await waitForTasks(120);

  const root = document.querySelector('.page-shell');
  const rows = root.querySelectorAll('tbody tr');
  const firstRow = rows[0];
  const secondRow = rows[1];

  if (!firstRow || !secondRow) {
    console.log('packageOps', JSON.stringify({ success: false, reason: 'insufficient rows' }));
    process.exit(1);
  }

  const addToggle = root.querySelector('[data-action="package-toggle-add-mode"]');
  const removeToggle = root.querySelector('[data-action="package-toggle-remove-mode"]');

  const originalPrompt = globalThis.prompt;
  globalThis.prompt = () => 'Automation Bit';

  const firstBitsList = firstRow.querySelector('ul.bits');
  const secondBitsList = secondRow.querySelector('ul.bits');
  const initialFirstCount = firstBitsList?.children.length ?? 0;

  addToggle.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

  const addButton = firstRow.querySelector('[data-action="package-row-add"]');
  addButton?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

  await waitForTasks();

  const afterAddCount = firstBitsList?.children.length ?? 0;
  const newBit = firstBitsList?.lastElementChild;

  let moved = false;
  if (newBit && secondBitsList) {
    const dropEvent = new window.CustomEvent('sortable:drop', {
      bubbles: true,
      detail: {
        item: newBit,
        from: firstBitsList,
        to: secondBitsList,
      },
    });
    root.dispatchEvent(dropEvent);
    await waitForTasks(120);
    moved = Array.from(secondBitsList.querySelectorAll('li')).some(li =>
      li.textContent.includes('Automation Bit')
    );
  }

  removeToggle.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

  const automationLi = Array.from(secondBitsList?.querySelectorAll('li') ?? []).find(li =>
    li.textContent.includes('Automation Bit')
  );
  automationLi
    ?.querySelector('[data-action="remove-loose-bit"]')
    ?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

  await waitForTasks(120);

  const afterRemoveCount = secondBitsList?.children.length ?? 0;
  const removed = !Array.from(secondBitsList?.querySelectorAll('li') ?? []).some(li =>
    li.textContent.includes('Automation Bit')
  );

  if (originalPrompt) {
    globalThis.prompt = originalPrompt;
  } else {
    delete globalThis.prompt;
  }

  await waitForTasks(120);
  const persisted = window.localStorage.getItem('solidcam-cheatsheet-state');
  let storedLooseCount = null;
  let storedContainsAutomation = null;
  if (persisted) {
    try {
      const parsed = JSON.parse(persisted);
      const pkgState = parsed?.packages ?? {};
      const second = pkgState?.[secondRow.dataset.package] ?? {};
      if (Array.isArray(second.bits)) {
        storedLooseCount = second.bits.length;
        storedContainsAutomation = second.bits.some(bit =>
          String(bit.text).includes('Automation Bit')
        );
      }
    } catch (error) {
      storedLooseCount = 'parse-error';
    }
  }

  const summary = {
    success: true,
    initialFirstCount,
    afterAddCount,
    moved,
    afterRemoveCount,
    removed,
    storedLooseCount,
    storedContainsAutomation,
  };

  console.log('packageOps', JSON.stringify(summary));
} finally {
  cleanup();
}
