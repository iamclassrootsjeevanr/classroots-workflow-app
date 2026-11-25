import { describe, expect, it } from 'vitest';
import { isDueBy, isOverdue } from '@/lib/analytics-core';
import { apkTesting } from '@/modules/apk-testing/definition';
import { journeyApplet } from '@/modules/journey-applet/definition';

const load = async () => (await import('@/lib/items-where')).itemsWhere;

describe('items list filters run in the database', () => {
  const now = new Date('2026-11-03T10:00:00Z');
  it('has no conditions without filters', async () => {
    const itemsWhere = await load();
    expect(itemsWhere(apkTesting, {}, 'u1', now)).toEqual({});
  });
  it('turns a stage into its status keys and a list into an in-filter', async () => {
    const itemsWhere = await load();
    const w = itemsWhere(apkTesting, { cat: 'review', status: 'pass,fail' }, 'u1', now) as { AND: { status: { in: string[] } }[] };
    expect(w.AND[0].status.in.sort()).toEqual(['fail', 'pass']);
    expect(w.AND[1].status.in.sort()).toEqual(['fixed', 'pending_retest']);
  });
  it('overdue means past due and not done', async () => {
    const itemsWhere = await load();
    const w = itemsWhere(apkTesting, { scope: 'overdue' }, 'u1', now) as { AND: { dueAt: { lt: Date }; status: { notIn: string[] } }[] };
    expect(w.AND[0].dueAt.lt).toEqual(now);
    expect(w.AND[0].status.notIn).toEqual(['pass', 'closed']);
  });
  it('where the due date ends at approval, an approved item is not overdue (as on the tile)', async () => {
    const itemsWhere = await load();
    const w = itemsWhere(journeyApplet, { scope: 'overdue' }, 'u1', now) as { AND: { approvedAt?: null }[] };
    expect(w.AND[0].approvedAt).toBeNull();
    expect((itemsWhere(apkTesting, { scope: 'overdue' }, 'u1', now) as { AND: object[] }).AND[0]).not.toHaveProperty('approvedAt');
    const base = { category: 'approved' as const, dueAt: new Date('2026-11-01T00:00:00Z') };
    expect(isOverdue({ ...base, handedOff: true }, now)).toBe(false);
    expect(isOverdue({ ...base, handedOff: false }, now)).toBe(true);
  });
  it("holder = assignee or developer (My dashboard's tiles); due soon leaves out handed-off items", async () => {
    const itemsWhere = await load();
    expect(itemsWhere(journeyApplet, { holder: 'u2' }, 'u1', now)).toEqual({ AND: [{ OR: [{ assigneeId: { in: ['u2'] } }, { developerId: { in: ['u2'] } }] }] });
    const item = { category: 'active' as const, dueAt: new Date('2026-11-05T00:00:00Z') };
    const week = new Date('2026-11-10T00:00:00Z');
    expect(isDueBy(item, week)).toBe(true);
    expect(isDueBy({ ...item, handedOff: true }, week)).toBe(false);
    expect(isDueBy({ ...item, category: 'done' }, week)).toBe(false);
  });
  it('user = the person in any role; search = key, title or chapter', async () => {
    const itemsWhere = await load();
    expect(itemsWhere(apkTesting, { user: 'u2' }, 'u1', now)).toEqual({ AND: [{ OR: [{ assigneeId: { in: ['u2'] } }, { ownerId: { in: ['u2'] } }, { developerId: { in: ['u2'] } }] }] });
    const w = itemsWhere(apkTesting, { q: ' Login ' }, 'u1', now) as { AND: { AND: { OR: unknown[] }[] }[] };
    expect(w.AND[0].AND[0].OR).toContainEqual({ title: { contains: 'login', mode: 'insensitive' } });
  });
  it('mine = assigned to or owned by the person; unassigned = no assignee', async () => {
    const itemsWhere = await load();
    expect(itemsWhere(apkTesting, { scope: 'mine' }, 'u1', now)).toEqual({ AND: [{ OR: [{ assigneeId: 'u1' }, { ownerId: 'u1' }] }] });
    expect(itemsWhere(apkTesting, { dev: 'none' }, 'u1', now)).toEqual({ AND: [{ assigneeId: null }] });
  });
});
