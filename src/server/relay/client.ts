import { execFileSync } from 'node:child_process';
import { env } from '../env';

/** The relay's verbs the dashboard reads. Replies are JSON; shapes are parsed tolerantly in src/lib/relay-map.ts. */
export interface RelayClient {
  allocations(): Promise<unknown>;
  journeyStatus(key: string): Promise<unknown>;
  whoami(): Promise<unknown>;
}

export class RelayHttpError extends Error {}

const ssoMode = () => env().RELAY_AUTH === 'sso';
export const relayConfigured = () => Boolean(env().RELAY_URL && (ssoMode() || (env().RELAY_CF_CLIENT_ID && env().RELAY_CF_CLIENT_SECRET)));

/** A person's Access login: `cloudflared access token --app <url>` (the session from `cloudflared access login`). Never logged. */
function ssoHeaders(url: string): Record<string, string> {
  let out = '';
  try {
    out = execFileSync('cloudflared', ['access', 'token', '--app', url], { encoding: 'utf8', env: { ...process.env, ...(env().RELAY_SSO_HOME ? { HOME: env().RELAY_SSO_HOME } : {}) }, timeout: 20_000 }).trim();
  } catch {
    /* handled below */
  }
  // cloudflared prints its error to stdout and exits 0: accept only a JWT-shaped value.
  if (!/^[A-Za-z0-9._-]+$/.test(out) || out.split('.').length < 3) throw new RelayHttpError(`No Access login for the relay: run  cloudflared access login ${url}`);
  return { 'cf-access-token': out };
}

const CHUNK_TRIES = 3;
let seq = 0;

/**
 * The relay as an MCP server over HTTPS: one JSON-RPC `tools/call` per verb, signed with a Cloudflare Access service token.
 * Same door the seats use (RELAY/.seat/tools/journey-kit/relay.py). Cloudflare answers 1010 to a default HTTP agent, so we send our own.
 */
export function httpRelayClient(): RelayClient {
  const { RELAY_URL, RELAY_CF_CLIENT_ID, RELAY_CF_CLIENT_SECRET } = env();
  if (!relayConfigured()) throw new RelayHttpError('The relay is not configured (RELAY_URL and RELAY_CF_CLIENT_ID / RELAY_CF_CLIENT_SECRET, or RELAY_AUTH=sso).');
  const auth = (): Record<string, string> => (ssoMode() ? ssoHeaders(RELAY_URL!) : { 'CF-Access-Client-Id': RELAY_CF_CLIENT_ID!, 'CF-Access-Client-Secret': RELAY_CF_CLIENT_SECRET! });

  async function call(tool: string, args: Record<string, unknown>): Promise<string> {
    const res = await fetch(RELAY_URL!, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        'user-agent': 'classroots-work-dashboard (relay sync)',
        ...auth(),
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++seq, method: 'tools/call', params: { name: tool, arguments: args } }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new RelayHttpError(`${tool}: HTTP ${res.status}`);
    const msg = (await res.json()) as { error?: unknown; result?: { isError?: boolean; content?: { type: string; text?: string }[] } };
    if (msg.error) throw new RelayHttpError(`${tool}: ${JSON.stringify(msg.error).slice(0, 200)}`);
    const text = msg.result?.content?.find(c => c.type === 'text')?.text ?? '';
    if (msg.result?.isError) throw new RelayHttpError(`${tool}: ${text.slice(0, 200)}`);
    return text;
  }

  /** Large replies come in tracked chunks (`_studio_chunked`): re-call with `next_offset` and join in order; start over if the body changed. */
  async function callAll(tool: string, args: Record<string, unknown>): Promise<unknown> {
    const first = await call(tool, args);
    let head: Record<string, unknown>;
    try {
      head = JSON.parse(first);
    } catch {
      throw new RelayHttpError(`${tool}: the reply was not JSON`);
    }
    if (!head || !head._studio_chunked) return head;
    for (let attempt = 0; attempt < CHUNK_TRIES; attempt++) {
      const start = attempt ? (JSON.parse(await call(tool, args)) as Record<string, unknown>) : head;
      const parts = [String(start.chunk ?? '')];
      let x = start;
      let whole = true;
      while (x.next_offset != null) {
        const y = JSON.parse(await call(tool, { ...args, offset: x.next_offset })) as Record<string, unknown>;
        if (y.total_chars !== start.total_chars || y.version !== start.version) {
          whole = false;
          break;
        }
        parts.push(String(y.chunk ?? ''));
        x = y;
      }
      const text = parts.join('');
      if (whole && text.length === Number(start.total_chars ?? text.length)) return JSON.parse(text);
    }
    throw new RelayHttpError(`${tool}: the reply kept changing while it was read in chunks; run again`);
  }

  return {
    allocations: () => callAll('allocations', {}),
    journeyStatus: key => callAll('journey_status', { journey: key }),
    whoami: () => callAll('whoami', {}),
  };
}
