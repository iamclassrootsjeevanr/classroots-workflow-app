import { describe, expect, it } from 'vitest';
import { apkTesting } from '@/modules/apk-testing/definition';
import { reviewFlow as journeyApplet } from './fixtures/review-flow';
import { flowLite, rolePreview } from '@/lib/role-preview';

const journey = flowLite(journeyApplet);
const apk = flowLite(apkTesting);

describe('role preview', () => {
  it('serialises a module without functions', () => {
    expect(JSON.parse(JSON.stringify(journey))).toEqual(journey);
    expect(journey.statuses[0]).toMatchObject({ key: 'received', label: 'Received from SME' });
  });

  it('a view-only role unlocks nothing', () => {
    const p = rolePreview(journey, { capabilities: ['work', 'review'], canEdit: false, dataScope: 'ALL' });
    expect(p.moves).toEqual([]);
    expect(p.fields).toEqual([]);
    expect(p.canComment).toBe(false);
  });

  it('a developer role gets the assignee moves, marked as own items only', () => {
    const p = rolePreview(journey, { capabilities: ['work'], canEdit: true, dataScope: 'OWN' });
    expect(p.moves.map(m => m.label)).toContain('Start');
    expect(p.moves.map(m => m.label)).toContain('Submit for review');
    expect(p.moves.map(m => m.label)).not.toContain('Approve');
    expect(p.moves.every(m => m.onlyOwnItems)).toBe(true);
    expect(p.fields.map(f => f.key)).toEqual(['cmsUrl', 'aiTutorUrl', 'buildUrl', 'notes']);
  });

  it('a reviewer role gets review moves on any item', () => {
    const p = rolePreview(apk, { capabilities: ['review'], canEdit: true, dataScope: 'ALL' });
    expect(p.moves.map(m => m.label)).toContain('Mark fixed (developer)');
    expect(p.moves.find(m => m.label === 'Mark fixed (developer)')?.onlyOwnItems).toBe(false);
    expect(p.fields.map(f => f.key)).toEqual(['developerRemarks']);
  });

  it('"Mark done" is shared: an assignee-only role still needs it to be their item', () => {
    const dev = rolePreview(journey, { capabilities: ['work'], canEdit: true, dataScope: 'OWN' });
    const lead = rolePreview(journey, { capabilities: ['work', 'review'], canEdit: true, dataScope: 'ALL' });
    expect(dev.moves.find(m => m.label === 'Mark done')?.onlyOwnItems).toBe(true);
    expect(lead.moves.find(m => m.label === 'Mark done')?.onlyOwnItems).toBe(false);
  });
});
