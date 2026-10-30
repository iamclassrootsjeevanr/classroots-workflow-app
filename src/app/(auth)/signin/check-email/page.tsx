import Link from 'next/link';

export const metadata = { title: 'Check your email' };

export default function CheckEmail() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-brand">✉</div>
        <h1 className="text-lg font-semibold">Check your email</h1>
        <p className="mt-2 text-sm text-muted">We sent you a sign-in link. It works once and expires in 24 hours.</p>
        <Link href="/signin" className="link mt-4 inline-block text-sm">
          Use a different email
        </Link>
      </div>
    </main>
  );
}
