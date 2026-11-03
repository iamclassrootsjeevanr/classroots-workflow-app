import { describe, expect, it } from 'vitest';
import { apkTesting } from '@/modules/apk-testing/definition';

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
    expect(w.AND[0].status.notIn).toEqual(['pass']);
  });
  it('mine = assigned to or owned by the person; unassigned = no assignee', async () => {
    const itemsWhere = await load();
    expect(itemsWhere(apkTesting, { scope: 'mine' }, 'u1', now)).toEqual({ AND: [{ OR: [{ assigneeId: 'u1' }, { ownerId: 'u1' }] }] });
    expect(itemsWhere(apkTesting, { dev: 'none' }, 'u1', now)).toEqual({ AND: [{ assigneeId: null }] });
  });
});
