import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/server/env';
import { runJobs } from '@/server/jobs';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Called by the scheduler (Docker) or Vercel Cron: sheet sync + workload snapshot. */
export async function GET(req: NextRequest) {
  const secret = env().CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    return NextResponse.json(await runJobs());
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
