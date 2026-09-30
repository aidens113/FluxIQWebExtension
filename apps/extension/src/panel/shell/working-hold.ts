// "FluxIQ is working", held steady for the controls that wait on it (record,
// extract, Run). The user's rule: status and controls are stable, never
// flickering.
//
// The input may flip quickly (see `working-input.ts`), so a change shows only
// once it has lasted: working after `onMs` of working, idle after `offMs` of
// idle. A flip back inside that time cancels it. No DOM and no real timers:
// the clock comes in, so each rule is tested directly.

/** The timers the hold runs on; the panel passes `window`'s. */
export type WorkingClock = {
  setTimeout(run: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
};

export type WorkingHold = {
  /** The held value the controls show. */
  working(): boolean;
  /** The raw input now. */
  observe(raw: boolean): void;
  /** Cancels a pending change. */
  stop(): void;
};

/** How long working must last before the controls wait: page reads shorter than this never show. */
export const WORKING_ON_MS = 400;
/** How long idle must last before the controls come back: gaps between page reads never show. */
export const WORKING_OFF_MS = 1_200;

/** Creates the hold; `onChange` is called after each change of `working()`. */
export function createWorkingHold(
  clock: WorkingClock,
  onChange: (working: boolean) => void,
  timing: { onMs: number; offMs: number } = { onMs: WORKING_ON_MS, offMs: WORKING_OFF_MS }
): WorkingHold {
  let shown = false;
  let raw = false;
  let pending: unknown;
  let hasPending = false;

  function cancel(): void {
    if (hasPending) clock.clearTimeout(pending);
    hasPending = false;
  }

  return {
    working: () => shown,
    observe(next) {
      if (next === raw) return;
      raw = next;
      cancel();
      if (raw === shown) return;
      hasPending = true;
      pending = clock.setTimeout(() => {
        hasPending = false;
        if (raw === shown) return;
        shown = raw;
        onChange(shown);
      }, raw ? timing.onMs : timing.offMs);
    },
    stop: cancel
  };
}
