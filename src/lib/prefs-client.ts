import { COOKIE_MAX_AGE, PREFS_COOKIE, resolveTheme, serializePrefsCookie, type Prefs } from './prefs';

export function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
}

/** Apply preferences to the page immediately (no reload) and remember them in the cookie. */
export function applyPrefs(p: Prefs) {
  const d = document.documentElement;
  d.dataset.themePref = p.theme;
  d.dataset.theme = resolveTheme(p.theme, window.matchMedia('(prefers-color-scheme: dark)').matches);
  d.dataset.font = p.fontSize;
  d.dataset.density = p.density;
  writeCookie(PREFS_COOKIE, serializePrefsCookie(p));
}
