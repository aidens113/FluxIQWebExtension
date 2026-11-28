// The count behind `shared/scheduled-work-event.ts`: each piece of work the page
// schedules for itself, outstanding until it is done, whether a callback that
// recurs is running now, and when the document last changed.
//
// A piece ends after its callback returns, never before it runs, so the count
// does not touch none in the middle of the work that schedules the next piece.
// It can touch none between a timer's callback and the continuation that
// callback awaited -- `await delay(250)` and then a `fetch` -- which is why the
// asker looks again in a later task (`shared/scheduled-work-settled.ts`).
//
// **Which work holds the page (t1094).** Readiness is what the next step needs:
// the document it will act on, drawn and no longer changing. Work holds the page
// only while it can still be drawing it:
// - A timer within the horizon, or an animation frame, that begins new work
//   holds until its callback has run. It is bounded by itself: the horizon is
//   what makes it the page drawing itself.
// - A request, and a timer or frame that continues a chain -- the same source
//   again within the horizon of the last one ending, or while one is still out
//   (a beacon every 0.7 s scheduled by a fresh closure after each answer, an
//   animation loop of fresh closures) -- holds until it is done, or until the
//   document has gone `PAGE_WORK_HORIZON_MS` unchanged since the request or the
//   chain began. Such work could otherwise hold the page forever: a long poll,
//   a stream, a beacon a blocker swallowed (no resource entry ever comes), or a
//   chain that never ends. Work that changes the document keeps holding: each
//   change starts the horizon again, so a list fetched and then drawn, a chain
//   that draws as it goes, holds until the drawing stops. Work that changes
//   nothing stops holding a horizon after it began -- the second the old
//   stable-address clock gave every page, and the same horizon a timer must
//   fall within to count at all -- and never holds again: a change the page
//   makes later, for other work, does not wake a long poll that already went a
//   horizon with nothing drawn, so it does not add a horizon to every step
//   after it.
// A source is a timer's or frame's callback text (`./callback-source.ts`), and
// a fetch's address without its query; an XHR has none, so each is new work.
// Recurring work (`./timers.ts`) is still never counted at all.

import { PAGE_WORK_HORIZON_MS } from "../../shared/scheduled-work-event";

/** What a counted piece of work is: a frame is not counted while the document is hidden, because a hidden document draws no frames. */
export type PageWorkKind = "timer" | "deferred-timer" | "frame" | "request";

export type PageWorkTracker = {
  /** Counts a piece of work begun now, from `source` when known; undefined, and nothing counted, while a recurring callback is running. */
  begin(kind: PageWorkKind, source?: string): number | undefined;
  /** The piece is done. */
  end(id: number | undefined): void;
  /** `run`, as a recurring callback: nothing it begins is counted. */
  recurring<T>(run: () => T): T;
  /** The document changed now (`./document-changes.ts`). */
  changed(): void;
  /** Whether work that holds the page is outstanding (header); frames are left out while `hidden`, deferred timers unless `includeDeferred`. */
  busy(hidden: boolean, includeDeferred?: boolean): boolean;
  /** Whether the document changed within the last `withinMs`. */
  changedWithin(withinMs: number): boolean;
};

/** What lets unbounded work go: since when the document has been unchanged around it, and whether it went a horizon so. */
type Hold = { quietFrom: number; released: boolean };

type Piece = {
  kind: PageWorkKind;
  /** A timer or frame that begins new work: held until done, the horizon bounding it. */
  bounded: boolean;
  /** Its chain's hold, shared by every piece of the chain, or its own. */
  hold: Hold;
  run: Run | undefined;
};

/** One source's work in a row: how much is out, when the last piece ended, and the chain's hold. */
type Run = { out: number; endedAt: number; hold: Hold };

/** Runs kept before the idle ones are let go: enough for a page's distinct sources, small enough to sweep. */
const RUNS_KEPT = 512;

/** A count that calls `drained` each time it falls to none; `now` is a monotonic clock in ms. */
export function createPageWorkTracker(drained: () => void, now: () => number = monotonicClock()): PageWorkTracker {
  const outstanding = new Map<number, Piece>();
  const runs = new Map<string, Run>();
  /** Every hold not yet let go, a chain's between its pieces included: each sees every change. */
  const live = new Set<Hold>();
  const hold = (at: number): Hold => {
    const created: Hold = { quietFrom: at, released: false };
    live.add(created);
    return created;
  };
  let next = 0;
  let recurringDepth = 0;
  let changedAt = now();
  const holds = (piece: Piece, at: number, hidden: boolean, includeDeferred: boolean): boolean => {
    if (piece.kind === "deferred-timer" && !includeDeferred) return false;
    if (hidden && piece.kind === "frame") return false;
    if (piece.bounded) return true;
    return !released(piece.hold, at);
  };
  /** Whether a hold has gone a horizon with the document unchanged; once it has, it stays let go. */
  const released = (hold: Hold, at: number): boolean => {
    if (!hold.released && at - hold.quietFrom >= PAGE_WORK_HORIZON_MS) hold.released = true;
    return hold.released;
  };
  const busy = (hidden: boolean, includeDeferred = false): boolean => {
    const at = now();
    for (const piece of outstanding.values()) if (holds(piece, at, hidden, includeDeferred)) return true;
    return false;
  };
  const runFor = (source: string, at: number): { run: Run; continued: boolean } => {
    const known = runs.get(source);
    if (known !== undefined && (known.out > 0 || at - known.endedAt <= PAGE_WORK_HORIZON_MS)) return { run: known, continued: true };
    if (known !== undefined) live.delete(known.hold);
    if (runs.size >= RUNS_KEPT) sweep(at);
    const run: Run = { out: 0, endedAt: at, hold: hold(at) };
    runs.set(source, run);
    return { run, continued: false };
  };
  const sweep = (at: number): void => {
    for (const [source, run] of runs) {
      if (run.out > 0 || at - run.endedAt <= PAGE_WORK_HORIZON_MS) continue;
      runs.delete(source);
      live.delete(run.hold);
    }
  };
  return {
    begin(kind, source) {
      if (recurringDepth > 0) return undefined;
      const at = now();
      const chain = source === undefined ? undefined : runFor(source, at);
      if (chain) chain.run.out += 1;
      next += 1;
      outstanding.set(next, {
        kind,
        bounded: kind !== "request" && chain?.continued !== true,
        hold: chain?.run.hold ?? hold(at),
        run: chain?.run
      });
      return next;
    },
    end(id) {
      if (id === undefined) return;
      const piece = outstanding.get(id);
      if (piece === undefined) return;
      outstanding.delete(id);
      if (!piece.run) live.delete(piece.hold);
      if (piece.run) {
        piece.run.out -= 1;
        piece.run.endedAt = now();
      }
      if (!busy(false)) drained();
    },
    recurring(run) {
      recurringDepth += 1;
      try {
        return run();
      } finally {
        recurringDepth -= 1;
      }
    },
    changed() {
      changedAt = now();
      // Each hold not yet let go starts its horizon again, unless it had already gone one unchanged.
      for (const each of live) {
        if (released(each, changedAt)) live.delete(each);
        else each.quietFrom = changedAt;
      }
    },
    busy,
    changedWithin(withinMs) {
      return now() - changedAt < withinMs;
    }
  };
}

/** `performance.now`, as the page had it when the page world installed; `Date.now` where there is none. */
function monotonicClock(): () => number {
  const timeline = typeof performance === "object" && performance !== null && typeof performance.now === "function" ? performance : undefined;
  if (timeline === undefined) return Date.now;
  const read = timeline.now;
  return () => read.call(timeline);
}
