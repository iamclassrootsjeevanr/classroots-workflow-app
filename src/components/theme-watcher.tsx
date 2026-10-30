'use client';

import { useEffect } from 'react';

/** Keeps "system" theme in step with the device while the page is open. Renders nothing. */
export function ThemeWatcher() {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => {
      const d = document.documentElement;
      if (d.dataset.themePref === 'system') d.dataset.theme = mq.matches ? 'dark' : 'light';
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return null;
}
