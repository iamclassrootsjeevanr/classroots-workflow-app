import { listRelayJourneys } from '@/server/services/relay';
import { respond } from '../respond';

export const dynamic = 'force-dynamic';

/** GET /api/relay/journeys[?chapter=G04C05] → every journey with its Creation stage. */
export async function GET(req: Request) {
  const chapter = new URL(req.url).searchParams.get('chapter') ?? undefined;
  return respond(req, async () => ({ journeys: await listRelayJourneys(chapter) }));
}
