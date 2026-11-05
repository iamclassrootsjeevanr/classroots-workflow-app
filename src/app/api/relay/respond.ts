import { NextResponse } from 'next/server';
import { PausedError } from '@/server/errors';
import { relayAuthorized, RelayError } from '@/server/services/relay';

/** Runs a relay request: Bearer RELAY_KEY required; errors become JSON with a status. */
export async function respond(req: Request, fn: () => Promise<unknown>) {
  if (!relayAuthorized(req.headers.get('authorization'))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json(await fn());
  } catch (e) {
    if (e instanceof RelayError) return NextResponse.json({ error: e.message }, { status: e.status });
    if (e instanceof PausedError) return NextResponse.json({ error: e.message }, { status: 409 });
    console.error('relay', e);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
