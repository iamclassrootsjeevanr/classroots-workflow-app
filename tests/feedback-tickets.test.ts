import { describe, expect, it } from 'vitest';
import { canChat, canCloseTicket, counterpart, severityTone, ticketAudience, ticketChoices, ticketCode, ticketReader, ticketTitle } from '@/lib/feedback';
import { linkLabel, linkParts } from '@/lib/links';
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

  it('lists who a ticket can go to: the people on the item, never the writer', () => {
    expect(ticketChoices('creator', party)).toEqual([{ id: 'reviewer', role: 'reviewer' }, { id: 'dev', role: 'developer' }]);
    expect(ticketChoices('qa', party).map(c => c.role)).toEqual(['creator', 'reviewer', 'developer']);
    expect(ticketChoices('qa', { assigneeId: 'a', ownerId: 'a', developerId: null })).toEqual([{ id: 'a', role: 'creator' }]);
  });

  it('sends a ticket to the person picked, and a send-back ticket to the person who gets the work', () => {
    // A creator can now reach the reviewer though a developer is assigned.
    expect(ticketReader('creator', party, { picked: 'reviewer' })).toBe('reviewer');
    expect(ticketReader('creator', party, {})).toBe('dev');
    // Someone who is not on the item, or the writer: the usual other side.
    expect(ticketReader('creator', party, { picked: 'stranger' })).toBe('dev');
    expect(ticketReader('creator', party, { picked: 'creator' })).toBe('dev');
    // A send-back overrides the pick.
    expect(ticketReader('qa', party, { picked: 'reviewer', sentBackTo: 'developer' })).toBe('dev');
    expect(ticketReader('qa', party, { picked: 'dev', sentBackTo: 'assignee' })).toBe('creator');
    expect(ticketReader('qa', { ...party, developerId: null }, { sentBackTo: 'developer' })).toBe('creator');
  });
});

describe('links in a ticket or a chat message', () => {
  it('splits text into text and links, in order', () => {
    expect(linkParts('no link here')).toEqual([{ type: 'text', text: 'no link here' }]);
    expect(linkParts('See https://example.org/a/b?x=1 and tell me.')).toEqual([
      { type: 'text', text: 'See ' },
      { type: 'link', url: 'https://example.org/a/b?x=1', label: 'example.org/a/b?x=1' },
      { type: 'text', text: ' and tell me.' },
    ]);
    expect(linkParts('https://a.org\nhttp://b.org').filter(p => p.type === 'link').map(p => (p as { url: string }).url)).toEqual(['https://a.org', 'http://b.org']);
  });
  it('leaves the end of a sentence out of the link', () => {
    expect(linkParts('Open https://example.org/x.').map(p => (p.type === 'link' ? p.url : p.text))).toEqual(['Open ', 'https://example.org/x', '.']);
    expect(linkParts('(see https://example.org/x)').map(p => (p.type === 'link' ? p.url : p.text))).toEqual(['(see ', 'https://example.org/x', ')']);
    expect(linkParts('https://example.org/a_(b)').map(p => (p.type === 'link' ? p.url : p.text))).toEqual(['https://example.org/a_(b)']);
  });
  it('makes a link of http and https only', () => {
    for (const text of ['javascript:alert(1)', 'ftp://example.org/x', 'www.example.org', 'mailto:a@b.org', 'https://']) expect(linkParts(text).every(p => p.type === 'text'), text).toBe(true);
  });
  it('shortens a long link for the chip', () => {
    expect(linkLabel('https://www.example.org/')).toBe('example.org');
    expect(linkLabel('https://uat.example.org/journey-composer/0123456789abcdef0123456789abcdef/edit')).toBe('uat.example.org/…/edit');
    expect(linkLabel('https://example.org/' + 'a'.repeat(80)).length).toBeLessThanOrEqual(48);
  });
});
