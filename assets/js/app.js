import { renderApp } from './dom.js';
import { initializeCalculator } from './calculator.js';
import { initializeEmailTemplates } from './email-templates.js';
import { initializeChatbot } from './chatbot/chatbot.js';

document.addEventListener('DOMContentLoaded', () => {
  const mount = document.getElementById('app');
  renderApp(mount);
  initializeCalculator();
  initializeEmailTemplates();
  initializeChatbot();
});
