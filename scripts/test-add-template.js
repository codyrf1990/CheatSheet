await import('./test-email-templates.js');
await import('./test-email-add.js');
await import('./test-packages.js');
await import('./test-checkboxes.js');
await import('./test-chatbot-managers.js');

console.log('testSuite', JSON.stringify({ status: 'completed' }));
