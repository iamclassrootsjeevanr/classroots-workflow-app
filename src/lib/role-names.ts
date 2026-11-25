/** What to call the people on a table: the work type's own role names, or "User" where work types are mixed. */
import { getModule } from '@/modules/registry';

export type PeopleNames = { assignee: string; owner: string; accountable: string };

export function peopleNames(workTypeKeys: readonly string[]): PeopleNames {
  const mods = [...new Set(workTypeKeys)].map(k => getModule(k));
  const single = mods.length === 1 ? mods[0] : undefined;
  // The role that is given the work (Journey: SME creator, APK Testing: Tester).
  const role = single?.roles?.find(r => r.key === single.importRoles?.assignee)?.name;
  return {
    assignee: role ?? single?.labels?.assignee ?? 'User',
    owner: single?.labels?.owner ?? 'Reviewer',
    accountable: mods.find(m => m?.labels?.accountable)?.labels?.accountable ?? 'Owner',
  };
}
