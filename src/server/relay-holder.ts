import { isRelayHolder, relayHolderOf, type RelayHolder } from '@/lib/relay-holder';
import { db } from './db';
import type { Prisma } from '@prisma/client';

type Client = typeof db | Prisma.TransactionClient;

/**
 * The relay's holder of each journey, from the allocations the sync keeps (RelayEvent kind `allocation`, the holder's email in
 * `approver`; a release has none). A journey with no entry is not allocated on the relay, or was released.
 */
/** `userId`: that person here, when they are in People. */
export type RelayHolderHere = RelayHolder & { userId: string | null };

export async function relayHolders(itemIds: string[], client: Client = db): Promise<Map<string, RelayHolderHere>> {
  const out = new Map<string, RelayHolderHere>();
  if (!itemIds.length) return out;
  const rows = await client.relayEvent.findMany({ where: { itemId: { in: itemIds }, kind: 'allocation' }, orderBy: [{ at: 'asc' }, { createdAt: 'asc' }], select: { itemId: true, approver: true } });
  const latest = new Map(rows.map(r => [r.itemId, r.approver]));
  const emails = [...new Set([...latest.values()].filter((e): e is string => Boolean(e)))];
  if (!emails.length) return out;
  const people = await client.user.findMany({ where: { active: true }, select: { id: true, email: true, name: true } });
  for (const [itemId, email] of latest) {
    const holder = relayHolderOf(email, people);
    if (holder) out.set(itemId, { ...holder, userId: people.find(p => isRelayHolder(holder.email, p))?.id ?? null });
  }
  return out;
}
