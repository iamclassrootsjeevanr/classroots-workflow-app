import 'server-only';
import { inviteEmail, RESET_LINK_HOURS, resetPasswordUrl, signInMethod } from '@/lib/invite';
import { db } from './db';
import { env, googleEnabled } from './env';
import { sendMail } from './mail';
import { createPasswordToken } from './password-reset';

export type InviteResult = 'sent' | 'log';

/**
 * Email someone that they have access and how to sign in. Office emails: Google. Others: the temporary password the admin just
 * set (`password`), or else a link to choose one.
 */
export async function sendAccessEmail(userId: string, invitedBy: string, password?: string): Promise<InviteResult> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    include: { accounts: { select: { provider: true } }, memberships: { include: { workType: { select: { name: true } }, roles: { include: { role: { select: { name: true } } } } } } },
  });
  if (!user.email) throw new Error('Add an email for this person first.');
  if (!user.active) throw new Error('Activate this person before inviting them.');
  const e = env();
  const method = signInMethod({ email: user.email, googleEnabled: googleEnabled(), officeDomains: e.OFFICE_DOMAINS, hasGoogleAccount: user.accounts.some(a => a.provider === 'google') });
  const setPasswordUrl = method === 'password' && !password ? resetPasswordUrl(e.AUTH_URL, await createPasswordToken('invite', user.email, RESET_LINK_HOURS.invite)) : undefined;
  const access = user.isAdmin ? ['everything (admin)'] : user.memberships.map(m => `${m.workType.name} (${m.roles.map(r => r.role.name).join(' + ')})`);
  const mail = inviteEmail({ name: user.name, email: user.email, invitedBy, appUrl: e.AUTH_URL, method, access, password: method === 'password' ? password : undefined, setPasswordUrl });
  const { sent } = await sendMail({ to: user.email, ...mail });
  return sent ? 'sent' : 'log';
}
