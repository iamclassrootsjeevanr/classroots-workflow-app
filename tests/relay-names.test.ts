import { describe, expect, it } from 'vitest';
import type { FeedEvent } from '@/lib/relay-contract';
import { journeyNameUpdates, lacksJourneyName, relayJourneyNames } from '@/lib/relay-names';

const ev = (key: string, name: unknown, entity = 'journey_state'): FeedEvent => ({ seq: 's', source: 'states', id: 1, at: '', by: null, entity, op: 'update', key, data: { name } });

describe('relayJourneyNames', () => {
  it('keeps the latest slug per journey', () => {
    expect(relayJourneyNames([ev('G07P1C03ST1J2', 'G07P1C03ST1J2_naming-a-length'), ev('G07P1C03ST1J2', 'G07P1C03ST1J2_why-always-ten'), ev('G04C05ST1J1', 'G04C05ST1J1_halves')])).toEqual({
      G07P1C03ST1J2: 'why-always-ten',
      G04C05ST1J1: 'halves',
    });
  });

  it('skips rows with no name, the bare key, or another entity', () => {
    expect(relayJourneyNames([ev('G05C02ST1J1', null), ev('G05C02ST1J2', 'G05C02ST1J2'), ev('G05C02ST1J3', 'G05C02ST1J3_x', 'subtopic_state')])).toEqual({});
  });

  it('adds to names read before', () => {
    expect(relayJourneyNames([ev('G04C05ST1J2', 'G04C05ST1J2_quarters')], { G04C05ST1J1: 'halves' })).toEqual({ G04C05ST1J1: 'halves', G04C05ST1J2: 'quarters' });
  });
});

describe('journeyNameUpdates', () => {
  const names = { G08P2C01ST1J1: 'brahmaguptas-formula', G05C02ST1J1: 'same-whole-2' };

  it('names a journey whose name is empty or its key', () => {
    expect(journeyNameUpdates([{ key: 'G08P2C01ST1J1', title: 'G08P2C01ST1J1' }], names, {})).toEqual([{ key: 'G08P2C01ST1J1', from: 'G08P2C01ST1J1', to: 'brahmaguptas-formula' }]);
    expect(lacksJourneyName('G08P2C01ST1J1', '  ')).toBe(true);
  });

  it('never changes a name given here', () => {
    expect(journeyNameUpdates([{ key: 'G05C02ST1J1', title: 'same-whole' }], names, {})).toEqual([]);
  });

  it("follows a rename while the name is still the relay's earlier one", () => {
    expect(journeyNameUpdates([{ key: 'G05C02ST1J1', title: 'same-whole' }], names, { G05C02ST1J1: 'same-whole' })).toEqual([{ key: 'G05C02ST1J1', from: 'same-whole', to: 'same-whole-2' }]);
  });
});
