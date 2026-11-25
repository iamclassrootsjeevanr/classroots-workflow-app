import { describe, expect, it } from 'vitest';
import { searchWhere } from '@/lib/items-where';
import { matchesSearch, searchWords } from '@/lib/search';
import { stewardMatches } from '@/lib/teams';

describe('search boxes', () => {
  const journey = ['G04C05ST1J1', 'more-people-smaller-shares', 'Sharing and Measuring', 'Manasa K', 'Arjun Singh'];

  it('finds part or all of a key or a name, in any case', () => {
    for (const q of ['g04c05', 'ST1J1', 'G04C05ST1J1', 'mana', 'Arjun Singh', 'measur']) expect(matchesSearch(q, journey), q).toBe(true);
    expect(matchesSearch('G07', journey)).toBe(false);
  });
  it('needs every word, in any field and order', () => {
    expect(matchesSearch('more people', journey)).toBe(true);
    expect(matchesSearch('singh G04C05', journey)).toBe(true);
    expect(matchesSearch('singh G07', journey)).toBe(false);
  });
  it('shows everything for a blank search', () => {
    expect(searchWords('   ')).toEqual([]);
    expect(matchesSearch(undefined, journey)).toBe(true);
    expect(searchWhere('  ')).toBeNull();
  });
  it('asks the database for each word in the keys, titles and people', () => {
    const where = searchWhere('arjun halves') as { AND: { OR: Record<string, unknown>[] }[] };
    expect(where.AND).toHaveLength(2);
    expect(where.AND[0].OR.map(c => Object.keys(c)[0]).sort()).toEqual(['assignee', 'chapter', 'developer', 'externalKey', 'groupKey', 'owner', 'title']);
  });
});

describe('searching a steward', () => {
  const teams = [{ id: 't1', workTypeId: 'w', name: 'Team A', coordinatorId: 'arjun', coordinatorName: 'Arjun Singh', reviewerId: null, members: [{ userId: 'kapil' }] }];
  const stewards = new Map([['w:G07', [{ name: 'Devjyoti Mondal' }]]]);

  it('finds the items of the coordinator’s team', () => {
    expect(stewardMatches('arj', teams, stewards)).toEqual([{ workTypeId: 'w', assigneeId: { in: ['arjun', 'kapil'] } }]);
  });
  it('finds a chapter steward’s items only where the creator has no team', () => {
    expect(stewardMatches('devj', teams, stewards)).toEqual([{ workTypeId: 'w', groupKey: 'G07', OR: [{ assigneeId: null }, { assigneeId: { notIn: ['arjun', 'kapil'] } }] }]);
  });
});
