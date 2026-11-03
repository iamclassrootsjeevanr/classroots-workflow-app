/** Centered card used by the forgot-password and reset-password pages (same look as the sign-in page). */
export function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="safe-bottom flex min-h-screen items-center justify-center bg-[radial-gradient(70%_45%_at_50%_0%,var(--brand-soft),transparent)] p-4">
      <div className="w-full max-w-md">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-lg font-bold text-white">C</div>
          <h1 className="text-xl font-semibold">Classroots Work</h1>
        </div>
        <div className="rounded-2xl border border-line bg-surface px-5 py-6 shadow-[var(--shadow-card)] sm:px-8 sm:py-7">
          <h2 className="mb-4 text-center text-md font-semibold">{title}</h2>
          {children}
        </div>
      </div>
    </main>
  );
}
