export function registerCopyHandlers(root, isEditMode) {
  root.querySelectorAll('code').forEach(code => {
    if (code.dataset.copyBound === 'true') return;
    code.dataset.copyBound = 'true';
    code.addEventListener('click', async () => {
      if (isEditMode()) return;

      const text = code.textContent.trim();
      try {
        await navigator.clipboard.writeText(text);
        code.classList.add('copied');
        setTimeout(() => code.classList.remove('copied'), 400);
      } catch (error) {
        console.error('Clipboard copy failed', error);
      }
    });
  });
}
