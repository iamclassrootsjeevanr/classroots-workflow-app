import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { ThemeWatcher } from '@/components/theme-watcher';
import { htmlAttrs, normalizePrefs, parsePrefsCookie, PREFS_COOKIE } from '@/lib/prefs';
import { THEME_SCRIPT } from '@/lib/theme-script';
import { currentUser } from '@/server/rbac';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Classroots Work', template: '%s · Classroots Work' },
  description: 'Work tracking, review and analytics for Classroots teams.',
  applicationName: 'Classroots Work',
  appleWebApp: { capable: true, title: 'Classroots Work', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#1565c0' },
    { media: '(prefers-color-scheme: dark)', color: '#0e1217' },
  ],
};

/** Theme, text size and density come from the signed-in user's saved preferences, else from the cookie. */
async function pagePrefs() {
  const cookie = (await cookies()).get(PREFS_COOKIE)?.value;
  try {
    const user = await currentUser();
    if (user) return normalizePrefs(user.prefs);
  } catch {
    // a broken session cookie must not take the page down
  }
  return parsePrefsCookie(cookie);
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const prefs = await pagePrefs();
  return (
    <html lang="en" suppressHydrationWarning {...htmlAttrs(prefs)}>
      <head>
        {/* Resolves "system" before first paint so there is no flash of the wrong theme */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {/* Loaded at runtime (not at build) so an offline build still succeeds; the system font stack is the fallback. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap" />
      </head>
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        <ThemeWatcher />
        {children}
      </body>
    </html>
  );
}
