/**
 * Journey names from the relay. The relay names a journey in its `journey_state` feed rows: `name` = the key and a slug
 * (`G07P1C08ST2J3_brahmaguptas-formula`). Its allocation rows carry no name. Pure (no DB).
 */
import type { FeedEvent } from './relay-contract';
import { journeyKeyOf } from './journey';

/** The feed source that holds `journey_state` rows; the names read only it (every other source is skipped). */
export const NAME_FEED_SOURCE = 'states';

/** The relay's latest name for each journey in these rows (oldest first), as its slug: `brahmaguptas-formula`. */
export function relayJourneyNames(events: readonly FeedEvent[], into: Record<string, string> = {}): Record<string, string> {
  const out = { ...into };
  for (const e of events) {
    if (e.entity !== 'journey_state' || !e.key) continue;
    const key = journeyKeyOf(e.key);
    const name = typeof e.data?.name === 'string' ? e.data.name.trim() : '';
    if (!key || !name) continue;
    const slug = name.toUpperCase().startsWith(`${key}_`) ? name.slice(key.length + 1).trim() : journeyKeyOf(name) === key ? '' : name;
    if (slug) out[key] = slug;
  }
  return out;
}

/** True when a journey here has no name of its own: none, or its own key. */
export const lacksJourneyName = (key: string, title: string | null | undefined) => !title?.trim() || journeyKeyOf(title.trim()) === journeyKeyOf(key);

/**
 * The names to write: a journey with no name takes the relay's; one still carrying the relay's earlier name (`before`) follows a
 * rename. A name given here is never changed.
 */
export function journeyNameUpdates(
  items: readonly { key: string; title: string }[],
  names: Readonly<Record<string, string>>,
  before: Readonly<Record<string, string>>,
): { key: string; from: string; to: string }[] {
  const out: { key: string; from: string; to: string }[] = [];
  for (const i of items) {
    const key = journeyKeyOf(i.key);
    const to = key ? names[key] : undefined;
    if (!key || !to || to === i.title.trim()) continue;
    if (lacksJourneyName(i.key, i.title) || (before[key] !== undefined && before[key] === i.title.trim())) out.push({ key: i.key, from: i.title, to });
  }
  return out;
}
