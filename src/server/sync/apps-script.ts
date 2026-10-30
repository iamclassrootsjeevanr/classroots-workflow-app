/**
 * Client for the Google Apps Script web app in apps-script/Code.gs.
 * The URL and token stay on the server (same rule as the old serve.py).
 */
import { env } from '../env';

export type SheetRead = {
  tab: string;
  headers: string[];
  rows: Record<string, unknown>[];
  /** true when the script returned every row (new protocol); the old script only returned assigned rows. */
  complete: boolean;
};

export type CellUpdate = { key: string; column: string; value: string };

export type BatchResult = { ok: boolean; updated: number; appended: number; failed: { key: string; column: string; error: string }[] };

function baseUrl(): string {
  const url = env().APPS_SCRIPT_URL;
  if (!url) throw new Error('APPS_SCRIPT_URL is not set in .env');
  return url;
}

async function getJson(params: Record<string, string>): Promise<Record<string, unknown>> {
  const url = new URL(baseUrl());
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const token = env().SYNC_TOKEN;
  if (token) url.searchParams.set('token', token);
  const res = await fetch(url, { headers: { Accept: 'application/json' }, redirect: 'follow', cache: 'no-store', signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`Apps Script HTTP ${res.status}`);
  const data = (await res.json()) as Record<string, unknown>;
  if (data.error) throw new Error(String(data.error));
  return data;
}

async function postJson(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  // Apps Script answers POST with a 302 to a GET that returns the doPost output; fetch follows it.
  const res = await fetch(baseUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8', Accept: 'application/json' },
    body: JSON.stringify({ ...body, token: env().SYNC_TOKEN ?? '' }),
    redirect: 'follow',
    cache: 'no-store',
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`Apps Script HTTP ${res.status}`);
  const data = (await res.json()) as Record<string, unknown>;
  if (data.error) throw new Error(String(data.error));
  return data;
}

export async function readSheet(tab: string, spreadsheetId?: string): Promise<SheetRead> {
  const data = await getJson({ action: 'read', tab, ...(spreadsheetId ? { sheetId: spreadsheetId } : {}) });
  const rows = Array.isArray(data.rows) ? (data.rows as Record<string, unknown>[]) : [];
  const headers = Array.isArray(data.headers) ? (data.headers as string[]) : Object.keys(rows[0] ?? {});
  return { tab, headers, rows, complete: data.all === true };
}

export async function batchUpdate(tab: string, keyColumns: string[], updates: CellUpdate[], updatedAtColumn?: string, spreadsheetId?: string): Promise<BatchResult> {
  if (!updates.length) return { ok: true, updated: 0, appended: 0, failed: [] };
  const data = await postJson({ action: 'batchUpdate', tab, keyColumns, updatedAtColumn: updatedAtColumn ?? '', updates, ...(spreadsheetId ? { sheetId: spreadsheetId } : {}) });
  return {
    ok: Boolean(data.ok),
    updated: Number(data.updated ?? 0),
    appended: Number(data.appended ?? 0),
    failed: (data.failed as BatchResult['failed']) ?? [],
  };
}
