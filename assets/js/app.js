import { renderApp } from './dom.js';
import { initializeCalculator } from './calculator.js';
import { initializeEmailTemplates } from './email-templates.js';
import { initializeChatbot } from './chatbot/chatbot.js';
import { initializePostMatcher } from './post-matcher/post-matcher.js';

document.addEventListener('DOMContentLoaded', () => {
  const mount = document.getElementById('app');
  renderApp(mount);
  initializeCalculator();
  initializeEmailTemplates();
  initializeChatbot();
  initializePostMatcher();

  if (typeof window !== 'undefined') {
    import('../../scripts/validation-harness.js').catch(() => {
      // Validation harness is optional; ignore failures (e.g., in production builds)
    });
  }
});
