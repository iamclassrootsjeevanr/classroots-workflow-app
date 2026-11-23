import { RelayError, setAppletFixes } from '@/server/services/relay';
import { respond } from '../../../respond';

export const dynamic = 'force-dynamic';

/** POST /api/relay/journeys/G06C07ST6J1/applet-fixes  {"fixed": 12, "total": 27, "reviewUrl": "https://…"}  (reviewUrl optional) */
export async function POST(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return respond(req, async () => {
    const body = (await req.json().catch(() => null)) as { fixed?: unknown; total?: unknown; reviewUrl?: unknown } | null;
    if (!body) throw new RelayError('Send JSON: {"fixed": 12, "total": 27}', 400);
    return setAppletFixes(key, body.fixed, body.total, body.reviewUrl);
  });
}
