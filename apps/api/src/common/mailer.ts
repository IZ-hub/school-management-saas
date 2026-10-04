import { Logger } from '@nestjs/common';

const log = new Logger('Mailer');

/** True when the server is set up to send email (RESEND_API_KEY in the API's .env). */
export const mailEnabled = () => !!process.env.RESEND_API_KEY;

/** Sends one email through Resend. Returns false (and logs) instead of throwing, so callers never leak whether it worked. */
export async function sendMail(to: string, subject: string, text: string, html: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    log.warn(`Email not sent (RESEND_API_KEY not set): "${subject}"`);
    return false;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.MAIL_FROM || 'Schoolful LMS <onboarding@resend.dev>', to: [to], subject, text, html }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      log.error(`Email "${subject}" failed: ${res.status} ${await res.text().catch(() => '')}`);
      return false;
    }
    return true;
  } catch (err) {
    log.error(`Email "${subject}" failed: ${(err as Error).message}`);
    return false;
  }
}
