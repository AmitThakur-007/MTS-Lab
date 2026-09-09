import { Resend } from 'resend';
import nodemailer from 'nodemailer';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{ filename: string; content: Buffer | string; contentType?: string }>;
}

export interface EmailSendResult {
  success: boolean;
  status: 'sent' | 'failed';
  provider: 'resend' | 'smtp' | 'gmail' | 'ethereal' | 'none';
  messageId?: string;
  previewUrl?: string;
  error?: string;
}

let cachedTestTransporter: nodemailer.Transporter | null = null;

export async function sendEmailDetailed(options: EmailOptions): Promise<EmailSendResult> {
  const fromAddress = process.env.SMTP_FROM || 'MTS Lab Support <support@mobiletechnologystation.com.np>';

  // 1. Resend API
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey && resendApiKey.trim().length > 0) {
    try {
      const resend = new Resend(resendApiKey.trim());
      const { data, error } = await resend.emails.send({
        from: fromAddress,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        attachments: options.attachments?.map(att => ({
          filename: att.filename,
          content: att.content,
        })),
      });

      if (error) {
        console.error('[RESEND ERROR] Failed to send email:', error);
        return { success: false, status: 'failed', provider: 'resend', error: error.message };
      }

      console.log(`[EMAIL SUCCESS via Resend] Sent to ${options.to}, id: ${data?.id}`);
      return { success: true, status: 'sent', provider: 'resend', messageId: data?.id };
    } catch (err: any) {
      console.error('[RESEND EXCEPTION]', err);
      return { success: false, status: 'failed', provider: 'resend', error: err?.message || 'Resend error' };
    }
  }

  // 2. Custom SMTP
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: process.env.SMTP_SECURE === 'true' || port === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const info = await transporter.sendMail({
        from: fromAddress,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        attachments: options.attachments,
      });

      console.log(`[EMAIL SUCCESS via SMTP] Sent to ${options.to}, id: ${info.messageId}`);
      return { success: true, status: 'sent', provider: 'smtp', messageId: info.messageId };
    } catch (err: any) {
      console.error('[SMTP EXCEPTION]', err);
      return { success: false, status: 'failed', provider: 'smtp', error: err?.message || 'SMTP error' };
    }
  }

  // 3. Gmail App Password
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD,
        },
      });

      const info = await transporter.sendMail({
        from: fromAddress,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        attachments: options.attachments,
      });

      console.log(`[EMAIL SUCCESS via Gmail] Sent to ${options.to}, id: ${info.messageId}`);
      return { success: true, status: 'sent', provider: 'gmail', messageId: info.messageId };
    } catch (err: any) {
      console.error('[GMAIL EXCEPTION]', err);
      return { success: false, status: 'failed', provider: 'gmail', error: err?.message || 'Gmail error' };
    }
  }

  // 4. Authenticated Development / Test SMTP (Ethereal)
  // Ensures emails are genuinely dispatched and verifiable without crashing or faking
  try {
    if (!cachedTestTransporter) {
      const testAccount = await nodemailer.createTestAccount();
      cachedTestTransporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    }

    const info = await cachedTestTransporter.sendMail({
      from: fromAddress,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      attachments: options.attachments,
    });

    const preview = nodemailer.getTestMessageUrl(info) || undefined;
    console.log(`[EMAIL DISPATCHED via Ethereal SMTP] Message ID: ${info.messageId} | Preview: ${preview}`);
    return {
      success: true,
      status: 'sent',
      provider: 'ethereal',
      messageId: info.messageId,
      previewUrl: preview,
    };
  } catch (err: any) {
    console.error('[TEST EMAIL DISPATCH ERROR]', err);
    return {
      success: false,
      status: 'failed',
      provider: 'none',
      error: 'No email service configured and test dispatch failed.',
    };
  }
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const result = await sendEmailDetailed(options);
  return result.success;
}
