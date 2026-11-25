import { describe, expect, it } from 'vitest';
import { chapterCodeConflict, chapterMatches, chaptersByGrade, hasChapterName, parseChapterCode, parseRelayChapters, partLabel, relayChapterName } from '@/lib/chapter-codes';

describe('chapter codes', () => {
  it('reads a code with and without a part', () => {
    expect(parseChapterCode('G04C05')).toEqual({ grade: 4, part: null, chapterNo: 5 });
    expect(parseChapterCode('g07p1c03')).toEqual({ grade: 7, part: 1, chapterNo: 3 });
    expect(parseChapterCode('G04C05ST1J1')).toBeNull();
    expect(parseChapterCode('')).toBeNull();
  });

  it('writes the part as the chapter list does', () => {
    expect(partLabel(1)).toBe('Part I');
    expect(partLabel(2)).toBe('Part II');
    expect(partLabel(null)).toBeNull();
  });

  it('does not take the code for a name', () => {
    expect(hasChapterName('G07P1C03', 'G07P1C03')).toBe(false);
    expect(hasChapterName('G07P1C03', ' g07p1c03 ')).toBe(false);
    expect(hasChapterName('G07P1C03', '')).toBe(false);
    expect(hasChapterName('G07P1C03', null)).toBe(false);
    expect(hasChapterName('G07P1C03', 'A Peek Beyond the Point')).toBe(true);
  });

  it('finds a chapter by part of its code or its name', () => {
    const o = { code: 'G07P1C08', title: 'Working with Fractions' };
    expect(chapterMatches('', o)).toBe(true);
    expect(chapterMatches('g07', o)).toBe(true);
    expect(chapterMatches('fract', o)).toBe(true);
    expect(chapterMatches('g07 fractions', o)).toBe(true);
    expect(chapterMatches('g08 fractions', o)).toBe(false);
  });

  it('lists chapters under their grade, in order', () => {
    const groups = chaptersByGrade([
      { code: 'G07P2C01', title: 'Geometric Twins' },
      { code: 'G04C10', title: 'Elephants, Tigers, and Leopards' },
      { code: 'G07P1C03', title: 'A Peek Beyond the Point' },
      { code: 'G04C02', title: 'Hide and Seek' },
      { code: 'PILOT', title: 'Pilot' },
    ]);
    expect(groups.map(g => g.label)).toEqual(['Grade 4', 'Grade 7', 'Other']);
    expect(groups[0].options.map(o => o.code)).toEqual(['G04C02', 'G04C10']);
    expect(groups[1].options.map(o => o.code)).toEqual(['G07P1C03', 'G07P2C01']);
  });

  it('refuses a code without the part where the grade has parts', () => {
    const existing = ['G04C05', 'G07P1C03', 'G08P2C01'];
    expect(chapterCodeConflict('G07C03', existing)).toBe('Grade 7 codes carry the part of the book, like G07P1C03.');
    expect(chapterCodeConflict('G07P1C04', existing)).toBeNull();
    expect(chapterCodeConflict('G04C06', existing)).toBeNull();
    expect(chapterCodeConflict('G09C01', existing)).toBeNull();
  });

  it('reads the relay chapter list: CBSE chapters with a code and a title', () => {
    const reply = {
      stages: [],
      chapters: [
        { code: 'CBG04P1C05', title: ' Sharing and Measuring ', curriculum: 'cbse', grade: 'G4' },
        { code: 'MEG04P1C05', title: 'Pecahan', curriculum: 'merdeka' },
        { code: 'CBG07P1C03', title: '', curriculum: 'cbse' },
        { code: null, title: 'No code', curriculum: 'cbse' },
        { code: 'CBXX', title: 'Odd', curriculum: 'cbse' },
      ],
    };
    expect(parseRelayChapters(reply)).toEqual([{ code: 'CBG04P1C05', title: 'Sharing and Measuring' }]);
    expect(parseRelayChapters(null)).toEqual([]);
    expect(parseRelayChapters({ chapters: 'x' })).toEqual([]);
  });

  it('names a chapter from the relay list, and guesses nothing', () => {
    const relay = [
      { code: 'CBG03P1C02', title: 'Toy Joy' },
      { code: 'CBG07P1C03', title: 'A Peek Beyond the Point' },
      { code: 'CBG07P2C03', title: 'Finding Common Ground' },
      { code: 'CBG09P1C01', title: 'Orienting Yourself' },
      { code: 'CBG09P2C12', title: 'Quadrilaterals' },
    ];
    expect(relayChapterName('G07P1C03', relay)).toBe('A Peek Beyond the Point');
    expect(relayChapterName('G07P2C03', relay)).toBe('Finding Common Ground');
    // One part on the relay, no part here: the same chapter.
    expect(relayChapterName('G03C02', relay)).toBe('Toy Joy');
    // Two parts numbered on from each other: the number is enough.
    expect(relayChapterName('G09C12', relay)).toBe('Quadrilaterals');
    // Two parts with the same number: not known.
    expect(relayChapterName('G07C03', relay)).toBeNull();
    expect(relayChapterName('G09P1C12', relay)).toBeNull();
    expect(relayChapterName('G05C01', relay)).toBeNull();
    expect(relayChapterName('nonsense', relay)).toBeNull();
  });
});
