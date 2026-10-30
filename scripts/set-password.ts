/**
 * Set a user's password from the terminal (e.g. the first admin on a fresh server with no email set up).
 * Creates the user as an admin if the email is listed in ADMIN_EMAILS and doesn't exist yet.
 *
 *   npm run user:password -- you@company.com
 */
import { createInterface } from 'node:readline/promises';
import { hashPassword, passwordProblem } from '../src/lib/password';
import { db } from '../src/server/db';
import { env } from '../src/server/env';

async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  // Hide typed characters.
  const write = (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput.bind(rl);
  (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = s => write(s.startsWith(question) ? s : '*');
  const answer = await rl.question(question);
  rl.close();
  process.stdout.write('\n');
  return answer;
}

async function main() {
  const email = (process.argv[2] ?? '').trim().toLowerCase();
  if (!email) throw new Error('Usage: npm run user:password -- you@company.com');
  let user = await db.user.findUnique({ where: { email } });
  if (!user) {
    if (!env().ADMIN_EMAILS.includes(email)) throw new Error(`${email} is not a user. Invite them from Admin → People first.`);
    user = await db.user.create({ data: { email, name: email.split('@')[0], isAdmin: true, active: true } });
    console.log(`Created admin ${email}.`);
  }
  const password = await ask('New password: ');
  const repeat = await ask('Repeat password: ');
  if (password !== repeat) throw new Error('Passwords do not match.');
  const problem = passwordProblem(password, email);
  if (problem) throw new Error(problem);
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password), passwordUpdatedAt: new Date(), active: true } });
  console.log(`Password set for ${email}.`);
}

main()
  .catch(e => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
