import { describe, expect, it } from 'vitest';
import { shortKey, timeAgo, undoDeadline, undoMinutesLeft, undoOpen } from '@/lib/notifications-core';

const now = new Date('2026-11-02T10:00:00Z');
const deleted = (undoUntil: string) => ({ kind: 'item.deleted', data: { undoUntil } });

describe('inbox helpers', () => {
  it('offers Undo on a delete notice until its deadline', () => {
    const until = undoDeadline(now).toISOString();
    expect(until).toBe('2026-11-02T10:30:00.000Z');
    expect(undoOpen(deleted(until), new Date('2026-11-02T10:10:00Z'))).toBe(true);
    expect(undoOpen(deleted(until), new Date('2026-11-02T10:31:00Z'))).toBe(false);
    expect(undoMinutesLeft(deleted(until), new Date('2026-11-02T10:10:30Z'))).toBe(20);
  });
  it('never offers Undo on other kinds or broken data', () => {
    expect(undoOpen({ kind: 'item.restored', data: { undoUntil: '2030-01-01T00:00:00Z' } }, now)).toBe(false);
    expect(undoOpen({ kind: 'item.deleted', data: {} }, now)).toBe(false);
  });
  it('shortens keys and ages', () => {
    expect(shortKey('2.0.1.14_2026-09-04 | TC_010')).toBe('TC_010');
    expect(shortKey('G07C04J05')).toBe('G07C04J05');
    expect(timeAgo('2026-11-02T09:59:40Z', now)).toBe('just now');
    expect(timeAgo('2026-11-02T09:15:00Z', now)).toBe('45 min ago');
    expect(timeAgo('2026-10-30T10:00:00Z', now)).toBe('3 days ago');
  });
});
