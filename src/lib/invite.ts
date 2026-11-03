/** How a person signs in, and the invite email that tells them. Pure: no DB, no mail. */

export type SignInMethod = 'google' | 'password';

export function emailDomain(email: string) {
  return (email.split('@')[1] ?? '').toLowerCase();
}

export const isOfficeEmail = (email: string, officeDomains: string[]) => officeDomains.includes(emailDomain(email));

/** Office emails (and anyone who already linked a Google account) use Google when it is set up; everyone else email + password. */
export function signInMethod(p: { email: string; googleEnabled: boolean; officeDomains: string[]; hasGoogleAccount: boolean }): SignInMethod {
  return p.googleEnabled && (p.hasGoogleAccount || isOfficeEmail(p.email, p.officeDomains)) ? 'google' : 'password';
}

/**
 * Saving a person: someone outside the office domains can only sign in with a password, so one must exist.
 * Returns the problem to show, or null.
 */
export function missingPasswordProblem(p: { email: string; active: boolean; officeDomains: string[]; hasPassword: boolean; newPassword?: string }): string | null {
  if (!p.email || !p.active || p.hasPassword || p.newPassword) return null;
  if (isOfficeEmail(p.email, p.officeDomains)) return null;
  const office = p.officeDomains.length ? `People outside @${p.officeDomains.join(', @')} ` : 'People ';
  return `Set a password: ${office}sign in with their email and a password you give them.`;
}

export function signInUrl(appUrl: string, email: string) {
  return `${appUrl.replace(/\/+$/, '')}/signin?email=${encodeURIComponent(email)}`;
}

/** A temporary password that passes `passwordProblem`: 12 characters, letters and digits, no look-alikes (0/O, 1/l/I). */
export function generatePassword(length = 12) {
  const letters = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const all = letters + digits;
  const rnd = new Uint32Array(length);
  for (;;) {
    globalThis.crypto.getRandomValues(rnd);
    const pw = Array.from(rnd, n => all[n % all.length]).join('');
    if (/[A-Za-z]/.test(pw) && /[0-9]/.test(pw)) return pw;
  }
}

/** Text an admin can paste into WhatsApp or an email for someone who signs in with a password. */
export function loginDetailsText(p: { appUrl: string; email: string; password: string }) {
  return `Classroots Work\nOpen: ${signInUrl(p.appUrl, p.email)}\nEmail: ${p.email}\nPassword: ${p.password}\nChange the password after signing in: your name (bottom left) → My account.`;
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
      ? `Press “Sign in with Google” and choose your ${p.email} account. No password is needed.`
      : `Sign in with your email ${p.email} and the password ${p.invitedBy} gives you. You can change it under My account.`;
  const access = p.access.length ? ` for ${p.access.join(', ')}` : '';
  const hello = p.name ? `Hi ${p.name},` : 'Hi,';
  const text = `${hello}\n\n${p.invitedBy} gave you access to Classroots Work${access}.\n\nOpen: ${url}\n${how}\n`;
  const html =
    `<p>${esc(hello)}</p>` +
    `<p>${esc(p.invitedBy)} gave you access to <b>Classroots Work</b>${esc(access)}.</p>` +
    `<p><a href="${esc(url)}" style="display:inline-block;padding:10px 18px;background:#1976d2;color:#fff;border-radius:6px;text-decoration:none">Open Classroots Work</a></p>` +
    `<p>${esc(how)}</p>`;
  return { subject: 'You have access to Classroots Work', text, html };
}
