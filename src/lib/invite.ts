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
  /** Password users: the temporary password the admin just set (only known at that moment). */
  password?: string;
  /** Password users without a new password: a link to choose one (see password-reset). */
  setPasswordUrl?: string;
};

const button = (url: string, label: string) =>
  `<p><a href="${esc(url)}" style="display:inline-block;padding:10px 18px;background:#1976d2;color:#fff;border-radius:6px;text-decoration:none">${esc(label)}</a></p>`;

export function inviteEmail(p: InviteInput): { subject: string; text: string; html: string } {
  const url = signInUrl(p.appUrl, p.email);
  const access = p.access.length ? ` for ${p.access.join(', ')}` : '';
  const hello = p.name ? `Hi ${p.name},` : 'Hi,';
  let steps: string[];
  if (p.method === 'google') {
    steps = [`Open ${url}`, `Press “Sign in with Google” and choose your ${p.email} account. No password is needed.`];
  } else if (p.password) {
    steps = [
      `Open ${url}`,
      `Under “Everyone else”, sign in with:\nEmail: ${p.email}\nPassword: ${p.password}`,
      'Then choose your own password: your name (bottom left) → My account → Change password.',
    ];
  } else if (p.setPasswordUrl) {
    steps = [`Choose your password here (the link works for ${RESET_LINK_HOURS.invite} hours): ${p.setPasswordUrl}`, `Then sign in at ${url} with ${p.email} and that password.`];
  } else {
    steps = [`Open ${url}`, `Sign in with ${p.email} and the password ${p.invitedBy} gives you.`];
  }
  const text = `${hello}\n\n${p.invitedBy} gave you access to Classroots Work${access}.\n\n${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nForgot your password later? Use “Forgot password?” on the sign-in page.\n`;
  const html =
    `<p>${esc(hello)}</p>` +
    `<p>${esc(p.invitedBy)} gave you access to <b>Classroots Work</b>${esc(access)}.</p>` +
    (p.method !== 'google' && !p.password && p.setPasswordUrl ? button(p.setPasswordUrl, 'Choose your password') : button(url, 'Open Classroots Work')) +
    `<ol>${steps.map(s => `<li style="margin-bottom:6px">${esc(s).replace(/\n/g, '<br>')}</li>`).join('')}</ol>` +
    (p.method === 'google' ? '' : `<p style="color:#666;font-size:12px">Forgot your password later? Use “Forgot password?” on the sign-in page.</p>`);
  return { subject: 'You have access to Classroots Work', text, html };
}

/** How long emailed password links work, in hours. */
export const RESET_LINK_HOURS = { reset: 1, invite: 72 } as const;

export function resetPasswordUrl(appUrl: string, token: string) {
  return `${appUrl.replace(/\/+$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
}

export function resetEmail(p: { name: string | null; url: string }): { subject: string; text: string; html: string } {
  const hello = p.name ? `Hi ${p.name},` : 'Hi,';
  const note = `This link works for ${RESET_LINK_HOURS.reset} hour and only once. If you did not ask for it, ignore this email: your password stays the same.`;
  return {
    subject: 'Reset your Classroots Work password',
    text: `${hello}\n\nChoose a new password here:\n${p.url}\n\n${note}\n`,
    html: `<p>${esc(hello)}</p><p>Choose a new password for <b>Classroots Work</b>:</p>${button(p.url, 'Choose a new password')}<p style="color:#666;font-size:12px">${esc(note)}</p>`,
  };
}
