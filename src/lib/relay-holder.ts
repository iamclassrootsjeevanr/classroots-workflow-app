import { displayNameFromEmail, nameFromEmail } from './relay-map';

/**
 * Who holds a journey on the relay against who is its creator here. Pure (no DB).
 * Allocations belong to the relay: a new creator set here does not move the relay's allocation, and that person's seat cannot work on the
 * journey until an allocator allocates the key to them. The dashboard does not write to the relay and does not block the change; it says so.
 */
export type RelayHolder = { email: string; name: string };
type Person = { email: string | null; name: string | null };

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/** Is this dashboard person the relay's holder? The same email, or the name the relay's email spells (krishna.rander@ is Krishna Rander). */
export function isRelayHolder(holderEmail: string, person: Person): boolean {
  const email = norm(holderEmail);
  return Boolean(email) && (norm(person.email) === email || (Boolean(norm(person.name)) && norm(person.name) === nameFromEmail(email)));
}

/** The relay's holder with the name shown here: the dashboard person it is, else the name the email spells. */
export function relayHolderOf(email: string | null, people: readonly Person[]): RelayHolder | null {
  if (!email?.includes('@')) return null;
  const known = people.find(p => norm(p.email) === norm(email)) ?? people.find(p => isRelayHolder(email, p));
  return { email: email.toLowerCase(), name: known?.name?.trim() || displayNameFromEmail(email) };
}

/** The note for a journey whose creator here is not the relay's holder, or null when they agree (or the relay holds it for nobody). */
export function relayHolderNote(key: string, holder: RelayHolder | null, creator: Person | null): string | null {
  if (!holder || !creator || isRelayHolder(holder.email, creator)) return null;
  return `Relay holder: ${holder.name}. Ask an allocator to allocate ${key} to ${creator.name?.trim() || creator.email || 'the new creator'}.`;
}

/** The id the allocation is kept under here: one row per holder and time, so a re-sync adds nothing. */
export const allocationEventId = (key: string, email: string | null, at: Date | null) => `allocation:${key}:${at ? at.toISOString() : '-'}:${email ?? '-'}`;
