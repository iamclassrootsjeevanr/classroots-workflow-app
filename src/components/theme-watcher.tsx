'use client';

import { useEffect } from 'react';
import { resolveTheme, type Theme } from '@/lib/prefs';

/**
 * Keeps data-theme in step with the preference and, for "system", with the device. Renders nothing.
 * Re-runs when the server sends a different preference (e.g. after sign-in): React leaves data-theme
 * alone when its server value is unchanged, even if the inline script had resolved "system" to dark.
 */
export function ThemeWatcher({ theme }: { theme: Theme }) {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => {
      const d = document.documentElement;
      d.dataset.theme = resolveTheme((d.dataset.themePref as Theme | undefined) ?? theme, mq.matches);
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [theme]);
  return null;
}
