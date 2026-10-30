import { NextResponse, type NextRequest } from 'next/server';
import { localDayBoundary } from '@/lib/time';
import { workTypesWith } from '@/lib/access-core';
import { getAccess, scopeWhere } from '@/server/access';
import { currentUser } from '@/server/rbac';
import { appTz } from '@/server/settings';
import { buildReport, toCsv, toXlsx } from '@/server/services/reports';

export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const access = await getAccess(user);
  const p = req.nextUrl.searchParams;
  // Export only covers work types where the person has the Export tick, within their data scope.
  const types = workTypesWith(access, 'export').filter(t => !p.get('wt') || t.workTypeKey === p.get('wt'));
  if (!types.length) return NextResponse.json({ error: 'You don’t have export access' }, { status: 403 });

  const report = await buildReport({
    workTypeKeys: types.map(t => t.workTypeKey),
    where: scopeWhere(access, types),
    assigneeId: p.get('dev') ?? undefined,
    from: localDayBoundary(p.get('from'), false, appTz()),
    to: localDayBoundary(p.get('to'), true, appTz()),
  });
  const stamp = report.generatedAt.toISOString().slice(0, 10);

  if (p.get('format') === 'xlsx') {
    const buf = await toXlsx(report);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="classroots-work-report-${stamp}.xlsx"`,
      },
    });
  }
  return new NextResponse(toCsv(report.items), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="classroots-work-items-${stamp}.csv"`,
    },
  });
}
