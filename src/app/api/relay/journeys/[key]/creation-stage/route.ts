import { RelayError, setCreationStage } from '@/server/services/relay';
import { respond } from '../../../respond';

export const dynamic = 'force-dynamic';

/** POST /api/relay/journeys/G04C05ST1J1/creation-stage  {"stage": "4 Build", "at": "2026-11-05T10:30:00+05:30"}  (at optional) */
export async function POST(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return respond(req, async () => {
    const body = (await req.json().catch(() => null)) as { stage?: unknown; at?: unknown } | null;
    if (!body) throw new RelayError('Send JSON: {"stage": "4 Build"}', 400);
    return setCreationStage(key, body.stage, body.at);
  });
}
