import { describe, expect, it } from 'vitest';
import { relayAllocationChapters, relayCutJourneys, type CutCandidate } from '@/lib/relay-cut';

const base: CutCandidate = { key: 'G07P1C03ST1J3', status: 'allocated', archived: false, started: false, madeByRelay: true };
const relayKeys = new Set(['G07P1C03ST1J1', 'G07P1C03ST1J2']);
const chapters = new Set(['G07P1C03']);

describe('relayCutJourneys', () => {
  it('archives an untouched relay-made journey the relay no longer allocates', () => {
    expect(relayCutJourneys([base], relayKeys, chapters, 'allocated')).toEqual(['G07P1C03ST1J3']);
  });

  it('keeps a journey the relay still allocates', () => {
    expect(relayCutJourneys([{ ...base, key: 'G07P1C03ST1J1' }], relayKeys, chapters, 'allocated')).toEqual([]);
  });

  it('keeps a journey made here, started, or past the first status', () => {
    expect(relayCutJourneys([{ ...base, madeByRelay: false }], relayKeys, chapters, 'allocated')).toEqual([]);
    expect(relayCutJourneys([{ ...base, started: true }], relayKeys, chapters, 'allocated')).toEqual([]);
    expect(relayCutJourneys([{ ...base, status: 'creating' }], relayKeys, chapters, 'allocated')).toEqual([]);
    expect(relayCutJourneys([{ ...base, archived: true }], relayKeys, chapters, 'allocated')).toEqual([]);
  });

  it('archives nothing in a chapter the relay no longer allocates in, or when the reply is empty', () => {
    expect(relayCutJourneys([base], relayKeys, new Set(['G05C02']), 'allocated')).toEqual([]);
    expect(relayCutJourneys([base], new Set(), chapters, 'allocated')).toEqual([]);
  });
});

describe('relayAllocationChapters', () => {
  it('cuts chapter, subtopic and journey keys to their chapter', () => {
    expect([...relayAllocationChapters(['G04C05', 'G05C02ST1', 'g07p1c03st1j1', 'junk'])].sort()).toEqual(['G04C05', 'G05C02', 'G07P1C03']);
  });
});
