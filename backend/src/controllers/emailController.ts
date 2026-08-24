import { Request, Response } from 'express';
import { prisma } from '../prisma';
import { scheduleEmailJob } from '../queues/emailQueue';
import { z } from 'zod';

// Define strict request body validation schema
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

/**
 * Endpoint to schedule a new campaign of emails
 * POST /api/emails/schedule
 */
export async function scheduleEmails(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const validationResult = scheduleCampaignSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed.',
        details: validationResult.error.flatten().fieldErrors,
      });
    }

    const { subject, body, recipients, startTime, delayMs, hourlyLimit, senderId } = validationResult.data;

    const sender = await prisma.sender.findFirst({
      where: { id: senderId, userId },
    });
    if (!sender) {
      return res.status(404).json({ error: 'Sender profile not found or unauthorized.' });
    }

    const parsedStartTime = startTime;
    const delayBetweenEmails = delayMs;
    const limitPerHour = hourlyLimit;

    const result = await prisma.$transaction(async (tx) => {
      const campaign = await tx.campaign.create({
        data: {
          userId,
          senderId,
          subject,
          body,
          startTime: parsedStartTime,
          delayMs: delayBetweenEmails,
          hourlyLimit: limitPerHour,
          totalEmails: recipients.length,
        },
      });

      // Map recipients to staggered scheduled times
      const emailsData = recipients.map((recipient: string, index: number) => {
        const scheduledAt = new Date(parsedStartTime.getTime() + index * delayBetweenEmails);
        return {
          campaignId: campaign.id,
          senderId,
          recipient,
          subject,
          body,
          scheduledAt,
          status: 'PENDING' as const,
        };
      });

      await tx.email.createMany({
        data: emailsData,
      });

      const createdEmails = await tx.email.findMany({
        where: { campaignId: campaign.id },
        select: { id: true, scheduledAt: true },
      });

      return { campaign, emails: createdEmails };
    });

    // 3. Queue the jobs in BullMQ (Only after DB transaction commits successfully!)
    const queuePromises = result.emails.map((email) => {
      const delayFromNow = Math.max(0, email.scheduledAt.getTime() - Date.now());
      return scheduleEmailJob(email.id, delayFromNow);
    });

    await Promise.all(queuePromises);

    res.status(201).json({
      message: `Successfully scheduled campaign with ${result.emails.length} emails.`,
      campaignId: result.campaign.id,
    });
  } catch (error: any) {
    console.error('Error scheduling emails:', error);
    res.status(500).json({ error: error.message || 'Failed to schedule emails.' });
  }
}

/**
 * Endpoint to list all pending/processing emails
 * GET /api/emails/scheduled
 */
export async function getScheduledEmails(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const emails = await prisma.email.findMany({
      where: {
        sender: { userId },
        status: { in: ['PENDING', 'PROCESSING'] },
      },
      include: {
        sender: {
          select: { email: true, displayName: true },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    res.json(emails);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve scheduled emails.' });
  }
}

/**
 * Endpoint to list all completed/failed emails
 * GET /api/emails/sent
 */
export async function getSentEmails(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const emails = await prisma.email.findMany({
      where: {
        sender: { userId },
        status: { in: ['SENT', 'FAILED'] },
      },
      include: {
        sender: {
          select: { email: true, displayName: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json(emails);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve sent emails.' });
  }
}

/**
 * Endpoint to list all verified senders profiles
 * GET /api/senders
 */
export async function getSenders(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const senders = await prisma.sender.findMany({
      where: { userId },
      orderBy: { email: 'asc' },
    });

    res.json(senders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve senders.' });
  }
}
