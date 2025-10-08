import { renderApp } from './dom.js';

document.addEventListener('DOMContentLoaded', () => {
  const mount = document.getElementById('app');
  renderApp(mount);
});

