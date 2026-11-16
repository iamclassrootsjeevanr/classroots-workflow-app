import { describe, expect, it } from 'vitest';
import { buildBoard, columnOf, columnTotals, daysSince, gradeLabel, toneOf, type BoardInput } from '@/lib/relay-board';

const now = new Date('2026-11-16T12:00:00Z');
const ago = (d: number) => new Date(now.getTime() - d * 86_400_000);
const j = (over: Partial<BoardInput>): BoardInput => ({
  id: over.key ?? 'x', key: 'G06C07ST1J1', personId: 'u1', personName: 'Animesh', creationStage: null, publishStatus: null, since: null, finished: false, ...over,
});

describe('relay board', () => {
  it('places journeys in columns', () => {
    expect(columnOf(j({}))).toBe('new');
    expect(columnOf(j({ creationStage: '3a · Spine' }))).toBe('spine');
    expect(columnOf(j({ creationStage: '4 · Build' }))).toBe('build');
    expect(columnOf(j({ creationStage: '5 · Ship' }))).toBe('ship');
    expect(columnOf(j({ creationStage: '5 · Ship', publishStatus: 'up_for_review' }))).toBe('review');
    expect(columnOf(j({ creationStage: '5 · Ship', publishStatus: 'corrections_wip' }))).toBe('review');
    expect(columnOf(j({ creationStage: '5 · Ship', publishStatus: 'ready_for_student' }))).toBe('ready');
    expect(columnOf(j({ creationStage: 'Published' }))).toBe('ready');
    expect(columnOf(j({ creationStage: '4 · Build', finished: true }))).toBeNull();
  });

  it('counts whole days and tones by age', () => {
    expect(daysSince(ago(3.9), now)).toBe(3);
    expect(daysSince(ago(-1), now)).toBe(0);
    expect(daysSince(null, now)).toBeNull();
    expect([toneOf(1), toneOf(3), toneOf(5), toneOf(null)]).toEqual(['fresh', 'mid', 'old', 'none']);
  });

  it('groups not-started journeys by grade and sorts chips oldest first', () => {
    const rows = buildBoard(
      [
        j({ key: 'G07P1C03ST1J1' }),
        j({ key: 'G07P1C03ST1J2' }),
        j({ key: 'G06C07ST1J1' }),
        j({ key: 'G06C07ST2J1', creationStage: '4 · Build', since: ago(1) }),
        j({ key: 'G06C07ST2J2', creationStage: '4 · Build', since: ago(7) }),
        j({ key: 'G06C07ST3J1', creationStage: '5 · Ship', publishStatus: 'corrections_wip', since: ago(3) }),
        j({ key: 'G06C07ST4J1', creationStage: '4 · Build', finished: true }),
        j({ key: 'G04C05ST1J1', personId: null, personName: null, creationStage: '3a · Spine', since: ago(2) }),
      ],
      now,
    );
    expect(rows.map(r => r.name)).toEqual(['Animesh', 'Unassigned']);
    const a = rows[0]!;
    expect(a.total).toBe(6);
    expect(a.cells.new.groups).toEqual([{ label: 'G6', count: 1 }, { label: 'G7', count: 2 }]);
    expect(a.cells.build.chips.map(c => [c.key, c.days, c.tone])).toEqual([['G06C07ST2J2', 7, 'old'], ['G06C07ST2J1', 1, 'fresh']]);
    expect(a.cells.review.chips[0]).toMatchObject({ key: 'G06C07ST3J1', mark: 'c', tone: 'mid' });
    expect(columnTotals(rows)).toMatchObject({ new: 3, build: 2, review: 1, spine: 1, ready: 0 });
  });

  it('labels grades', () => {
    expect(gradeLabel('G07P1C03ST1J1')).toBe('G7');
    expect(gradeLabel('G10C01ST1J1')).toBe('G10');
    expect(gradeLabel('weird')).toBe('Other');
  });
});
