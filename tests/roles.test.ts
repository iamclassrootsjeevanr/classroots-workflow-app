import { describe, expect, it } from 'vitest';
import { allModules } from '@/modules/registry';
import { flowCapabilities, rolesForModule } from '@/modules/roles';
import type { WorkTypeDefinition } from '@/modules/types';

describe('roles follow the flow', () => {
  for (const mod of allModules()) {
    describe(mod.key, () => {
      const roles = rolesForModule(mod);
      it('has unique role keys and a viewer', () => {
        expect(new Set(roles.map(r => r.key)).size).toBe(roles.length);
        expect(roles.some(r => !r.canEdit)).toBe(true);
      });
      it('lets someone do every step of the flow', () => {
        const granted = new Set(roles.flatMap(r => r.capabilities));
        for (const need of flowCapabilities(mod)) {
          if (need === 'ASSIGNEE') expect(granted.has('work'), `${mod.key}: nobody can work on items`).toBe(true);
          else expect(granted.has(need), `${mod.key}: no role has "${need}"`).toBe(true);
        }
      });
      it('has roles for the people the sheet import creates', () => {
        const keys = new Set(roles.map(r => r.key));
        expect(keys.has(mod.importRoles?.assignee ?? [...keys][0])).toBe(true);
        if (mod.importRoles?.owner) expect(keys.has(mod.importRoles.owner)).toBe(true);
      });
    });
  }

  it('derives roles from the flow when a module declares none', () => {
    const base = allModules()[0];
    const bare = { ...base, roles: undefined, labels: { assignee: 'Builder' } } as WorkTypeDefinition;
    const roles = rolesForModule(bare);
    expect(roles.map(r => r.key)).toEqual(expect.arrayContaining(['worker', 'coordinator', 'viewer']));
    expect(roles.find(r => r.key === 'worker')?.name).toBe('Builder');
  });
});
