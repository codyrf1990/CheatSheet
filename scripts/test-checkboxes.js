import { bootstrapDom, waitForTasks } from './jsdom-setup.js';

const { document, window, cleanup } = bootstrapDom();

try {
  const { renderApp } = await import('../assets/js/dom.js');

  const mount = document.getElementById('app');
  renderApp(mount);
  await waitForTasks(120);

  const tableBody = document.querySelector('tbody');
  const firstMaster = tableBody?.querySelector('.master-checkbox');

  if (!firstMaster) {
    console.log('checkboxes', JSON.stringify({ success: false, reason: 'no master checkbox' }));
    process.exit(1);
  }

  const firstGroup = firstMaster.closest('.master-bit');
  const subCheckboxes = firstGroup.querySelectorAll('.sub-checkbox');

  firstMaster.checked = true;
  firstMaster.dispatchEvent(new window.Event('change', { bubbles: true }));
  await waitForTasks(120);

  const allChecked = Array.from(subCheckboxes).every(cb => cb.checked);

  const firstSub = subCheckboxes[0];
  firstSub.checked = false;
  firstSub.dispatchEvent(new window.Event('change', { bubbles: true }));
  await waitForTasks(120);

  const indeterminate = firstMaster.indeterminate;

  subCheckboxes.forEach(cb => {
    cb.checked = false;
    cb.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
  await waitForTasks(120);

  const allCleared = subCheckboxes.length
    ? Array.from(subCheckboxes).every(cb => cb.checked === false)
    : false;

  const resetButton = document.querySelector('#reset-checkboxes');
  resetButton?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await waitForTasks();

  const afterResetChecked = tableBody.querySelectorAll('.bit-checkbox:checked').length;
  const afterResetIndeterminate = tableBody.querySelectorAll('.master-checkbox').length
    ? Array.from(tableBody.querySelectorAll('.master-checkbox')).some(cb => cb.indeterminate)
    : false;

  await waitForTasks(120);
  const persisted = window.localStorage.getItem('solidcam-cheatsheet-state');
  let persistedChecked = null;
  if (persisted) {
    try {
      const parsed = JSON.parse(persisted);
      const packages = parsed?.packages ?? {};
      persistedChecked = Object.values(packages).flatMap(pkg => [
        ...(pkg.bits ?? []),
        ...(pkg.groups ?? []).flatMap(group => group.items ?? []),
      ]);
      persistedChecked = persistedChecked.filter(item => item.checked).length;
    } catch (error) {
      persistedChecked = 'parse-error';
    }
  }

  const result = {
    success: true,
    allChecked,
    indeterminate,
    allCleared,
    afterResetChecked,
    afterResetIndeterminate,
    persistedChecked,
  };

  console.log('checkboxes', JSON.stringify(result));
} finally {
  cleanup();
}
