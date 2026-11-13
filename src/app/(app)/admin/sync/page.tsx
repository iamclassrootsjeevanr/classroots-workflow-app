import Link from 'next/link';
import { SyncNowButton, SyncRelayButtons, SyncSettings } from '@/components/admin-controls';
import { Card, PageHeader } from '@/components/ui';
import { formatDateTime } from '@/lib/time';
import { getModule } from '@/modules/registry';
import { db } from '@/server/db';
import { env } from '@/server/env';
import { requireAdmin } from '@/server/rbac';
import { relayConfigured } from '@/server/relay/client';
import type { RelayReport } from '@/server/services/relay-sync';
import { appTz } from '@/server/settings';
import { syncDirection, workTypeConfig } from '@/server/services/work-items';

export const metadata = { title: 'Sheet sync' };

export default async function SyncPage() {
  await requireAdmin();
  const tz = appTz();
  const configured = Boolean(env().APPS_SCRIPT_URL);
  const types = (await db.workType.findMany({ where: { state: { not: 'ARCHIVED' } }, include: { syncState: true }, orderBy: { name: 'asc' } })).filter(t => getModule(t.key)?.sheet);
  const relayOn = relayConfigured();
  const relayState = await db.relaySyncState.findFirst({ include: { workType: { select: { name: true } } } });
  const relayReport = relayState?.report as RelayReport | undefined;
  const [conflicts, failed, pending, missing] = await Promise.all([
    db.workItemEvent.findMany({ where: { type: 'SYNC_CONFLICT' }, include: { item: { select: { id: true, externalKey: true, workType: { select: { key: true } } } } }, orderBy: { at: 'desc' }, take: 20 }),
    db.syncOutbox.findMany({ where: { OR: [{ status: 'FAILED' }, { status: 'PENDING', attempts: { gt: 0 } }] }, include: { item: { select: { externalKey: true } } }, orderBy: { createdAt: 'desc' }, take: 20 }),
    db.syncOutbox.count({ where: { status: 'PENDING' } }),
    db.workItem.findMany({ where: { sheetMissing: true }, select: { id: true, externalKey: true, title: true, workType: { select: { key: true } } }, take: 50 }),
  ]);

  return (
    <>
      <PageHeader title="Google Sheet sync" subtitle="The database is the source of truth. App → sheet keeps the sheet a copy of the app. Two-way also pulls sheet edits in; if both change the same cell, the app wins and the conflict is logged." />

      {!configured && (
        <p className="note-warn mb-4">
          APPS_SCRIPT_URL is not set in .env, so sync can’t run.
        </p>
      )}

      <div className="space-y-4">
        <Card title="Journey relay (live)" description="The relay feeds creation: who holds each journey, its Creation stage and approvals. Review and everything after it stay here. Pulled every few minutes by the scheduler.">
          {!relayOn && <p className="note-warn mb-3">RELAY_URL, RELAY_CF_CLIENT_ID and RELAY_CF_CLIENT_SECRET are not set in .env, so the relay can’t be read.</p>}
          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="label">Last run</div>
              {relayState ? formatDateTime(relayState.lastRunAt, tz) : 'never'}
            </div>
            <div>
              <div className="label">On the relay</div>
              {relayReport ? `${relayReport.allocated} journeys · ${relayReport.created.length} added` : '—'}
            </div>
            <div>
              <div className="label">Last changes</div>
              {relayReport ? `${relayReport.stageChanges.length} stage changes · ${relayReport.eventsAdded} events` : '—'}
            </div>
            <div>
              <div className="label">Needs a look</div>
              {relayReport ? (
                relayReport.errors.length + relayReport.unknownPeople.length + relayReport.creatorDiffers.length + relayReport.dashboardAhead.length ? (
                  <span className="text-warn">
                    {relayReport.errors.length} errors · {relayReport.unknownPeople.length} creators not in People · {relayReport.creatorDiffers.length} creators differ · {relayReport.dashboardAhead.length} ahead of the relay
                  </span>
                ) : (
                  <span className="text-ok">nothing</span>
                )
              ) : (
                '—'
              )}
            </div>
          </div>
          {relayReport && relayReport.unknownPeople.length > 0 && (
            <p className="mt-3 text-xs text-muted">Add these people in People (their email must match the relay), then sync again: {[...new Set(relayReport.unknownPeople.map(p => p.email))].join(', ')}</p>
          )}
          <div className="mt-4">
            <SyncRelayButtons disabled={!relayOn} />
          </div>
        </Card>
        {types.map(t => {
          const cfg = workTypeConfig(t).sync ?? {};
          const direction = syncDirection(t);
          const s = t.syncState;
          return (
            <Card key={t.id} title={t.name}>
              <SyncSettings id={t.id} enabled={Boolean(cfg.enabled)} tab={cfg.tab ?? getModule(t.key)!.sheet!.defaultTab} spreadsheetId={cfg.spreadsheetId ?? ''} direction={direction} configured={configured} />
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <div className="label">Last run</div>
                  {s?.lastRunAt ? formatDateTime(s.lastRunAt, tz) : 'never'}
                </div>
                <div>
                  <div className="label">Last success</div>
                  {s?.lastSuccessAt ? formatDateTime(s.lastSuccessAt, tz) : '—'}
                </div>
                <div>
                  <div className="label">Last result</div>
                  {!s
                    ? '—'
                    : direction === 'app-to-sheet'
                      ? `${s.pushed} cells written · ${s.pulled} rows read · ${s.created} rows to add · ${s.missing} only in the sheet`
                      : `${s.pushed} pushed · ${s.pulled} rows read · ${s.created} new · ${s.conflicts} conflicts · ${s.missing} missing`}
                </div>
                <div>
                  <div className="label">Error</div>
                  {s?.lastError ? <span className="text-bad">{s.lastError}</span> : <span className="text-ok">none</span>}
                </div>
              </div>
              <div className="mt-4">
                <SyncNowButton id={t.id} disabled={!configured || !cfg.enabled} />
              </div>
            </Card>
          );
        })}

        <Card title="Before you turn sync on">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
            <li>
              Paste the new <code>apps-script/Code.gs</code> into the sheet’s Apps Script editor.
            </li>
            <li>
              Project Settings → Script properties → add <code>SYNC_TOKEN</code> with the same value as in the app’s <code>.env</code>.
            </li>
            <li>Deploy → Manage deployments → pencil → New version → Deploy (the URL stays the same).</li>
            <li>Switch on “Sync with Google Sheet”, pick a direction (App → sheet unless the team still edits the sheet), save, then “Sync now”. The scheduler keeps it in sync every few minutes after that.</li>
          </ol>
          <p className="mt-2 text-xs text-muted">{pending} change(s) waiting to be written to the sheet.</p>
        </Card>

        {conflicts.length > 0 && (
          <Card title="Recent conflicts (app value kept)">
            <table className="table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Item</th>
                  <th>Column</th>
                  <th>Sheet had</th>
                  <th>App kept</th>
                </tr>
              </thead>
              <tbody>
                {conflicts.map(c => (
                  <tr key={c.id}>
                    <td className="whitespace-nowrap">{formatDateTime(c.at, tz)}</td>
                    <td>
                      <Link className="link font-mono text-xs" href={`/w/${c.item.workType.key}/${c.item.id}`}>
                        {c.item.externalKey}
                      </Link>
                    </td>
                    <td>{c.field}</td>
                    <td className="text-muted">{c.fromValue}</td>
                    <td>{c.toValue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {failed.length > 0 && (
          <Card title="Writes that failed">
            <ul className="text-sm">
              {failed.map(f => (
                <li key={f.id}>
                  <span className="font-mono text-xs">{f.item.externalKey}</span> · {f.column} = “{f.value}” · {f.attempts} attempts · <span className="text-bad">{f.lastError}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {missing.length > 0 && (
          <Card title={`In the app but not in the sheet (${missing.length})`}>
            <p className="mb-2 text-sm text-muted">These rows were deleted or re-keyed in the sheet. They are kept in the app – archive or fix them by hand.</p>
            <ul className="columns-2 text-sm">
              {missing.map(m => (
                <li key={m.id}>
                  <Link className="link font-mono text-xs" href={`/w/${m.workType.key}/${m.id}`}>
                    {m.externalKey}
                  </Link>{' '}
                  {m.title}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}
