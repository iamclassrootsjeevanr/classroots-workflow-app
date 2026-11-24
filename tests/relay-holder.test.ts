import { describe, expect, it } from 'vitest';
import { allocationEventId, isRelayHolder, relayHolderNote, relayHolderOf } from '@/lib/relay-holder';

const kapil = { email: 'kapil@classrootsedu.com', name: 'Kapil' };
const krishna = { email: 'krishna@classrootsedu.com', name: 'Krishna Rander' };
const people = [kapil, krishna, { email: null, name: 'No Email' }];

describe('the relay holder of a journey against its creator here', () => {
  it('knows the holder by email, or by the name the relay email spells', () => {
    expect(isRelayHolder('Kapil@classrootsedu.com', kapil)).toBe(true);
    expect(isRelayHolder('krishna.rander@classrootsedu.com', krishna)).toBe(true); // the relay's email differs from the one here
    expect(isRelayHolder('kapil@classrootsedu.com', krishna)).toBe(false);
    expect(isRelayHolder('', { email: null, name: null })).toBe(false);
  });
  it('names the holder as the dashboard knows them, else as the email spells', () => {
    expect(relayHolderOf('krishna.rander@classrootsedu.com', people)).toEqual({ email: 'krishna.rander@classrootsedu.com', name: 'Krishna Rander' });
    expect(relayHolderOf('KAPIL@classrootsedu.com', people)).toEqual({ email: 'kapil@classrootsedu.com', name: 'Kapil' });
    expect(relayHolderOf('new.person@classrootsedu.com', people)).toEqual({ email: 'new.person@classrootsedu.com', name: 'New Person' });
    expect(relayHolderOf(null, people)).toBeNull(); // released on the relay
    expect(relayHolderOf('not-an-email', people)).toBeNull();
  });
  it('says who to ask when the creator here is someone else', () => {
    const holder = relayHolderOf('kapil@classrootsedu.com', people);
    expect(relayHolderNote('G05C02ST2J1', holder, krishna)).toBe('Relay holder: Kapil. Ask an allocator to allocate G05C02ST2J1 to Krishna Rander.');
    expect(relayHolderNote('G05C02ST2J1', holder, { email: 'x@classrootsedu.com', name: null })).toBe('Relay holder: Kapil. Ask an allocator to allocate G05C02ST2J1 to x@classrootsedu.com.');
  });
  it('says nothing when they agree, when the relay holds it for nobody, or when nobody is on it here', () => {
    const holder = relayHolderOf('kapil@classrootsedu.com', people);
    expect(relayHolderNote('G05C02ST2J1', holder, kapil)).toBeNull();
    expect(relayHolderNote('G05C02ST2J1', relayHolderOf('krishna.rander@classrootsedu.com', people), krishna)).toBeNull();
    expect(relayHolderNote('G05C02ST2J1', null, krishna)).toBeNull();
    expect(relayHolderNote('G05C02ST2J1', holder, null)).toBeNull();
  });
  it('keeps one row per holder and time', () => {
    const at = new Date('2026-11-20T09:00:00Z');
    expect(allocationEventId('G05C02ST2J1', 'kapil@classrootsedu.com', at)).toBe('allocation:G05C02ST2J1:2026-11-20T09:00:00.000Z:kapil@classrootsedu.com');
    expect(allocationEventId('G05C02ST2J1', null, null)).toBe('allocation:G05C02ST2J1:-:-');
  });
});
