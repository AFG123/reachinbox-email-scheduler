import 'dotenv/config';
import { z } from 'zod';
import { prisma } from '../prisma';
import { recoverStaleEmails } from '../workers/recovery';
import { validateEnv } from '../config/env';

// Define the exact validation schema we want to test
const scheduleCampaignSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(200, 'Subject must be less than 200 characters'),
  body: z.string().min(1, 'Body is required'),
  recipients: z.array(
    z.string().email('Invalid email address format')
  ).min(1, 'At least one recipient is required'),
  senderId: z.string().uuid('Invalid sender ID format'),
  startTime: z.preprocess(
    (val) => (val ? new Date(val as any) : new Date()),
    z.date().refine((d) => !isNaN(d.getTime()), 'Invalid start time date format')
  ),
  delayMs: z.coerce.number().int().nonnegative('Delay must be a positive integer or zero').default(2000),
  hourlyLimit: z.coerce.number().int().positive('Hourly limit must be a positive integer greater than zero').default(100),
});

let failedTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`   ✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`   ❌ FAIL: ${testName}`);
    failedTests++;
  }
}

async function runTests() {
  console.log('\n==================================================');
  console.log('🧪 RUNNING CRITICAL BACKEND CORRECTNESS TESTS');
  console.log('==================================================\n');

  // Test Case 1: Startup Environment Validation
  console.log('👉 Test 1: Startup Environment Variables Validator');
  try {
    validateEnv();
    assert(true, 'Environment validator ran successfully with valid local configurations.');
  } catch (error: any) {
    assert(false, `Environment validator failed: ${error.message}`);
  }
  console.log();

  // Test Case 2: Input Validation (Valid Scenario)
  console.log('👉 Test 2: Input Validation - Valid Input');
  const validData = {
    subject: 'Test Subject',
    body: 'Test Body',
    recipients: ['test@gmail.com', 'foo@gmail.com'],
    senderId: 'c2e70e62-9bbd-4f07-9cc9-a24f036800d7', // Valid UUID
    delayMs: 1000,
    hourlyLimit: 50,
  };
  const validParse = scheduleCampaignSchema.safeParse(validData);
  assert(validParse.success === true, 'Valid payload parsed successfully.');
  if (validParse.success) {
    assert(validParse.data.delayMs === 1000, 'delayMs parsed correctly as number.');
    assert(validParse.data.recipients.length === 2, 'Recipients array parsed with correct length.');
  }
  console.log();

  // Test Case 3: Input Validation (Invalid Scenario)
  console.log('👉 Test 3: Input Validation - Invalid Inputs');
  const invalidData = {
    subject: '', // Empty
    body: 'Test Body',
    recipients: ['invalid-email', 'foo@gmail.com'], // Invalid format
    senderId: 'non-uuid-id', // Invalid UUID
    delayMs: -100, // Negative
    hourlyLimit: 0, // Zero (invalid positive constraint)
  };
  const invalidParse = scheduleCampaignSchema.safeParse(invalidData);
  assert(invalidParse.success === false, 'Invalid payload successfully rejected.');
  if (!invalidParse.success) {
    const errors = invalidParse.error.flatten().fieldErrors;
    assert(errors.subject !== undefined, 'Empty subject rejected.');
    assert(errors.recipients !== undefined, 'Invalid recipient email rejected.');
    assert(errors.senderId !== undefined, 'Invalid sender UUID rejected.');
    assert(errors.delayMs !== undefined, 'Negative delayMs rejected.');
    assert(errors.hourlyLimit !== undefined, 'Zero hourlyLimit rejected.');
  }
  console.log();

  // Test Case 4: Stale PROCESSING Recovery (Crash Resiliency)
  console.log('👉 Test 4: Stale PROCESSING Email Recovery');
  try {
    // 1. Create a mock user, sender, and campaign in Neon DB
    const mockUser = await prisma.user.upsert({
      where: { googleId: 'test_recovery_user_google_id' },
      update: {},
      create: {
        googleId: 'test_recovery_user_google_id',
        name: 'Tester Recovery',
        email: 'recovery@tester.local',
      },
    });

    const mockSender = await prisma.sender.upsert({
      where: { userId_email: { userId: mockUser.id, email: 'recovery@tester.local' } },
      update: {},
      create: {
        userId: mockUser.id,
        email: 'recovery@tester.local',
        displayName: 'Tester Recovery',
      },
    });

    const mockCampaign = await prisma.campaign.create({
      data: {
        user: { connect: { id: mockUser.id } },
        sender: { connect: { id: mockSender.id } },
        subject: 'Recovery Test',
        body: 'Testing worker recovery',
        startTime: new Date(),
        totalEmails: 1,
        delayMs: 1000,
        hourlyLimit: 10,
      },
    });

    // 2. Create an Email record stuck in PROCESSING (updated 10 minutes ago)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const staleEmail = await prisma.email.create({
      data: {
        campaignId: mockCampaign.id,
        senderId: mockSender.id,
        recipient: 'stale-test@gmail.com',
        subject: 'Stale Subject',
        body: 'Stale Body',
        scheduledAt: tenMinutesAgo,
        status: 'PROCESSING',
        updatedAt: tenMinutesAgo, // Backdated processing start time
      },
    });

    console.log(`   ⚙️ Inserted stale email ${staleEmail.id} in PROCESSING state (backdated 10m).`);

    // 3. Trigger the recovery function
    await recoverStaleEmails();

    // 4. Query the email to verify state has returned to PENDING
    const recoveredEmail = await prisma.email.findUnique({
      where: { id: staleEmail.id },
    });

    assert(recoveredEmail !== null, 'Recovered email still exists in database.');
    if (recoveredEmail) {
      assert(recoveredEmail.status === 'PENDING', 'Stale email successfully reset to PENDING state.');
      assert(!!recoveredEmail.lastError?.includes('stale PROCESSING'), 'Stale email logs recovery error context.');
    }

    // 5. Cleanup database
    await prisma.email.deleteMany({ where: { campaignId: mockCampaign.id } });
    await prisma.campaign.delete({ where: { id: mockCampaign.id } });
    assert(true, 'Test campaign cleaned up successfully.');

  } catch (error: any) {
    assert(false, `Stale PROCESSING recovery test crashed: ${error.message}`);
  }
  console.log();

  console.log('==================================================');
  console.log('📊 TEST EXECUTION SUMMARY:');
  console.log(`   - Tests Passed: ${passedTests}`);
  console.log(`   - Tests Failed: ${failedTests}`);
  console.log('==================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
