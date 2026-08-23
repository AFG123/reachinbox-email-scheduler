import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { redisConnection } from '../config/redis';
import { prisma } from '../prisma';
import { sendEmail } from '../services/mailer';
import { scheduleEmailJob } from '../queues/emailQueue';
import { logger } from '../utils/logger';

// Create a standalone Redis client for our custom rate-limit counters
const redisClient = new Redis(redisConnection as any);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * BullMQ Worker that processes jobs from 'email-queue'
 */
export const emailWorker = new Worker(
  'email-queue',
  async (job: Job<{ emailId: string }>) => {
    const { emailId } = job.data;

    try {
      // 1. Fetch the email along with its sender and campaign config from DB
      const email = await prisma.email.findUnique({
        where: { id: emailId },
        include: {
          sender: true,
          campaign: true,
        },
      });

      if (!email) {
        logger.warn(`[Worker] Email ${emailId} not found in database. Skipping.`);
        return;
      }

      // 2. Idempotency Check: Don't re-send if already processed or processing
      if (email.status === 'SENT' || email.status === 'PROCESSING') {
        logger.info(`[Worker] Email ${emailId} is already ${email.status}. Skipping to prevent duplicates.`);
        return;
      }

      // Mark email as PROCESSING in PostgreSQL
      await prisma.email.update({
        where: { id: emailId },
        data: { status: 'PROCESSING' },
      });

      const { senderId, campaign } = email;
      const hourlyLimit = campaign?.hourlyLimit ?? parseInt(process.env.DEFAULT_HOURLY_LIMIT || '100');
      const delayMs = campaign?.delayMs ?? parseInt(process.env.DEFAULT_DELAY_MS || '2000');

      // 3. Hourly Rate Limiting Check
      const now = new Date();
      // Generate key based on the UTC hour window: e.g., rate_limit:sender:UUID:2026-08-23-08
      const currentHourStr = `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}-${now.getUTCHours()}`;
      const rateLimitKey = `rate_limit:sender:${senderId}:${currentHourStr}`;

      const currentCount = await redisClient.incr(rateLimitKey);
      if (currentCount === 1) {
        await redisClient.expire(rateLimitKey, 7200); // 2 hours expiration
      }

      if (currentCount > hourlyLimit) {
        // Exceeded hourly limit! Revert the counter increment
        await redisClient.decr(rateLimitKey);

        // Compute milliseconds remaining until the start of the next hour
        const nextHour = new Date(now);
        nextHour.setUTCHours(now.getUTCHours() + 1, 0, 0, 0);
        const delayUntilNextHourMs = nextHour.getTime() - now.getTime();

        // Reschedule the job in BullMQ to run in the next hour
        await scheduleEmailJob(emailId, delayUntilNextHourMs);

        // Move status back to PENDING and update the scheduled time in DB
        await prisma.email.update({
          where: { id: emailId },
          data: {
            status: 'PENDING',
            scheduledAt: nextHour,
          },
        });

        logger.warn(
          `[Worker] Rate limit reached for Sender ${senderId} (${currentCount}/${hourlyLimit}). Rescheduled email ${emailId} to next hour (${delayUntilNextHourMs / 1000}s delay).`
        );
        return;
      }

      // 4. Minimum Throttling Delay Check (spacing out sends per sender)
      const lastSentKey = `last_sent:sender:${senderId}`;
      const lastSentTimeRaw = await redisClient.get(lastSentKey);
      const lastSentTime = lastSentTimeRaw ? parseInt(lastSentTimeRaw) : 0;

      // Calculate when this email is allowed to send relative to the last one
      const targetSendTime = Math.max(Date.now(), lastSentTime + delayMs);
      
      // Update the last sent timestamp in Redis immediately to block parallel workers
      await redisClient.set(lastSentKey, targetSendTime.toString());

      // If the target time is in the future, sleep until then
      const sleepDuration = targetSendTime - Date.now();
      if (sleepDuration > 0) {
        logger.info(`[Worker] Throttling sender ${senderId}. Sleeping for ${sleepDuration}ms...`);
        await sleep(sleepDuration);
      }

      // 5. Send the Email via Ethereal SMTP
      const messageId = await sendEmail({
        fromName: email.sender.displayName,
        fromEmail: email.sender.email,
        to: email.recipient,
        subject: email.subject,
        body: email.body,
      });

      // 6. Success: Update PostgreSQL status
      await prisma.email.update({
        where: { id: emailId },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          bullmqJobId: job.id,
          attempts: job.attemptsMade + 1,
        },
      });

      logger.info(`[Worker] Successfully sent email ${emailId}. MessageID: ${messageId}`);

    } catch (error: any) {
      logger.error(`[Worker] Error processing email ${emailId}`, { error: error.message, stack: error.stack });

      // Update failure log in PostgreSQL
      await prisma.email.update({
        where: { id: emailId },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          attempts: job.attemptsMade + 1,
          lastError: error.message || 'Unknown error during send',
        },
      });

      // Rethrow to let BullMQ know the job failed and trigger retry attempts
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 5, // Process up to 5 email jobs in parallel (configurable)
  }
);

emailWorker.on('active', (job) => {
  logger.info(`[Worker] Job ${job.id} started processing.`);
});

emailWorker.on('completed', (job) => {
  logger.info(`[Worker] Job ${job.id} completed successfully.`);
});

emailWorker.on('failed', (job, err) => {
  logger.error(`[Worker] Job ${job?.id} failed: ${err.message}`, { error: err.message });
});
