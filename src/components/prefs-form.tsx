'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useState, useTransition } from 'react';
import { savePrefsAction, type ActionResult } from '@/app/actions';
import type { Prefs } from '@/lib/prefs';
import { applyPrefs } from '@/lib/prefs-client';
import { ActionMessage } from './controls';
import { Segmented } from './form';

function Row({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {help && <div className="text-xs text-muted">{help}</div>}
      </div>
      {children}
    </div>
  );
}

/** Appearance settings. Changes apply instantly on this device and are saved for every device. */
export function PrefsForm({ initial }: { initial: Prefs }) {
  const [v, setV] = useState(initial);
  const [, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const update = (patch: Partial<Prefs>) => {
    const next = { ...v, ...patch };
    setV(next);
    applyPrefs(next);
    start(async () => setResult(await savePrefsAction(next)));
  };
  return (
    <div className="divide-y divide-line">
      <Row label="Theme" help="System follows your device setting">
        <Segmented
          label="Theme"
          value={v.theme}
          onChange={theme => update({ theme })}
          options={[
            { value: 'light', label: 'Light', icon: <Sun size={14} aria-hidden="true" /> },
            { value: 'dark', label: 'Dark', icon: <Moon size={14} aria-hidden="true" /> },
            { value: 'system', label: 'System', icon: <Monitor size={14} aria-hidden="true" /> },
          ]}
        />
      </Row>
      <Row label="Text size" help="Scales everything, including tables and charts">
        <Segmented
          label="Text size"
          value={v.fontSize}
          onChange={fontSize => update({ fontSize })}
          options={[
            { value: 'small', label: 'Small' },
            { value: 'default', label: 'Default' },
            { value: 'large', label: 'Large' },
          ]}
        />
      </Row>
      <Row label="Density" help="Compact fits more rows on screen">
        <Segmented
          label="Density"
          value={v.density}
          onChange={density => update({ density })}
          options={[
            { value: 'comfortable', label: 'Comfortable' },
            { value: 'compact', label: 'Compact' },
          ]}
        />
      </Row>
      <div className="pt-2">
        <ActionMessage result={result} />
      </div>
    </div>
  );
}
