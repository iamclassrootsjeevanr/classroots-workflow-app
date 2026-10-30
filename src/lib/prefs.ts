import { z } from 'zod';

/**
 * Per-user UI preferences. Stored on User.prefs (authoritative when signed in) and mirrored in a
 * cookie so the sign-in page and the very first paint already use them.
 */
export const PREFS_COOKIE = 'cr_prefs';
export const NAV_COOKIE = 'cr_nav';
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const THEMES = ['light', 'dark', 'system'] as const;
export const FONT_SIZES = ['small', 'default', 'large'] as const;
export const DENSITIES = ['comfortable', 'compact'] as const;

export const PrefsSchema = z.object({
  theme: z.enum(THEMES).default('system'),
  fontSize: z.enum(FONT_SIZES).default('default'),
  density: z.enum(DENSITIES).default('comfortable'),
});
export type Prefs = z.infer<typeof PrefsSchema>;
export type Theme = Prefs['theme'];

export const DEFAULT_PREFS: Prefs = PrefsSchema.parse({});

/** Accepts anything (DB Json, parsed cookie). Each unknown or invalid field falls back to its default. */
export function normalizePrefs(raw: unknown): Prefs {
  const r = PrefsSchema.safeParse(raw ?? {});
  if (r.success) return r.data;
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    theme: THEMES.includes(o.theme as Theme) ? (o.theme as Theme) : DEFAULT_PREFS.theme,
    fontSize: FONT_SIZES.includes(o.fontSize as Prefs['fontSize']) ? (o.fontSize as Prefs['fontSize']) : DEFAULT_PREFS.fontSize,
    density: DENSITIES.includes(o.density as Prefs['density']) ? (o.density as Prefs['density']) : DEFAULT_PREFS.density,
  };
}

/** Cookie value "dark.large.compact" – plain letters and dots, so no URL encoding is ever needed. */
export function serializePrefsCookie(p: Prefs): string {
  return `${p.theme}.${p.fontSize}.${p.density}`;
}

export function parsePrefsCookie(value: string | undefined | null): Prefs {
  let v = value ?? '';
  try {
    v = decodeURIComponent(v);
  } catch {
    // keep as is
  }
  const [theme, fontSize, density] = v.split('.');
  return normalizePrefs({ theme: theme || undefined, fontSize: fontSize || undefined, density: density || undefined });
}

export const resolveTheme = (theme: Theme, systemDark: boolean): 'light' | 'dark' => (theme === 'system' ? (systemDark ? 'dark' : 'light') : theme);

/** Attributes for <html>; "system" renders light on the server and the inline script fixes it before paint. */
export function htmlAttrs(p: Prefs) {
  return { 'data-theme-pref': p.theme, 'data-theme': p.theme === 'system' ? 'light' : p.theme, 'data-font': p.fontSize, 'data-density': p.density } as const;
}
