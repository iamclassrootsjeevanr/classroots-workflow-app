import type { Prisma } from '@prisma/client';
import type { TeamLite } from '@/lib/teams';
import { db } from './db';

type Client = Prisma.TransactionClient | typeof db;

export type TeamRow = Omit<TeamLite, 'members'> & { workTypeId: string; coordinatorName: string; reviewerName: string | null; members: (TeamLite['members'][number] & { name: string; peerReviewerName: string | null })[] };

const who = (u: { name: string | null; email: string | null } | null | undefined) => u?.name ?? u?.email ?? '?';

/** Teams of these work types, with names, members in name order. */
export async function loadTeams(client: Client, workTypeIds: string[]): Promise<TeamRow[]> {
  if (!workTypeIds.length) return [];
  const rows = await client.team.findMany({
    where: { workTypeId: { in: workTypeIds } },
    orderBy: { name: 'asc' },
    include: {
      coordinator: { select: { name: true, email: true } },
      reviewer: { select: { name: true, email: true } },
      members: { include: { user: { select: { name: true, email: true } }, peerReviewer: { select: { name: true, email: true } } } },
    },
  });
  return rows.map(t => ({
    id: t.id,
    workTypeId: t.workTypeId,
    name: t.name,
    coordinatorId: t.coordinatorId,
    coordinatorName: who(t.coordinator),
    reviewerId: t.reviewerId,
    reviewerName: t.reviewer ? who(t.reviewer) : null,
    members: t.members
      .map(m => ({ userId: m.userId, name: who(m.user), peerReviewerId: m.peerReviewerId, peerReviewerName: m.peerReviewer ? who(m.peerReviewer) : null }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }));
}

/** Chapter stewards: for each group, the people whose membership names it and whose role assigns work there. */
export async function loadStewards(client: Client, workTypeIds: string[]): Promise<Map<string, { userId: string; name: string }[]>> {
  const out = new Map<string, { userId: string; name: string }[]>();
  if (!workTypeIds.length) return out;
  const rows = await client.workTypeMember.findMany({
    where: { workTypeId: { in: workTypeIds }, NOT: { groupKeys: { isEmpty: true } }, user: { active: true }, roles: { some: { role: { capAssign: true, canEdit: true } } } },
    select: { workTypeId: true, groupKeys: true, userId: true, user: { select: { name: true, email: true } } },
  });
  for (const r of rows) {
    for (const g of r.groupKeys) {
      const key = `${r.workTypeId}:${g}`;
      out.set(key, [...(out.get(key) ?? []), { userId: r.userId, name: who(r.user) }].sort((a, b) => a.name.localeCompare(b.name)));
    }
  }
  return out;
}
