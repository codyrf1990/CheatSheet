import { logger } from '../assets/js/debug-logger.js';
import { messageArchive } from '../assets/js/message-archive.js';

/**
 * Validate message archiving thresholds and retrieval.
 * Usage (in browser console): testMessageArchive()
 */
export async function testMessageArchive() {
  console.log('🧪 Message Archive Test\n');

  logger.enable('message-archive');

  const conversationId = 'validation-test';
  const messageCount = 600;
  let activeMessages = [];

  try {
    const db = await messageArchive.init();
    if (db) {
      const tx = db.transaction('message-archive', 'readwrite');
      tx.objectStore('message-archive').clear();
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    }

    const messages = Array.from({ length: messageCount }, (_, index) => ({
      id: `msg-${index}`,
      content: `Validation message ${index}`,
      role: index % 2 === 0 ? 'user' : 'assistant',
      createdAt: Date.now() + index * 1000,
      references: []
    }));

    for (let i = 0; i < messages.length; i++) {
      activeMessages = await messageArchive.addMessage(conversationId, messages[i], activeMessages);
      if ((i + 1) % 100 === 0) {
        console.log(`  ✓ Processed ${i + 1}/${messageCount}`);
      }
    }

    const archivedMessages = await messageArchive.getArchivedMessages(conversationId);
    const expectedArchived = Math.max(0, messageCount - activeMessages.length);
    const archivingWorked =
      activeMessages.length <= 500 && archivedMessages.length >= expectedArchived;

    const summary = {
      totalProcessed: messageCount,
      activeInMemory: activeMessages.length,
      archivedCount: archivedMessages.length,
      expectedArchived,
      archivingWorked
    };

    console.log('\n📊 Archive Test Summary:', summary);

    if (archivingWorked) {
      console.log('✅ Archive behaves as expected\n');
    } else {
      console.error('❌ Archive did not trim active messages\n');
    }

    return { passed: archivingWorked, ...summary };
  } catch (error) {
    logger.error('archive-test', 'Unexpected failure', error);
    return { passed: false, error: error?.message };
  }
}

if (typeof window !== 'undefined') {
  window.testMessageArchive = testMessageArchive;
}
