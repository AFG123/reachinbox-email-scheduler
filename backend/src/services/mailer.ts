import nodemailer from 'nodemailer';
import 'dotenv/config';
import { logger } from '../utils/logger';

// Create a reusable transporter using the SMTP configuration
export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export interface SendEmailOptions {
  fromName: string;
  fromEmail: string;
  to: string;
  subject: string;
  body: string;
}

/**
 * Sends an email using Nodemailer and returns the message ID
 */
export async function sendEmail({
  fromName,
  fromEmail,
  to,
  subject,
  body,
}: SendEmailOptions): Promise<string> {
  const info = await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject,
    text: body,
    html: body.replace(/\n/g, '<br>'),
  });

  logger.info(`Email sent to ${to}. Message ID: ${info.messageId}`);
  logger.info(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);

  return info.messageId;
}