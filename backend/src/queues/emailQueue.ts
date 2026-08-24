import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';

export const emailQueue = new Queue('email-queue', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3, // Retry up to 3 times if sending fails
    backoff: {
      type: 'exponential',
      delay: 5000, // Wait 5s, then 10s, then 20s...
    },
    removeOnComplete: true, // Delete completed jobs from Redis to save memory
    removeOnFail: false, // Keep failed jobs in Redis for debugging/history
  },
});

/**
 * Schedules an email to be sent at a delayed time
 * @param emailId The database ID of the email to send
 * @param delayMs The delay in milliseconds from now
 * @returns The created BullMQ job instance
 */
export async function scheduleEmailJob(emailId: string, delayMs: number) {
  const job = await emailQueue.add(
    'send-email',
    { emailId },
    { delay: delayMs }
  );
  return job;
}
