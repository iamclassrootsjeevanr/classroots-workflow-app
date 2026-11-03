import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth-shell';
import { PasswordField } from '@/components/password-field';
import { hashPassword, passwordProblem } from '@/lib/password';
import { db } from '@/server/db';
import { consumePasswordToken, peekPasswordToken } from '@/server/password-reset';

export const metadata = { title: 'Choose a new password' };

async function resetPassword(formData: FormData) {
  'use server';
  const token = String(formData.get('token') ?? '');
  const next = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  const back = (error: string) => redirect(`/reset-password?token=${encodeURIComponent(token)}&error=${encodeURIComponent(error)}`);
  const email = await peekPasswordToken(token);
  if (!email) redirect('/reset-password?token=expired');
  if (next !== confirm) back('The two passwords don’t match.');
  const problem = passwordProblem(next, email);
  if (problem) back(problem);
  const used = await consumePasswordToken(token);
  if (!used) redirect('/reset-password?token=expired');
  const user = await db.user.findUnique({ where: { email: used } });
  if (!user?.active) redirect('/signin?error=Inactive');
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next), passwordUpdatedAt: new Date() } });
  redirect(`/signin?email=${encodeURIComponent(used)}&reset=1`);
}

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token = '', error } = await searchParams;
  const email = token ? await peekPasswordToken(token) : null;

  return (
    <AuthShell title="Choose a new password">
      {!email ? (
        <div className="space-y-3 text-sm">
          <p className="note-bad">This link has expired or was already used.</p>
          <Link href="/forgot-password" className="btn-primary w-full py-2.5">
            Get a new link
          </Link>
        </div>
      ) : (
        <form action={resetPassword} className="space-y-4">
          <p className="text-sm text-muted">
            For <b className="text-ink">{email}</b>. At least 10 characters, with letters and numbers.
          </p>
          {error && <p className="note-bad">{error}</p>}
          <input type="hidden" name="token" value={token} />
          <PasswordField id="password" name="password" autoComplete="new-password" label="New password" />
          <PasswordField id="confirm" name="confirm" autoComplete="new-password" label="New password again" />
          <button className="btn-primary w-full py-2.5" type="submit">
            Save password
          </button>
        </form>
      )}
      <p className="mt-4 text-center text-sm">
        <Link href="/signin" className="link">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
