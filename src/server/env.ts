import { z } from 'zod';

const list = z
  .string()
  .optional()
  .transform(s => (s ?? '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean));

const schema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  AUTH_SECRET: z.string().optional(),
  /** Public address of the app; links in emails point here. */
  AUTH_URL: z.string().default('http://localhost:3000'),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  EMAIL_SERVER: z.string().optional(),
  EMAIL_FROM: z.string().default('Classroots Work <no-reply@classroots.local>'),
  ADMIN_EMAILS: list,
  /** Office email domains (e.g. classrootsedu.com): these people sign in with Google; everyone else with email + password. */
  OFFICE_DOMAINS: list,
  APP_TIMEZONE: z.string().default('Asia/Kolkata'),
  APPS_SCRIPT_URL: z.string().optional(),
  SYNC_TOKEN: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  NODE_ENV: z.string().default('development'),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

/** Server-only configuration. Secrets here are never sent to the browser. */
export function env(): Env {
  if (!cached) cached = schema.parse(process.env);
  return cached;
}

export const googleEnabled = () => Boolean(env().AUTH_GOOGLE_ID && env().AUTH_GOOGLE_SECRET);
export const emailEnabled = () => Boolean(env().EMAIL_SERVER);
