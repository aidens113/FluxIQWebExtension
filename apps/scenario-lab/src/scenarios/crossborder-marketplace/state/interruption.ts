/**
 * The interruption switch: the store's known flash-deal promotion, shown on a
 * chosen page from a chosen load of that page onwards, with a close control
 * that works or one that does nothing.
 *
 * It exists for the state-aware recovery proofs (acceptance-matrix rows 4 and
 * 5): a known interruption met before a chosen step -- the home page's first
 * load is before the first action, a product page's is before the options are
 * chosen -- or on a chosen pass of a loop that opens the same kind of page
 * again; and an interruption whose dismissal fails, so a run must end
 * honestly rather than press the close control for ever.
 *
 * - `page` and `visit`: the promotion stands over the `visit`-th load of
 *   `page` (counted from 1 since the arm) and over every later load of it
 *   until it is closed, as a promotion the visitor never answered keeps coming
 *   back. Loads are counted when the server serves the page (`page-view`,
 *   `search-load`) or, for the home page, when it reports itself (`beacon`).
 * - `dismiss`: `closes` is the shipped behaviour; `inert` is a broken close
 *   handler -- the glyph takes the click, nothing happens, and the server
 *   refuses the close too, so no path but leaving the page gets past it.
 * - `delayMs`: how long after load it opens; 0 (the default) stamps it while
 *   the page boots, so it is there before any step on that page runs.
 */
export const INTERRUPTION_PAGES = ["home", "search", "item", "cart", "checkout"] as const;

export type Interruption = {
  page: (typeof INTERRUPTION_PAGES)[number];
  visit: number;
  dismiss: "closes" | "inert";
  delayMs: number;
  /** Loads of `page` served since the arm. */
  loads: number;
  status: "waiting" | "closed";
};

const MAX_VISIT = 50;
const MAX_DELAY_MS = 10_000;

/** The switch an arm payload asks for, or `undefined` for one the Lab could not have meant. */
export function readInterruption(value: unknown): Interruption | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const { page, visit, dismiss, delayMs = 0, ...rest } = value as Record<string, unknown>;
  if (Object.keys(rest).length > 0) return undefined;
  if (!(INTERRUPTION_PAGES as readonly unknown[]).includes(page)) return undefined;
  if (!isWhole(visit, 1, MAX_VISIT) || !isWhole(delayMs, 0, MAX_DELAY_MS)) return undefined;
  if (dismiss !== "closes" && dismiss !== "inert") return undefined;
  return { page: page as Interruption["page"], visit, dismiss, delayMs, loads: 0, status: "waiting" };
}

/** Whether the page about to be served is one the promotion stands over: the load it is due on, or a later one while it is still open. */
export function interruptionDue(interruption: Interruption | null, kind: string): boolean {
  return interruption !== null && interruption.status === "waiting" && interruption.page === kind && interruption.loads + 1 >= interruption.visit;
}

/** The switch after one more load of `kind`. */
export function countInterruptionLoad(interruption: Interruption | null, kind: unknown): Interruption | null {
  return interruption !== null && interruption.page === kind ? { ...interruption, loads: interruption.loads + 1 } : interruption;
}

/** The switch after the page reported its close control pressed: closed if it was showing and its close works, unchanged otherwise. */
export function closeInterruption(interruption: Interruption | null): Interruption | null {
  if (interruption === null || interruption.dismiss === "inert" || interruption.status !== "waiting" || interruption.loads < interruption.visit) return interruption;
  return { ...interruption, status: "closed" };
}

function isWhole(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}
