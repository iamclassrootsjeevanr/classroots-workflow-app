import { apkTesting } from './apk-testing/definition';
import { journeyApplet } from './journey-applet/definition';
import type { StatusDef, WorkTypeDefinition } from './types';

/**
 * Every work type the platform knows about. To add a new kind of work:
 * 1. create src/modules/<key>/definition.ts exporting a WorkTypeDefinition
 * 2. add it to this list
 * 3. enable it from Admin → Work types (creates the WorkType row)
 */
const MODULES: WorkTypeDefinition[] = [journeyApplet, apkTesting];

const byKey = new Map(MODULES.map(m => [m.key, m]));

export function allModules(): WorkTypeDefinition[] {
  return MODULES;
}

export function getModule(key: string): WorkTypeDefinition | undefined {
  return byKey.get(key);
}

export function requireModule(key: string): WorkTypeDefinition {
  const mod = byKey.get(key);
  if (!mod) throw new Error(`Unknown work type module: ${key}`);
  return mod;
}

export function statusDef(mod: WorkTypeDefinition, key: string): StatusDef {
  return (
    mod.statuses.find(s => s.key === key) ?? { key, label: key, color: '#9e9e9e', category: 'queue' }
  );
}
