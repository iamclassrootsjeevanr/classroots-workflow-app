import { applyStageConfig, type StageRow } from '@/lib/stages';
import { apkTesting } from './apk-testing/definition';
import { journeyApplet } from './journey-applet/definition';
import type { StatusDef, WorkTypeDefinition } from './types';

/**
 * Every work type the platform knows about. To add a new kind of work:
 * 1. create src/modules/<key>/definition.ts exporting a WorkTypeDefinition
 * 2. add it to this list
 * 3. enable it from Admin → Work types (creates the WorkType row)
 *
 * The definitions here are the code defaults. What the app uses is the effective definition: the defaults with the admin's
 * stage changes applied (src/lib/stages.ts), refreshed from the database by src/server/stages.ts.
 */
const BASE: WorkTypeDefinition[] = [journeyApplet, apkTesting];

const baseByKey = new Map(BASE.map(m => [m.key, m]));
const effective = new Map(BASE.map(m => [m.key, applyStageConfig(m, [])]));

export function allModules(): WorkTypeDefinition[] {
  return BASE.map(m => effective.get(m.key)!);
}

export function getModule(key: string): WorkTypeDefinition | undefined {
  return effective.get(key);
}

export function requireModule(key: string): WorkTypeDefinition {
  const mod = effective.get(key);
  if (!mod) throw new Error(`Unknown work type module: ${key}`);
  return mod;
}

/** The module as written in code, before any admin stage changes. */
export function baseModule(key: string): WorkTypeDefinition | undefined {
  return baseByKey.get(key);
}

/** Replace a work type's stage configuration (called with that work type's WorkflowStage rows). */
export function setStageRows(key: string, rows: StageRow[]) {
  const base = baseByKey.get(key);
  if (base) effective.set(key, applyStageConfig(base, rows));
}

export function statusDef(mod: WorkTypeDefinition, key: string): StatusDef {
  return (
    mod.statuses.find(s => s.key === key) ?? { key, label: key, color: '#9e9e9e', category: 'queue' }
  );
}
