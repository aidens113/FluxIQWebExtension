// The count behind `shared/scheduled-work-event.ts`: each piece of work the page
// schedules for itself, outstanding until it is done, and whether a callback
// that recurs is running now.
//
// A piece ends after its callback returns, never before it runs, so the count
// does not touch none in the middle of the work that schedules the next piece.
// It can touch none between a timer's callback and the continuation that
// callback awaited -- `await delay(250)` and then a `fetch` -- which is why the
// asker confirms a drained page one task later (`runtime/navigation-events/`).

/** What a counted piece of work is: a frame is not counted while the document is hidden, because a hidden document draws no frames. */
export type PageWorkKind = "timer" | "deferred-timer" | "frame" | "request";

export type PageWorkTracker = {
  /** Counts a piece of work begun now; undefined, and nothing counted, while a recurring callback is running. */
  begin(kind: PageWorkKind): number | undefined;
  /** The piece is done. */
  end(id: number | undefined): void;
  /** `run`, as a recurring callback: nothing it begins is counted. */
  recurring<T>(run: () => T): T;
  /** Whether counted work is outstanding; frames are left out while `hidden`. */
  busy(hidden: boolean, includeDeferred?: boolean): boolean;
};

/** A count that calls `drained` each time it falls to none. */
export function createPageWorkTracker(drained: () => void): PageWorkTracker {
  const outstanding = new Map<number, PageWorkKind>();
  let next = 0;
  let recurringDepth = 0;
  const busy = (hidden: boolean, includeDeferred = false): boolean => {
    for (const kind of outstanding.values()) {
      if (kind === "deferred-timer" && !includeDeferred || hidden && kind === "frame") continue;
      return true;
    }
    return false;
  };
  return {
    begin(kind) {
      if (recurringDepth > 0) return undefined;
      next += 1;
      outstanding.set(next, kind);
      return next;
    },
    end(id) {
      if (id === undefined || !outstanding.delete(id)) return;
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
    busy
  };
}
