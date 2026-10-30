import { PrismaAdapter } from '@auth/prisma-adapter';
import type { EmailConfig } from '@auth/core/providers/email';
import NextAuth, { CredentialsSignin, type DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { verifyPassword } from '@/lib/password';
import { db } from './db';
import { env, googleEnabled } from './env';

declare module 'next-auth' {
  interface Session {
    /** Only the id is trusted from the session; admin flag, access and active flag are re-read from the DB per request (rbac.ts). */
    user: { id: string } & DefaultSession['user'];
  }
}

function isPrivileged(email: string) {
  const e = env();
  const domain = email.split('@')[1] ?? '';
  return { admin: e.ADMIN_EMAILS.includes(email), domain: e.ALLOWED_DOMAINS.includes(domain) };
}

/** Magic-link provider. Without EMAIL_SERVER (local dev) the link is printed to the server log. */
const emailProvider: EmailConfig = {
  id: 'email',
  type: 'email',
  name: 'Email',
  from: env().EMAIL_FROM,
  maxAge: 24 * 60 * 60,
  options: {},
  async sendVerificationRequest({ identifier, url }) {
    const server = env().EMAIL_SERVER;
    if (!server) {
      console.log(`\n[auth] Magic sign-in link for ${identifier}:\n${url}\n`);
      return;
    }
    const nodemailer = await import('nodemailer');
    const transport = nodemailer.createTransport(server);
    const host = new URL(url).host;
    await transport.sendMail({
      to: identifier,
      from: env().EMAIL_FROM,
      subject: `Sign in to Classroots Work`,
      text: `Sign in to ${host}\n${url}\n\nThis link expires in 24 hours. If you did not request it, ignore this email.`,
      html: `<p>Sign in to <b>Classroots Work</b></p><p><a href="${url}" style="display:inline-block;padding:10px 18px;background:#1976d2;color:#fff;border-radius:6px;text-decoration:none">Sign in</a></p><p style="color:#666;font-size:12px">This link expires in 24 hours. If you did not request it, ignore this email.</p>`,
    });
  },
};

/** Email + password. Same allow-list as the other methods: the account must exist, be active and have a password set. */
const passwordProvider = Credentials({
  id: 'password',
  name: 'Email and password',
  credentials: { email: { label: 'Email', type: 'email' }, password: { label: 'Password', type: 'password' }, remember: { label: 'Remember me', type: 'checkbox' } },
  async authorize(raw) {
    const email = String(raw?.email ?? '').trim().toLowerCase();
    const password = String(raw?.password ?? '');
    if (!email || !password) throw new CredentialsSignin();
    const user = await db.user.findUnique({ where: { email } });
    const ok = await verifyPassword(password, user?.passwordHash);
    if (!user || !ok) {
      // Small fixed delay blunts rapid guessing without leaking which part was wrong.
      await new Promise(r => setTimeout(r, 400));
      throw new CredentialsSignin();
    }
    if (!user.active) throw new CredentialsSignin();
    return { id: user.id, email: user.email, name: user.name, image: user.image, remember: raw?.remember === 'on' || raw?.remember === 'true' };
  },
});

const SESSION_DAYS = 30;
const SHORT_SESSION_HOURS = 12;

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  trustHost: true,
  // Token sessions are required for password sign-in; the adapter still stores users, Google accounts and magic-link tokens.
  session: { strategy: 'jwt', maxAge: SESSION_DAYS * 24 * 60 * 60 },
  pages: { signIn: '/signin', verifyRequest: '/signin/check-email', error: '/signin' },
  providers: [
    passwordProvider,
    ...(googleEnabled()
      ? [Google({ clientId: env().AUTH_GOOGLE_ID, clientSecret: env().AUTH_GOOGLE_SECRET, allowDangerousEmailAccountLinking: true })]
      : []),
    emailProvider,
  ],
  callbacks: {
    /** Only invited (existing, active) users, ADMIN_EMAILS, or ALLOWED_DOMAINS may sign in. */
    async signIn({ user }) {
      const email = (user.email ?? '').toLowerCase();
      if (!email) return '/signin?error=NoEmail';
      const existing = await db.user.findUnique({ where: { email } });
      if (existing) return existing.active ? true : '/signin?error=Inactive';
      const { admin, domain } = isPrivileged(email);
      return admin || domain ? true : '/signin?error=NotInvited';
    },
    /** "Remember me" off → the session ends after 12 hours instead of 30 days. Google and email links remember. */
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
        const remember = (user as { remember?: boolean }).remember !== false;
        token.expiresAt = Date.now() + (remember ? SESSION_DAYS * 86400000 : SHORT_SESSION_HOURS * 3600000);
      }
      if (typeof token.expiresAt === 'number' && Date.now() > token.expiresAt) return null;
      return token;
    },
    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (!user.id || !user.email) return;
      const { admin } = isPrivileged(user.email.toLowerCase());
      if (admin) await db.user.update({ where: { id: user.id }, data: { isAdmin: true } });
    },
    async signIn({ user }) {
      if (user.id) await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => {});
    },
  },
});
