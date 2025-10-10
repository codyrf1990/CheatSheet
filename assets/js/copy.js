export function registerCopyHandlers(root, isEditMode, onCopy) {
  root.querySelectorAll('code').forEach(code => {
    if (code.dataset.copyBound === 'true') return;
    code.dataset.copyBound = 'true';
    code.addEventListener('click', async (e) => {
      if (isEditMode()) return;

      const text = code.textContent.trim();
      try {
        await navigator.clipboard.writeText(text);
        code.classList.add('copied');
        setTimeout(() => code.classList.remove('copied'), 400);
        try {
          const pos = { x: e.clientX, y: e.clientY };
          if (typeof onCopy === 'function') onCopy(pos, text);
          window.dispatchEvent(new CustomEvent('copy-hud', { detail: { x: pos.x, y: pos.y, target: code, text } }));
        } catch (_) {
          // no-op if events are blocked
        }
      } catch (error) {
        console.error('Clipboard copy failed', error);
      }
    });
  });
}
