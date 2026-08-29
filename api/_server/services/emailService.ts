import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;

  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;

  if (!smtpUser || !smtpPass) {
    return null;
  }

  if (smtpHost) {
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });
  } else if (process.env.GMAIL_USER) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }

  return transporter;
}

export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{ filename: string; content: Buffer | string; contentType?: string }>;
}): Promise<boolean> {
  const mailer = getTransporter();
  if (!mailer) {
    console.warn(`[EMAIL NOTICE] No SMTP configured. Email to ${options.to} was not sent (Subject: ${options.subject})`);
    return true;
  }

  try {
    const fromAddress = process.env.SMTP_FROM || `"MTS Lab Security" <no-reply@mtslab.com>`;
    await mailer.sendMail({
      from: fromAddress,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments,
    });
    return true;
  } catch (err) {
    console.error('[EMAIL ERROR] Failed to send email:', err);
    return false;
  }
}
