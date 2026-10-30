import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';
import { PasswordField } from '@/components/password-field';
import { signIn } from '@/server/auth';
import { env, googleEnabled } from '@/server/env';
import { currentUser } from '@/server/rbac';

export const metadata = { title: 'Sign in' };

const ERRORS: Record<string, string> = {
  CredentialsSignin: 'Email or password is incorrect. If you have never set a password, use “Email me a sign-in link” below.',
  GoogleNotConfigured: 'Google sign-in isn’t set up on this server yet. Use email and password, or ask an admin.',
  NotInvited: 'This account has not been invited yet. Ask an admin to add you.',
  Inactive: 'Your account is deactivated. Contact an admin.',
  NoEmail: 'Your sign-in provider did not share an email address.',
  Verification: 'That sign-in link has expired or was already used. Request a new one.',
  OAuthAccountNotLinked: 'This email is linked to a different sign-in method.',
  AccessDenied: 'This account has not been invited yet. Ask an admin to add you.',
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

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string; callbackUrl?: string }> }) {
  if (await currentUser()) redirect('/');
  const { error, callbackUrl } = await searchParams;
  const redirectTo = callbackUrl?.startsWith('/') ? callbackUrl : '/';
  const domains = env().ALLOWED_DOMAINS;

  return (
    <main className="safe-bottom flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-lg font-bold text-white">C</div>
          <h1 className="text-xl font-semibold">Classroots Work</h1>
        </div>

        <div className="rounded-2xl border border-line bg-white px-5 py-6 shadow-[var(--shadow-card)] sm:px-8 sm:py-7">
          <p className="mb-6 text-center text-[15px] text-muted">Sign in to your account</p>
          {error && <p className="mb-5 rounded-md bg-red-50 px-3 py-2 text-sm text-bad">{ERRORS[error] ?? 'Sign-in failed. Try again.'}</p>}

          {/* Classroots staff: Google sign-in (first sign-in creates the account when the domain is allowed) */}
          <section>
            <h2 className="mb-3 text-lg font-normal">Classroots Users</h2>
            <form
              action={async () => {
                'use server';
                if (!googleEnabled()) redirect('/signin?error=GoogleNotConfigured');
                await attempt('google', { redirectTo });
              }}
            >
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2.5 rounded border border-brand/50 bg-white py-2 text-sm font-medium tracking-wide text-brand uppercase hover:bg-brand-soft"
              >
                <GoogleIcon />
                Sign in with Google
              </button>
            </form>
            <p className="mt-2 text-center text-xs text-muted">
              {domains.length
                ? `New here? Signing in with your @${domains.join(' / @')} Google account creates your account.`
                : 'Use the Google account your admin invited.'}
            </p>
          </section>

          <div className="my-6 flex items-center gap-4 text-sm text-ink">
            <span className="h-px flex-1 bg-line" />
            OR
            <span className="h-px flex-1 bg-line" />
          </div>

          {/* Organizations & clients: email + password set by an admin */}
          <section>
            <h2 className="mb-4 text-lg font-normal">Organizations &amp; Clients</h2>
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
                <input className="input py-2.5" id="email" name="email" type="email" required autoComplete="username" />
              </div>
              <PasswordField id="password" name="password" />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="remember" defaultChecked className="h-4 w-4 accent-brand" />
                Remember me
              </label>
              <button className="w-full rounded bg-brand py-2.5 text-sm font-medium tracking-wide text-white uppercase shadow-sm hover:bg-brand-dark" type="submit">
                Sign in
              </button>
            </form>
          </section>

          <details className="mt-5 border-t border-line pt-4">
            <summary className="cursor-pointer list-none text-center text-sm text-brand hover:underline">No password yet, or forgot it? Email me a sign-in link</summary>
            <form
              className="mt-3 flex gap-2"
              action={async (formData: FormData) => {
                'use server';
                await attempt('email', { email: String(formData.get('email') ?? '').trim().toLowerCase(), redirectTo });
              }}
            >
              <input className="input py-2" name="email" type="email" required autoComplete="email" placeholder="you@company.com" aria-label="Email for sign-in link" />
              <button className="btn-ghost shrink-0" type="submit">
                Send link
              </button>
            </form>
          </details>
        </div>
        <p className="mt-4 text-center text-xs text-muted">Access is by invitation. Ask an admin if you can’t sign in.</p>
      </div>
    </main>
  );
}
