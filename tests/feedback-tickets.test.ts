import { describe, expect, it } from 'vitest';
import { canChat, canCloseTicket, counterpart, severityTone, ticketAudience, ticketCode, ticketTitle } from '@/lib/feedback';
import type { ActorContext } from '@/lib/workflow';

const ctx = (over: Partial<ActorContext> = {}): ActorContext => ({ isAdmin: false, capabilities: new Set(), isAssignee: false, canEdit: true, ...over });
const party = { assigneeId: 'creator', ownerId: 'reviewer', developerId: 'dev' };

describe('feedback tickets', () => {
  it('numbers and titles', () => {
    expect(ticketCode(8905)).toBe('TICK-08905');
    expect(ticketCode(12)).toBe('TICK-00012');
    expect(ticketTitle('  Wrong sign ', 'x')).toBe('Wrong sign');
    expect(ticketTitle('', 'First line\nsecond')).toBe('First line');
    expect(ticketTitle(null, 'a'.repeat(100))).toHaveLength(68);
  });

  it('addresses the ticket to the other side', () => {
    expect(counterpart('reviewer', party)).toBe('creator');
    expect(counterpart('creator', party)).toBe('dev');
    expect(counterpart('creator', { ...party, developerId: null })).toBe('reviewer');
    expect(counterpart('dev', party)).toBe('creator');
    expect(counterpart('creator', { assigneeId: 'creator', ownerId: null, developerId: null })).toBeNull();
  });

  it('notifies both sides except the actor', () => {
    const t = { authorId: 'reviewer', toId: 'creator' };
    expect(ticketAudience(t, 'creator')).toEqual(['reviewer']);
    expect(ticketAudience(t, 'reviewer')).toEqual(['creator']);
    expect(ticketAudience({ authorId: 'a', toId: 'a' }, 'a')).toEqual([]);
  });

  it('lets involved people chat; only the author (or an admin) closes', () => {
    const t = { authorId: 'reviewer', toId: 'creator' };
    expect(canChat(ctx({ isAssignee: true }))).toBe(true);
    expect(canChat(ctx(), t, 'creator')).toBe(true);
    expect(canChat(ctx(), t, 'stranger')).toBe(false);
    expect(canCloseTicket(ctx(), t, 'reviewer')).toBe(true);
    expect(canCloseTicket(ctx({ isAssignee: true }), t, 'creator')).toBe(false);
    expect(canCloseTicket(ctx({ isAdmin: true }), t, 'admin')).toBe(true);
  });

  it('tones severity for both old and new words', () => {
    expect([severityTone('High'), severityTone('Blocker'), severityTone('Medium'), severityTone('Major'), severityTone('Low'), severityTone(null)]).toEqual(['bad', 'bad', 'warn', 'warn', 'neutral', 'neutral']);
  });
});
