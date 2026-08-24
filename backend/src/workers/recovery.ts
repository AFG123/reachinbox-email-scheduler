import { prisma } from '../prisma';
import { scheduleEmailJob } from '../queues/emailQueue';
import { logger } from '../utils/logger';

/**
 * Scans the database for emails stuck in the PROCESSING state for over 5 minutes.
 * Resets them back to PENDING and re-enqueues them in BullMQ to handle worker crash recovery.
 */
export async function recoverStaleEmails(): Promise<void> {
  const STALE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  const fiveMinutesAgo = new Date(Date.now() - STALE_TIMEOUT_MS);

  try {
    const staleEmails = await prisma.email.findMany({
      where: {
        status: 'PROCESSING',
        updatedAt: {
          lt: fiveMinutesAgo,
        },
      },
    });

    if (staleEmails.length === 0) {
      return;
    }

    logger.warn(`[Recovery] Found ${staleEmails.length} stale PROCESSING email(s) that exceeded the 5-minute timeout. Resetting to PENDING...`);

    for (const email of staleEmails) {
      // 1. Reset state to PENDING in database
      await prisma.email.update({
        where: { id: email.id },
        data: {
          status: 'PENDING',
          lastError: 'Resetting stale PROCESSING state (stale worker job recovery)',
        },
      });

      // 2. Re-enqueue immediate job in BullMQ
      await scheduleEmailJob(email.id, 0);
      logger.info(`[Recovery] Reset and successfully re-enqueued job for email ${email.id}`);
    }
  } catch (error: any) {
    logger.error('[Recovery] Failed to run stale email recovery:', { error: error.message, stack: error.stack });
  }
}
