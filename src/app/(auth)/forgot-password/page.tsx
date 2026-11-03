import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth-shell';
import { isOfficeEmail, RESET_LINK_HOURS, resetEmail, resetPasswordUrl } from '@/lib/invite';
import { db } from '@/server/db';
import { emailEnabled, env, googleEnabled } from '@/server/env';
import { sendMail } from '@/server/mail';
import { createPasswordToken, recentPasswordToken } from '@/server/password-reset';

export const metadata = { title: 'Forgot password' };

/** Sends a reset link to people who sign in with a password. The answer is the same whether or not the email exists. */
async function requestReset(formData: FormData) {
  'use server';
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!email.includes('@')) redirect('/forgot-password?error=email');
  const user = await db.user.findUnique({ where: { email }, select: { name: true, active: true } });
  const google = googleEnabled() && isOfficeEmail(email, env().OFFICE_DOMAINS);
  if (user?.active && !google && !(await recentPasswordToken('reset', email, RESET_LINK_HOURS.reset, 2))) {
    const token = await createPasswordToken('reset', email, RESET_LINK_HOURS.reset);
    try {
      await sendMail({ to: email, ...resetEmail({ name: user.name, url: resetPasswordUrl(env().AUTH_URL, token) }) });
    } catch (e) {
      console.error('[forgot-password]', e);
    }
  }
  redirect(`/forgot-password?sent=${encodeURIComponent(email)}`);
}

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string; email?: string }> }) {
  const { sent, error, email } = await searchParams;
  const office = env().OFFICE_DOMAINS;
  const canEmail = emailEnabled() || env().NODE_ENV !== 'production';

  return (
    <AuthShell title="Forgot your password?">
      {sent ? (
        <div className="space-y-3 text-sm">
          <p className="note-ok">If {sent} can sign in with a password, we have emailed it a link to choose a new one. It works for {RESET_LINK_HOURS.reset} hour.</p>
          <p className="text-muted">No email after a few minutes? Check spam, or ask your admin to set a new password for you.</p>
        </div>
      ) : canEmail ? (
        <form action={requestReset} className="space-y-4">
          {error && <p className="note-bad">Enter the email you sign in with.</p>}
          <p className="text-sm text-muted">Enter your email. We will send you a link to choose a new password.</p>
          <div>
            <label className="label" htmlFor="email">
              Email <span className="text-bad">*</span>
            </label>
            <input className="input py-2.5" id="email" name="email" type="email" required autoComplete="email" defaultValue={email} />
          </div>
          <button className="btn-primary w-full py-2.5" type="submit">
            Email me a reset link
          </button>
          {!emailEnabled() && <p className="text-xs text-warn">Email is not set up on this server: the link is printed in the server log.</p>}
        </form>
      ) : (
        <p className="text-sm">Ask your admin to set a new password for you.</p>
      )}
      {office.length > 0 && <p className="mt-4 text-xs text-muted">Office staff (@{office.join(', @')}) have no password here: use “Sign in with Google”.</p>}
      <p className="mt-4 text-center text-sm">
        <Link href="/signin" className="link">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
