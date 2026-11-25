import { describe, expect, it } from 'vitest';
import { peopleNames } from '@/lib/role-names';

describe('people column names', () => {
  it('uses the role name of a single work type', () => {
    expect(peopleNames(['journey-applet', 'journey-applet'])).toEqual({ assignee: 'SME creator', owner: 'SME reviewer', accountable: 'Steward' });
    expect(peopleNames(['apk-testing']).assignee).toBe('Tester');
  });
  it('says User where work types are mixed or unknown', () => {
    expect(peopleNames(['journey-applet', 'apk-testing'])).toEqual({ assignee: 'User', owner: 'Reviewer', accountable: 'Steward' });
    expect(peopleNames([]).assignee).toBe('User');
  });
});
