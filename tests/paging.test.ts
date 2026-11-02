import { describe, expect, it } from 'vitest';
import { capPerType, pageOf } from '@/lib/paging';

describe('paging', () => {
  const list = Array.from({ length: 120 }, (_, i) => i);
  it('slices pages and clamps out-of-range pages', () => {
    expect(pageOf(list, 1).rows).toHaveLength(50);
    expect(pageOf(list, 3)).toMatchObject({ page: 3, pages: 3, from: 101, to: 120 });
    expect(pageOf(list, 99).page).toBe(3);
    expect(pageOf([], 1)).toMatchObject({ pages: 1, from: 0, to: 0 });
  });
  it('caps each work type separately', () => {
    const items = [...Array(70).fill({ workTypeKey: 'a' }), ...Array(10).fill({ workTypeKey: 'b' })];
    const out = capPerType(items);
    expect(out.filter(i => i.workTypeKey === 'a')).toHaveLength(50);
    expect(out.filter(i => i.workTypeKey === 'b')).toHaveLength(10);
  });
});
