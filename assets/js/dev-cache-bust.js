const devHosts = new Set(['localhost', '127.0.0.1', '']);
const isDevEnvironment =
  devHosts.has(window.location.hostname) ||
  window.location.hostname.endsWith('.local') ||
  window.location.protocol === 'file:';

if (isDevEnvironment) {
  document.addEventListener('DOMContentLoaded', () => {
    const timestamp = Date.now() + Math.random();
    const css = document.querySelector('link[href*="main.css"]');
    const js = document.querySelector('script[src*="app.js"]');

    if (css) css.href += `&t=${timestamp}`;
    if (js) js.src += `&t=${timestamp}`;

    const navEntries = window.performance.getEntriesByType?.('navigation') || [];
    if (navEntries[0]?.type === 'back_forward') {
      window.location.reload();
    }
  });
}
