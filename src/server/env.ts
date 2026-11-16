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
  /** Key the journey relay (Claude) sends to /api/relay: it can only read journeys and set their Creation stage. */
  RELAY_KEY: z.string().optional(),
  /** The live journey relay (buildjourneyrelay): MCP endpoint and a Cloudflare Access service token. All three set = relay sync is on. */
  RELAY_URL: z.string().optional(),
  RELAY_CF_CLIENT_ID: z.string().optional(),
  RELAY_CF_CLIENT_SECRET: z.string().optional(),
  /** `sso` = use a person's Cloudflare Access login (`cloudflared access token`; local testing, expires). Default: the service token. */
  RELAY_AUTH: z.string().optional(),
  /** SSO only: the HOME that holds the `.cloudflared` login (the RELAY seat's `.seat` folder). */
  RELAY_SSO_HOME: z.string().optional(),
  /** "on" lets admins view the app as any person (Admin testing). Default: on everywhere except production. */
  VIEW_AS: z.string().optional(),
  NODE_ENV: z.string().default('development'),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

/** Server-only configuration. Secrets here are never sent to the browser. */
export function env(): Env {
  if (!cached) cached = schema.parse(process.env);
  return cached;
}

export const viewAsEnabled = () => (env().VIEW_AS ? env().VIEW_AS === 'on' : env().NODE_ENV !== 'production');
export const googleEnabled = () => Boolean(env().AUTH_GOOGLE_ID && env().AUTH_GOOGLE_SECRET);
export const emailEnabled = () => Boolean(env().EMAIL_SERVER);
