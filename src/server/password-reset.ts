import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { db } from './db';

/**
 * One-time links to choose a password: 'reset' (forgot password) or 'invite' (invite without a password).
 * Stored in Auth.js's VerificationToken table as a SHA-256 hash, so a database leak does not leak working links.
 * Identifier: "pwreset:<kind>:<email>". A new link replaces any older link for that email.
 */
type Kind = 'reset' | 'invite';
const PREFIX = 'pwreset:';
const hash = (raw: string) => createHash('sha256').update(raw).digest('hex');
const id = (kind: Kind, email: string) => `${PREFIX}${kind}:${email.toLowerCase()}`;
const emailOf = (identifier: string) => identifier.slice(identifier.indexOf(':', PREFIX.length) + 1);

export async function createPasswordToken(kind: Kind, email: string, hours: number): Promise<string> {
  const raw = randomBytes(32).toString('base64url');
  await db.$transaction([
    db.verificationToken.deleteMany({ where: { identifier: { in: [id('reset', email), id('invite', email)] } } }),
    db.verificationToken.create({ data: { identifier: id(kind, email), token: hash(raw), expires: new Date(Date.now() + hours * 3600_000) } }),
  ]);
  return raw;
}

/** True when a link of this kind was made in the last `minutes` (blunts repeated "forgot password" requests). */
export async function recentPasswordToken(kind: Kind, email: string, hours: number, minutes: number): Promise<boolean> {
  const t = await db.verificationToken.findFirst({ where: { identifier: id(kind, email) }, orderBy: { expires: 'desc' } });
  return Boolean(t && t.expires.getTime() - hours * 3600_000 > Date.now() - minutes * 60_000);
}

/** The email a still-valid link belongs to, or null. Does not use it up. */
export async function peekPasswordToken(raw: string): Promise<string | null> {
  const t = await db.verificationToken.findFirst({ where: { token: hash(raw), identifier: { startsWith: PREFIX } } });
  return t && t.expires > new Date() ? emailOf(t.identifier) : null;
}

/** Use up a link: returns its email if it was valid. */
export async function consumePasswordToken(raw: string): Promise<string | null> {
  const t = await db.verificationToken.findFirst({ where: { token: hash(raw), identifier: { startsWith: PREFIX } } });
  if (!t) return null;
  const email = emailOf(t.identifier);
  await db.verificationToken.deleteMany({ where: { identifier: { in: [id('reset', email), id('invite', email)] } } });
  return t.expires > new Date() ? email : null;
}
