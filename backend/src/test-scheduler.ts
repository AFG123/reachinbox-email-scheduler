import { prisma } from './prisma';
import { scheduleEmailJob } from './queues/emailQueue';
import './workers/emailWorker'; // Import to spin up the worker in this process

async function runTest() {
  console.log("\n--- Starting End-to-End Scheduler Test ---");

  try {
    // 1. Create or retrieve a test user in the database
    const user = await prisma.user.upsert({
      where: { googleId: 'test-google-id' },
      update: {},
      create: {
        googleId: 'test-google-id',
        name: 'Scheduler Test User',
        email: 'tester@example.com',
        avatarUrl: 'https://example.com/avatar.png',
      },
    });
    console.log(`[Test] User verified in database (ID: ${user.id})`);

    // 2. Create or retrieve a test sender
    const sender = await prisma.sender.upsert({
      where: {
        userId_email: {
          userId: user.id,
          email: 'hiram45@ethereal.email',
        },
      },
      update: {},
      create: {
        userId: user.id,
        email: 'hiram45@ethereal.email',
        displayName: 'ReachInbox Test Sender',
      },
    });
    console.log(`[Test] Sender verified in database (ID: ${sender.id})`);

    // 3. Create a test email in PostgreSQL (status defaults to PENDING)
    const email = await prisma.email.create({
      data: {
        senderId: sender.id,
        recipient: 'recipient@example.com',
        subject: 'Scheduled BullMQ Verification',
        body: 'Hello!\n\nThis email was scheduled in BullMQ, stored in PostgreSQL, and processed successfully by our background worker.',
        scheduledAt: new Date(Date.now() + 5000), // Scheduled 5 seconds in the future
        status: 'PENDING',
      },
    });
    console.log(`[Test] Email record created in PostgreSQL (ID: ${email.id}, status: PENDING)`);

    // 4. Schedule the job in BullMQ with a 5-second delay
    const delayMs = 5000;
    console.log(`[Test] Scheduling delayed job in BullMQ (delay: ${delayMs / 1000} seconds)...`);
    const job = await scheduleEmailJob(email.id, delayMs);
    console.log(`[Test] Job registered in Redis! (BullMQ Job ID: ${job.id})`);

    console.log("[Test] Waiting for the worker to trigger... (Do not close this script yet)\n");
  } catch (error) {
    console.error("[Test] Initialization failed:", error);
  }
}

runTest();
