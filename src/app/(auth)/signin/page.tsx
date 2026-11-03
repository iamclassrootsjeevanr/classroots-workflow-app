import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';
import { PasswordField } from '@/components/password-field';
import { signIn } from '@/server/auth';
import { env, googleEnabled } from '@/server/env';
import { currentUser } from '@/server/rbac';

export const metadata = { title: 'Sign in' };

const ERRORS: Record<string, string> = {
  CredentialsSignin: 'Email or password is incorrect. Forgot your password? Ask your admin to set a new one.',
  GoogleNotConfigured: 'Google sign-in isn’t set up on this server yet. Ask your admin.',
  GoogleOfficeOnly: 'Google sign-in is only for office accounts. Sign in with your email and the password your admin gave you.',
  NotInvited: 'This account has not been added yet. Ask an admin to add you.',
  Inactive: 'Your account is deactivated. Contact an admin.',
  NoEmail: 'Your sign-in provider did not share an email address.',
  OAuthAccountNotLinked: 'This email is linked to a different sign-in method.',
  AccessDenied: 'This account has not been added yet. Ask an admin to add you.',
  Configuration: 'Sign-in is not configured correctly. Check the server log.',
};

/** Run an Auth.js sign-in from a server action; known failures come back to this page as ?error=…  */
async function attempt(provider: string, options: Record<string, string>) {
  try {
    await signIn(provider, options);
  } catch (e) {
    if (e instanceof AuthError) redirect(`/signin?error=${e.type}`);
    throw e; // the redirect after a successful sign-in
  }
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string; callbackUrl?: string; email?: string }> }) {
  if (await currentUser()) redirect('/');
  const { error, callbackUrl, email: invitedEmail } = await searchParams;
  const emailValue = invitedEmail?.includes('@') ? invitedEmail.trim().toLowerCase() : undefined;
  const redirectTo = callbackUrl?.startsWith('/') ? callbackUrl : '/';
  const office = env().OFFICE_DOMAINS;
  const officeLabel = office.length ? office.map(d => `@${d}`).join(' / ') : 'office';

  return (
    <main className="safe-bottom flex min-h-screen items-center justify-center bg-[radial-gradient(70%_45%_at_50%_0%,var(--brand-soft),transparent)] p-4">
      <div className="w-full max-w-md">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-lg font-bold text-white">C</div>
          <h1 className="text-xl font-semibold">Classroots Work</h1>
        </div>

        <div className="rounded-2xl border border-line bg-surface px-5 py-6 shadow-[var(--shadow-card)] sm:px-8 sm:py-7">
          <p className="mb-6 text-center text-md text-muted">Sign in to your account</p>
          {error && <p className="note-bad mb-5">{ERRORS[error] ?? 'Sign-in failed. Try again.'}</p>}

          {/* Office staff: Google sign-in (the admin must have added them) */}
          <section>
            <h2 className="mb-3 text-md font-semibold">Classroots staff</h2>
            <form
              action={async () => {
                'use server';
                if (!googleEnabled()) redirect('/signin?error=GoogleNotConfigured');
                await attempt('google', { redirectTo });
              }}
            >
              <button
                type="submit"
                className="btn-ghost w-full gap-2.5 py-2.5"
              >
                <GoogleIcon />
                Sign in with Google
              </button>
            </form>
            <p className="mt-2 text-center text-xs text-muted">For {officeLabel} Google accounts. No password needed.</p>
          </section>

          <div className="my-6 flex items-center gap-4 text-xs font-medium text-muted">
            <span className="h-px flex-1 bg-line" />
            OR
            <span className="h-px flex-1 bg-line" />
          </div>

          {/* Everyone else: email + password given by an admin */}
          <section>
            <h2 className="mb-1 text-md font-semibold">Everyone else</h2>
            <p className="mb-4 text-xs text-muted">Use your email and the password your admin gave you.</p>
            <form
              className="space-y-4"
              action={async (formData: FormData) => {
                'use server';
                await attempt('password', {
                  email: String(formData.get('email') ?? '').trim().toLowerCase(),
                  password: String(formData.get('password') ?? ''),
                  remember: formData.get('remember') ? 'on' : 'off',
                  redirectTo,
                });
              }}
            >
              <div>
                <label className="label" htmlFor="email">
                  Email <span className="text-bad">*</span>
                </label>
                <input className="input py-2.5" id="email" name="email" type="email" required autoComplete="username" defaultValue={emailValue} />
              </div>
              <PasswordField id="password" name="password" />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="remember" defaultChecked className="h-4 w-4 rounded accent-brand" />
                Remember me
              </label>
              <button className="btn-primary w-full py-2.5" type="submit">
                Sign in
              </button>
            </form>
          </section>
        </div>
        <p className="mt-4 text-center text-xs text-muted">Only people an admin has added can sign in. Forgot your password? Ask your admin.</p>
      </div>
    </main>
  );
}
