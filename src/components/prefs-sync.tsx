'use client';

import { useEffect } from 'react';
import { PREFS_COOKIE, serializePrefsCookie, type Prefs } from '@/lib/prefs';
import { writeCookie } from '@/lib/prefs-client';

/** Mirrors the signed-in user's saved preferences into the cookie (so a new device keeps them after sign-out). */
export function PrefsSync({ prefs, cookie }: { prefs: Prefs; cookie?: string }) {
  useEffect(() => {
    const want = serializePrefsCookie(prefs);
    if (cookie !== want) writeCookie(PREFS_COOKIE, want);
  }, [prefs, cookie]);
  return null;
}
