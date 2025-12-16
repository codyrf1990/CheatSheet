import { renderApp } from './dom.js';
import { initializeCalculator } from './calculator.js';

document.addEventListener('DOMContentLoaded', () => {
  const mount = document.getElementById('app');
  renderApp(mount);
  initializeCalculator();
});
