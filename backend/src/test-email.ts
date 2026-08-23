import { sendEmail } from './services/mailer';

async function runTest() {
  console.log("Sending test email...");
  try {
    const messageId = await sendEmail({
      fromName: 'Test reachinbox',
      fromEmail: 'test@reachinbox.com',
      to: 'recipient@example.com',
      subject: 'ReachInbox Verification Test',
      body: 'Hello! This is a test email sent to verify our SMTP credentials work.',
    });
    console.log("Test email successfully sent! Message ID:", messageId);
  } catch (error) {
    console.error("SMTP Test failed:", error);
  }
}

runTest();