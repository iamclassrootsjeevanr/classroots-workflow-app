import Link from 'next/link';
import { FilterableTable } from '@/components/table-filters';
import { notFound } from 'next/navigation';
import { Card, Empty } from '@/components/ui';
import { BOARD_COLUMNS, columnTotals, FRESH_DAYS, OLD_DAYS, type BoardChip } from '@/lib/relay-board';
import { boardView } from '@/lib/access-core';
import { getModule } from '@/modules/registry';
import { requireAccess, scopeWhere } from '@/server/access';
import { loadRelayBoard } from '@/server/services/relay-board';

export async function generateMetadata({ params }: { params: Promise<{ workType: string }> }) {
  const { workType } = await params;
  const mod = getModule(workType);
  return { title: mod ? `${mod.name} · ${mod.pages?.board ?? 'Relay board'}` : 'Work' };
}

const TONE: Record<BoardChip['tone'], string> = {
  fresh: 'border-ok/40 bg-ok-soft text-ok',
  mid: 'border-warn/40 bg-warn-soft text-warn',
  old: 'border-bad/40 bg-bad-soft text-bad',
  none: 'border-line bg-surface-2 text-muted',
};

/** Who holds which journey at which creation stage, and for how many days. Shows only the journeys the viewer's role may see. */
export default async function RelayBoardPage({ params }: { params: Promise<{ workType: string }> }) {
  const { workType: key } = await params;
  const { access } = await requireAccess();
  const wt = access.byKey.get(key);
  const mod = getModule(key);
  const view = boardView(access.isAdmin, wt);
  if (!wt || !mod?.relayBoard || !view) notFound();
  // A steward, a reviewer, QA and an admin see every journey; anyone else sees what their role shows them.
  const { rows, total } = await loadRelayBoard(key, view === 'all' ? { workTypeId: wt.workTypeId } : scopeWhere(access, [wt]));
  const totals = columnTotals(rows);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        One row per creator, one column per creation stage. A chip is a journey with the days it has sat there
        (<span className="text-ok">{FRESH_DAYS} or fewer</span>, <span className="text-warn">{FRESH_DAYS + 1}–{OLD_DAYS - 1}</span>, <span className="text-bad">{OLD_DAYS}+</span>).
        <b> r</b> = up for review, <b>c</b> = corrections. Fed by the relay; journeys past review leave the board.
        {view === 'scoped' && wt.dataScope === 'OWN' && ' You see your own journeys.'}
      </p>
      {rows.length === 0 ? (
        <Empty>No journeys to show.</Empty>
      ) : (
        <Card flush title={`${total} journeys in creation`}>
          <FilterableTable className="overflow-x-auto">
            <table className="w-full min-w-[56rem] border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-[1] bg-surface px-4 py-2 text-left text-2xs font-semibold tracking-wide text-muted uppercase">Creator</th>
                  {BOARD_COLUMNS.map(c => (
                    <th key={c.key} data-nofilter="" className="px-2 py-2 text-left text-2xs font-semibold tracking-wide text-muted uppercase">
                      {c.label} <span className="font-normal">· {totals[c.key]}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.personId ?? 'none'} className="align-top">
                    <th scope="row" className="sticky left-0 z-[1] border-t border-line bg-surface px-4 py-2 text-left font-medium text-ink whitespace-nowrap">
                      {r.name} <span className="font-normal text-muted">· {r.total}</span>
                    </th>
                    {BOARD_COLUMNS.map(c => {
                      const cell = r.cells[c.key];
                      return (
                        <td key={c.key} className="border-t border-line px-2 py-2">
                          <div className="flex flex-col items-start gap-1">
                            {cell.groups.map(g => (
                              <span key={g.label} className="rounded-md border border-line bg-surface-2 px-2 py-0.5 text-xs text-muted">
                                {g.label} ×{g.count}
                              </span>
                            ))}
                            {cell.chips.map(chip => (
                              <Link
                                key={chip.id}
                                href={`/w/${key}/${chip.id}`}
                                className={`rounded-md border px-2 py-0.5 text-xs whitespace-nowrap hover:brightness-95 ${TONE[chip.tone]}`}
                                title={chip.days == null ? chip.key : `${chip.key} · ${chip.days} days here`}
                              >
                                {chip.key}
                                {chip.days != null && ` ${chip.days}d`}
                                {chip.mark && <b className="ml-1">{chip.mark}</b>}
                              </Link>
                            ))}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </FilterableTable>
        </Card>
      )}
    </div>
  );
}
