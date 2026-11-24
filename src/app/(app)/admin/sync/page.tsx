import { Prisma } from '@prisma/client';
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
import { FilterableTable } from '@/components/table-filters';

export const metadata = { title: 'Integrations' };

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
  const [relayWaiting, relaySent, relayRefused, relayLastSent] = await Promise.all([
    db.relayOutbox.count({ where: { status: 'PENDING' } }),
    db.relayOutbox.count({ where: { status: 'SENT', payload: { not: Prisma.DbNull } } }),
    db.relayOutbox.findMany({ where: { status: 'FAILED' }, include: { item: { select: { externalKey: true } } }, orderBy: { createdAt: 'desc' }, take: 20 }),
    db.relayOutbox.findFirst({ where: { status: 'SENT', sentAt: { not: null } }, orderBy: { sentAt: 'desc' }, select: { sentAt: true } }),
  ]);
  const feedMode = relayReport?.feed?.mode;

  return (
    <>
      <PageHeader title="Integrations" subtitle="What this app exchanges with other systems: the journey relay and Google Sheets. The database here is the source of truth. For a sheet, App → sheet keeps the sheet a copy of the app; Two-way also pulls sheet edits in, and if both change the same cell the app wins and the conflict is logged." />

      {!configured && (
        <p className="note-warn mb-4">
          APPS_SCRIPT_URL is not set in .env, so sync can’t run.
        </p>
      )}

      <div className="space-y-4">
        <Card title="Journey relay (live)" description="Two ways. From the relay: chapter stewards, who holds each journey, its Creation stage, approvals and publish status. To the relay: every change made here (stage, people, fields, feedback), kept in its dashboard log. Runs when the scheduled job calls /api/cron/run, or when you press Sync RELAY now.">
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
              {relayReport ? `${relayReport.stageChanges.length} stage changes · ${relayReport.reviewMoves?.length ?? 0} review moves · ${relayReport.eventsAdded} events` : '—'}
            </div>
            <div>
              <div className="label">Needs a look</div>
              {relayReport ? (
                relayReport.errors.length + relayReport.unknownPeople.length + relayReport.creatorDiffers.length + relayReport.dashboardAhead.length + (relayReport.mismatches?.length ?? 0) ? (
                  <span className="text-warn">
                    {relayReport.errors.length} errors · {relayReport.unknownPeople.length} creators not in People · {relayReport.creatorDiffers.length} reassigned here (kept) · {relayReport.dashboardAhead.length} ahead of the relay · {relayReport.mismatches?.length ?? 0} out of step with the relay status
                  </span>
                ) : (
                  <span className="text-ok">nothing</span>
                )
              ) : (
                '—'
              )}
            </div>
          </div>
          {relayReport && (relayReport.stewards?.length ?? 0) > 0 && (
            <p className="mt-3 text-xs text-muted">Chapter stewards from the relay: {relayReport.stewards.map(x => `${x.code} ${x.change === 'added' ? '→' : 'taken from'} ${x.steward}`).join(', ')}</p>
          )}
          {relayReport && (relayReport.reassigned?.length ?? 0) > 0 && (
            <p className="mt-2 text-xs text-muted">Moved to the relay’s creator: {relayReport.reassigned.map(x => `${x.key} ${x.from ?? 'nobody'} → ${x.to}`).join(', ')}</p>
          )}
          {relayReport && (relayReport.reviewMoves?.length ?? 0) > 0 && (
            <p className="mt-2 text-xs text-muted">Moved here by the relay status: {relayReport.reviewMoves.map(x => `${x.key} ${x.from} → ${x.to}`).join(', ')}</p>
          )}
          {relayReport && (relayReport.reopened?.length ?? 0) > 0 && (
            <p className="mt-2 text-xs text-muted">Reopened on the relay, Creation stage moved back: {relayReport.reopened!.map(x => `${x.key} ${x.from} → ${x.to ?? 'no stage'} (reopened at ${x.reopenStage})`).join(', ')}</p>
          )}
          {relayReport && (relayReport.mismatches?.length ?? 0) > 0 && (
            <div className="mt-2 text-xs text-warn">
              Out of step with the relay status:
              <ul className="mt-1 space-y-0.5">
                {relayReport.mismatches.map(x => (
                  <li key={x.key}>
                    {x.key}: {x.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {relayReport && (relayReport.teamChanges?.length ?? 0) > 0 && (
            <p className="mt-2 text-xs text-muted">Teams from the relay: {relayReport.teamChanges.map(x => `${x.person} → ${x.team}${x.from ? ` (was ${x.from})` : ''}`).join(', ')}</p>
          )}
          {relayReport && (relayReport.teamIssues?.length ?? 0) > 0 && <p className="mt-2 text-xs text-warn">Teams to check: {relayReport.teamIssues.join('; ')}</p>}
          {relayReport && (relayReport.stewardIssues?.length ?? 0) > 0 && (
            <p className="mt-2 text-xs text-warn">Stewards to check: {relayReport.stewardIssues.join('; ')}</p>
          )}
          {relayReport && (relayReport.addedPeople?.length ?? 0) > 0 && (
            <p className="mt-2 text-xs text-muted">Added from the relay: {relayReport.addedPeople!.map(p => `${p.name} (${p.email} · ${p.roles.join(', ')})`).join(', ')}. They sign in with Google; correct a name or role in People.</p>
          )}
          {relayReport && (relayReport.peopleIssues?.length ?? 0) > 0 && <p className="mt-2 text-xs text-warn">People to check: {relayReport.peopleIssues!.join('; ')}</p>}
          {relayReport && relayReport.unknownPeople.length > 0 && (
            <p className="mt-3 text-xs text-muted">Add these people in People (their email must match the relay), then sync again: {[...new Set(relayReport.unknownPeople.map(p => p.email))].join(', ')}</p>
          )}
          <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="label">Read from the relay</div>
              {feedMode === 'feed' ? `Change feed: ${relayReport?.feed?.events ?? 0} changes, ${relayReport?.feed?.read ?? 0} journeys read` : feedMode === 'full' ? `Full pass: ${relayReport?.feed?.read ?? 0} journeys read` : feedMode === 'off' ? 'Full pass (this relay has no change feed yet)' : '—'}
            </div>
            <div>
              <div className="label">Sent to the relay</div>
              {relaySent} changes{relayLastSent?.sentAt ? ` · last ${formatDateTime(relayLastSent.sentAt, tz)}` : ''}
            </div>
            <div>
              <div className="label">Waiting to send</div>
              {relayWaiting ? `${relayWaiting} changes` : 'nothing'}
            </div>
            <div>
              <div className="label">Refused by the relay</div>
              {relayRefused.length ? <span className="text-warn">{relayRefused.length} changes</span> : <span className="text-ok">nothing</span>}
            </div>
          </div>
          {relayRefused.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-warn">
              {relayRefused.map(x => (
                <li key={x.id}>
                  {x.item.externalKey}: {x.lastError}
                </li>
              ))}
            </ul>
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
            <FilterableTable>
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
            </FilterableTable>
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
