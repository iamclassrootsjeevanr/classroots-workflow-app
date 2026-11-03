import { PrismaAdapter } from '@auth/prisma-adapter';
import NextAuth, { CredentialsSignin, type DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { verifyPassword } from '@/lib/password';
import { db } from './db';
import { isOfficeEmail } from '@/lib/invite';
import { env, googleEnabled } from './env';

declare module 'next-auth' {
  interface Session {
    /** Only the id is trusted from the session; admin flag, access and active flag are re-read from the DB per request (rbac.ts). */
    user: { id: string } & DefaultSession['user'];
  }
}

const isAdminEmail = (email: string) => env().ADMIN_EMAILS.includes(email);

/** Email + password: the account must exist (added by an admin), be active and have a password set. */
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
  // Token sessions are required for password sign-in; the adapter still stores users and their linked Google accounts.
  session: { strategy: 'jwt', maxAge: SESSION_DAYS * 24 * 60 * 60 },
  pages: { signIn: '/signin', error: '/signin' },
  providers: [
    passwordProvider,
    ...(googleEnabled()
      ? [
          Google({
            clientId: env().AUTH_GOOGLE_ID,
            clientSecret: env().AUTH_GOOGLE_SECRET,
            allowDangerousEmailAccountLinking: true,
            // People often have a personal and a work Google account: always ask which one.
            authorization: { params: { prompt: 'select_account' } },
          }),
        ]
      : []),
  ],
  callbacks: {
    /**
     * Only people an admin added (existing, active) may sign in, plus ADMIN_EMAILS for the very first admin.
     * Google is for office emails (OFFICE_DOMAINS); everyone else uses email + password.
     */
    async signIn({ user, account }) {
      const email = (user.email ?? '').toLowerCase();
      if (!email) return '/signin?error=NoEmail';
      const office = env().OFFICE_DOMAINS;
      if (account?.provider === 'google' && office.length && !isOfficeEmail(email, office)) return '/signin?error=GoogleOfficeOnly';
      const existing = await db.user.findUnique({ where: { email } });
      if (existing) return existing.active ? true : '/signin?error=Inactive';
      return isAdminEmail(email) ? true : '/signin?error=NotInvited';
    },
    /** "Remember me" off → the session ends after 12 hours instead of 30 days. Google remembers. */
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
      if (isAdminEmail(user.email.toLowerCase())) await db.user.update({ where: { id: user.id }, data: { isAdmin: true } });
    },
    async signIn({ user }) {
      if (user.id) await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => {});
    },
  },
});
