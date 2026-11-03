/** How an invited person should sign in, and the invite email that tells them. Pure: no DB, no mail. */

export type SignInMethod = 'google' | 'password' | 'link';

export function emailDomain(email: string) {
  return (email.split('@')[1] ?? '').toLowerCase();
}

/**
 * Organisation staff (an allowed domain, or a Google account already linked) use Google when it is set up.
 * Everyone else uses the password an admin set, or else an email sign-in link.
 */
export function signInMethod(p: { email: string; googleEnabled: boolean; allowedDomains: string[]; hasGoogleAccount: boolean; hasPassword: boolean }): SignInMethod {
  if (p.googleEnabled && (p.hasGoogleAccount || p.allowedDomains.includes(emailDomain(p.email)))) return 'google';
  return p.hasPassword ? 'password' : 'link';
}

export function signInUrl(appUrl: string, email: string) {
  return `${appUrl.replace(/\/+$/, '')}/signin?email=${encodeURIComponent(email)}`;
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export type InviteInput = {
  name: string | null;
  email: string;
  invitedBy: string;
  appUrl: string;
  method: SignInMethod;
  /** e.g. "APK Testing (Tester)" */
  access: string[];
};

export function inviteEmail(p: InviteInput): { subject: string; text: string; html: string } {
  const url = signInUrl(p.appUrl, p.email);
  const how =
    p.method === 'google'
      ? `Choose “Sign in with Google” and pick ${p.email}.`
      : p.method === 'password'
        ? `Sign in with ${p.email} and the password ${p.invitedBy} shares with you. You can change it under My account.`
        : `Under “No password yet, or forgot it?”, enter ${p.email} and press Send link. Open the link in the email to sign in. You can set a password under My account.`;
  const access = p.access.length ? ` for ${p.access.join(', ')}` : '';
  const hello = p.name ? `Hi ${p.name},` : 'Hi,';
  const text = `${hello}\n\n${p.invitedBy} gave you access to Classroots Work${access}.\n\nSign in: ${url}\n${how}\n`;
  const html =
    `<p>${esc(hello)}</p>` +
    `<p>${esc(p.invitedBy)} gave you access to <b>Classroots Work</b>${esc(access)}.</p>` +
    `<p><a href="${esc(url)}" style="display:inline-block;padding:10px 18px;background:#1976d2;color:#fff;border-radius:6px;text-decoration:none">Open Classroots Work</a></p>` +
    `<p>${esc(how)}</p>`;
  return { subject: 'You have access to Classroots Work', text, html };
}
