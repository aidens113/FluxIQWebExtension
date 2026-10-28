// Where each step of a run found the page, as this host captured it (t786, D3):
// the location a re-run of a stale target's source step must stand on.
//
// Only a location the run itself recorded is used (decision 10): the `from`
// token of a state snapshot this host took for the attempt
// (`../host-runtime.ts`, `{ location }`, written only for an address the
// packet publishes whole). The capture before the step acted is where it ran;
// a later capture of the same attempt fills in only when there was none. The
// memory is bounded to the last attempts, as the state places memo is, so a
// long run never grows it.

import type { JsonValue } from "fluxiq/core";

/** The before-action capture point, which says where a step ran. */
const BEFORE_ACTION = "before_action";
/** How many attempts' places are remembered. */
const REMEMBERED_ATTEMPTS = 64;

export type WebSourcePlaces = {
  /** Remember where `attemptId` found the page, from a snapshot's `from` token. */
  keep(attemptId: string, point: string, from: JsonValue | undefined): void;
  /** Where `attemptId` ran, when this host recorded it. */
  of(attemptId: string): string | undefined;
};

export function createWebSourcePlaces(limit = REMEMBERED_ATTEMPTS): WebSourcePlaces {
  const places = new Map<string, string>();
  return {
    keep(attemptId, point, from) {
      const location = typeof from === "object" && from !== null && !Array.isArray(from) && typeof from.location === "string" && from.location !== "" ? from.location : undefined;
      if (location === undefined || (point !== BEFORE_ACTION && places.has(attemptId))) return;
      places.delete(attemptId);
      places.set(attemptId, location);
      while (places.size > limit) places.delete(places.keys().next().value!);
    },
    of: (attemptId) => places.get(attemptId)
  };
}
