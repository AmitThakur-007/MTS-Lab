import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{ filename: string; content: Buffer | string; contentType?: string }>;
}): Promise<boolean> {
  if (!resend) {
    console.warn(`[EMAIL NOTICE] RESEND_API_KEY is not configured. Email to ${options.to} not sent.`);
    return true;
  }

  try {
    const fromAddress = process.env.SMTP_FROM || 'MTS Lab Security <noreply@mobiletechnologystation.com.np>';

    const { error } = await resend.emails.send({
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
      return false;
    }

    console.log(`[EMAIL SUCCESS] Sent email to ${options.to}`);
    return true;
  } catch (err) {
    console.error('[EMAIL ERROR] Exception sending email via Resend:', err);
    return false;
  }
}