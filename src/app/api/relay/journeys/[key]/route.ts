import { getRelayJourney } from '@/server/services/relay';
import { respond } from '../../respond';

export const dynamic = 'force-dynamic';

/** GET /api/relay/journeys/G04C05ST1J1 → that journey with its Creation stage. */
export async function GET(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return respond(req, () => getRelayJourney(key));
}
