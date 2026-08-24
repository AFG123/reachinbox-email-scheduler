import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { redisConnection } from '../config/redis';
import { prisma } from '../prisma';
import { sendEmail } from '../services/mailer';
import { scheduleEmailJob } from '../queues/emailQueue';
import { logger } from '../utils/logger';

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

      // 2. Idempotency & Stuck State Crash Recovery Check
      if (email.status === 'SENT') {
        logger.info(`[Worker] Email ${emailId} is already SENT. Skipping to prevent duplicates.`);
        return;
      }

      if (email.status === 'PROCESSING') {
        // Consider it stale if it was started more than 2 minutes ago (SMTP timeout is 30s)
        const STALE_THRESHOLD_MS = 2 * 60 * 1000;
        const isStale = email.processingStartedAt && (Date.now() - email.processingStartedAt.getTime() > STALE_THRESHOLD_MS);

        if (isStale) {
          logger.warn(`[Worker] Email ${emailId} was stuck in PROCESSING state (started at ${email.processingStartedAt?.toISOString()}). Recovering stale state...`);
        } else {
          logger.info(`[Worker] Email ${emailId} is currently being processed by another active worker. Skipping to prevent duplicates.`);
          return;
        }
      }

      await prisma.email.update({
        where: { id: emailId },
        data: {
          status: 'PROCESSING',
          processingStartedAt: new Date(),
        },
      });

      const { senderId, campaign } = email;
      const hourlyLimit = campaign?.hourlyLimit ?? parseInt(process.env.DEFAULT_HOURLY_LIMIT || '100');
      const delayMs = campaign?.delayMs ?? parseInt(process.env.DEFAULT_DELAY_MS || '2000');

      const now = new Date();
      // Generate key based on the UTC hour window: e.g., rate_limit:sender:UUID:2026-08-23-08
      const currentHourStr = `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}-${now.getUTCHours()}`;
      const rateLimitKey = `rate_limit:sender:${senderId}:${currentHourStr}`;

      const currentCount = await redisClient.incr(rateLimitKey);
      if (currentCount === 1) {
        await redisClient.expire(rateLimitKey, 7200); // 2 hours expiration
      }

      if (currentCount > hourlyLimit) {
        await redisClient.decr(rateLimitKey);

        const nextHour = new Date(now);
        nextHour.setUTCHours(now.getUTCHours() + 1, 0, 0, 0);
        const delayUntilNextHourMs = nextHour.getTime() - now.getTime();

        await scheduleEmailJob(emailId, delayUntilNextHourMs);

        await prisma.email.update({
          where: { id: emailId },
          data: {
            status: 'PENDING',
            scheduledAt: nextHour,
            processingStartedAt: null,
          },
        });

        logger.warn(
          `[Worker] Rate limit reached for Sender ${senderId} (${currentCount}/${hourlyLimit}). Rescheduled email ${emailId} to next hour (${delayUntilNextHourMs / 1000}s delay).`
        );
        return;
      }

      const lastSentKey = `last_sent:sender:${senderId}`;
      const lastSentTimeRaw = await redisClient.get(lastSentKey);
      const lastSentTime = lastSentTimeRaw ? parseInt(lastSentTimeRaw) : 0;

      const targetSendTime = Math.max(Date.now(), lastSentTime + delayMs);
      
      // Update the last sent timestamp in Redis immediately to block parallel workers
      await redisClient.set(lastSentKey, targetSendTime.toString());

      const sleepDuration = targetSendTime - Date.now();
      if (sleepDuration > 0) {
        logger.info(`[Worker] Throttling sender ${senderId}. Sleeping for ${sleepDuration}ms...`);
        await sleep(sleepDuration);
      }

      const messageId = await sendEmail({
        fromName: email.sender.displayName,
        fromEmail: email.sender.email,
        to: email.recipient,
        subject: email.subject,
        body: email.body,
      });

      await prisma.email.update({
        where: { id: emailId },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          processingStartedAt: null,
          bullmqJobId: job.id,
          attempts: job.attemptsMade + 1,
        },
      });

      logger.info(`[Worker] Successfully sent email ${emailId}. MessageID: ${messageId}`);

    } catch (error: any) {
      logger.error(`[Worker] Error processing email ${emailId}`, { error: error.message, stack: error.stack });

      await prisma.email.update({
        where: { id: emailId },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          processingStartedAt: null,
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
