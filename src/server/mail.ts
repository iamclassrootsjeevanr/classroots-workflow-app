import 'server-only';
import { env } from './env';

export type Mail = { to: string; subject: string; text: string; html: string };

/** Sends through EMAIL_SERVER (SMTP URL). Without it (local dev) the mail is printed to the server log and `sent` is false. */
export async function sendMail(mail: Mail): Promise<{ sent: boolean }> {
  const { EMAIL_SERVER, EMAIL_FROM } = env();
  if (!EMAIL_SERVER) {
    console.log(`\n[mail] Email is not set up (EMAIL_SERVER). To: ${mail.to}\nSubject: ${mail.subject}\n${mail.text}\n`);
    return { sent: false };
  }
  const nodemailer = await import('nodemailer');
  await nodemailer.createTransport(EMAIL_SERVER).sendMail({ from: EMAIL_FROM, ...mail });
  return { sent: true };
}
