import Link from 'next/link';
import { notFound } from 'next/navigation';
import { StageEditor } from '@/components/stage-editor';
import { Card, PageHeader } from '@/components/ui';
import { baseModule } from '@/modules/registry';
import { requireAdmin } from '@/server/rbac';
import { stageScreen } from '@/server/stages';

export const metadata = { title: 'Stages' };

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default async function StagesPage({ params }: { params: Promise<{ key: string }> }) {
  await requireAdmin();
  const { key } = await params;
  if (!baseModule(key)) notFound();
  const { wt, mod, stages } = await stageScreen(key);
  const editable = stages.some(s => s.pipeline);

  return (
    <>
      <nav className="mb-2 text-sm text-muted">
        <Link href="/admin/work-types" className="link">
          Work types
        </Link>{' '}
        / {wt.name}
      </nav>
      <PageHeader
        title={`${wt.name} · stages`}
        subtitle={
          editable
            ? 'The flow in order. Rename any stage, set its time limit, pause or skip it, or add a stage after one that has a button. Stages that items have been in are skipped, never deleted, so history stays right.'
            : 'This work type’s stages are a fixed flow: you can rename them, change their colour and set time limits, but not pause, skip or add stages.'
        }
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_20rem]">
        <StageEditor workTypeId={wt.id} stages={stages} noun={mod.itemNoun} labels={{ assignee: mod.labels?.assignee ?? 'Assignee', owner: mod.labels?.owner ?? 'Owner', developer: mod.developerHandoff?.label }} />
        <div className="space-y-5">
          <Card title="How it works">
            <ul className="list-disc space-y-1.5 pl-4 text-sm text-muted">
              <li>
                <b className="text-ink">Active</b>: items move through it.
              </li>
              <li>
                <b className="text-ink">Paused</b>: items arrive and wait (shown as on hold) until you make it active again.
              </li>
              <li>
                <b className="text-ink">Skipped</b>: the button before it leads straight to the next active stage.
              </li>
              <li>Indented stages (↺) form a loop reached by their own buttons, e.g. asking for changes. They are fixed.</li>
              <li>Changes apply within seconds for everyone. The status key of a stage never changes.</li>
            </ul>
          </Card>
          <Card title="Calendar and limits">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-muted">Working days</dt>
              <dd>{mod.workDays ? mod.workDays.map(d => DAY_NAMES[d]).join(', ') : 'App calendar'}</dd>
              {Object.entries(mod.phaseLimits ?? {}).map(([k, p]) => (
                <div key={k} className="contents">
                  <dt className="text-muted">{p.label}</dt>
                  <dd>
                    {p.hours} working hours ({Math.round((p.hours / 9) * 10) / 10} days)
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}
