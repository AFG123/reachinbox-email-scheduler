import { Request, Response } from 'express';
import { prisma } from '../prisma';
import { scheduleEmailJob } from '../queues/emailQueue';

/**
 * Endpoint to schedule a new campaign of emails
 * POST /api/emails/schedule
 */
export async function scheduleEmails(req: Request, res: Response) {
  try {
    const { subject, body, recipients, startTime, delayMs, hourlyLimit, senderId } = req.body;
    const userId = req.user?.id;

    // 1. Validation
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }
    if (!subject || !body || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'Missing subject, body, or recipients list.' });
    }
    if (!senderId) {
      return res.status(400).json({ error: 'Missing sender ID.' });
    }

    // Verify sender belongs to the user
    const sender = await prisma.sender.findFirst({
      where: { id: senderId, userId },
    });
    if (!sender) {
      return res.status(404).json({ error: 'Sender profile not found or unauthorized.' });
    }

    const parsedStartTime = new Date(startTime || Date.now());
    const delayBetweenEmails = parseInt(delayMs) || 2000;
    const limitPerHour = parseInt(hourlyLimit) || 100;

    // 2. Perform Database Write inside a Transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create Campaign record
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
        // Space out scheduled times by the requested delay
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

      // Batch insert emails into the database
      await tx.email.createMany({
        data: emailsData,
      });

      // Query the newly created emails to get their auto-generated IDs
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
