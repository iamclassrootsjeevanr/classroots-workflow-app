import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFS, DENSITIES, FONT_SIZES, htmlAttrs, normalizePrefs, parsePrefsCookie, resolveTheme, serializePrefsCookie, THEMES, type Prefs } from '@/lib/prefs';

describe('preferences', () => {
  it('fills defaults for anything missing or invalid', () => {
    expect(normalizePrefs({})).toEqual(DEFAULT_PREFS);
    expect(normalizePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(normalizePrefs('junk')).toEqual(DEFAULT_PREFS);
    expect(normalizePrefs({ theme: 'purple', fontSize: 'large' })).toEqual({ ...DEFAULT_PREFS, fontSize: 'large' });
    expect(normalizePrefs({ theme: 'dark', fontSize: 'small', density: 'compact', extra: 1 })).toEqual({ theme: 'dark', fontSize: 'small', density: 'compact' });
  });

  it('round-trips every combination through the cookie', () => {
    for (const theme of THEMES)
      for (const fontSize of FONT_SIZES)
        for (const density of DENSITIES) {
          const p: Prefs = { theme, fontSize, density };
          expect(parsePrefsCookie(serializePrefsCookie(p))).toEqual(p);
        }
    expect(serializePrefsCookie({ theme: 'dark', fontSize: 'large', density: 'compact' })).toBe('dark.large.compact');
  });

  it('tolerates missing or broken cookies', () => {
    expect(parsePrefsCookie(undefined)).toEqual(DEFAULT_PREFS);
    expect(parsePrefsCookie('')).toEqual(DEFAULT_PREFS);
    expect(parsePrefsCookie('garbage==&&t=nope')).toEqual(DEFAULT_PREFS);
    expect(parsePrefsCookie('light')).toEqual({ ...DEFAULT_PREFS, theme: 'light' });
    expect(parsePrefsCookie('dark.large.compact')).toEqual({ theme: 'dark', fontSize: 'large', density: 'compact' });
    expect(parsePrefsCookie(encodeURIComponent('dark.large.compact'))).toEqual({ theme: 'dark', fontSize: 'large', density: 'compact' });
  });

  it('resolves the system theme and renders html attributes', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(htmlAttrs({ theme: 'system', fontSize: 'large', density: 'compact' })).toEqual({ 'data-theme-pref': 'system', 'data-theme': 'light', 'data-font': 'large', 'data-density': 'compact' });
    expect(htmlAttrs({ theme: 'dark', fontSize: 'default', density: 'comfortable' })['data-theme']).toBe('dark');
  });
});
