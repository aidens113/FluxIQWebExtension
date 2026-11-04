// What a site holds that a person would call done, as named counts: two kettles
// in the cart is `cart:<sku>:own` at 2, an order placed is `orders` at 1, a saved
// job is `saved:<key>` at 1. A change is the difference of two views, so "add two"
// on a cart that held nine reads the same as on an empty one: the standing rule
// (user, 2026-10-27), judge the change and not the absolute state.
//
// A view is the Lab's private reading of `GET /__control/final-state`, never shown
// to a model. It leaves out what a person never asked for and cannot see as done:
// cookie answers, dismissed prompts, view counters, the fixture's own guards and
// its activity log.

/** Named counts. A name that is absent counts 0. */
export type LastingView = Readonly<Record<string, number>>;

/** A site's state as `GET /__control/final-state` answers it: the Lab does not import the fixture's types. */
export type SiteState = Readonly<Record<string, unknown>>;

/** Adds `by` to a name in a view being built, dropping a name that nets to 0, so two views compare by what they hold. */
export function tally(view: Record<string, number>, name: string, by = 1): void {
  const next = (view[name] ?? 0) + by;
  if (next === 0) delete view[name];
  else view[name] = next;
}

/** The members of a list in a state, as records; anything else in it is not read. */
export function recordsOf(state: SiteState, key: string): Readonly<Record<string, unknown>>[] {
  const list = state[key];
  return Array.isArray(list) ? list.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null && !Array.isArray(item)) : [];
}

/** The text members of a list in a state; anything else in it is not read. */
export function textsOf(state: SiteState, key: string): string[] {
  const list = state[key];
  return Array.isArray(list) ? list.filter((item): item is string => typeof item === "string") : [];
}

/** A nested record of a state, or an empty one. */
export function nested(state: SiteState, key: string): Readonly<Record<string, unknown>> {
  const value = state[key];
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

/** A record's member as a name part: its text or number, or `-` so a missing member can never join another's name. */
export function part(record: Readonly<Record<string, unknown>>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : "-";
}

/** A record's member as a count, or 0. */
export function countOf(record: Readonly<Record<string, unknown>>, key: string): number {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
