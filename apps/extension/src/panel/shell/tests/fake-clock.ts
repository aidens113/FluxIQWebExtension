// A manual clock for the working hold: timers fire only when a test advances time.

import type { WorkingClock } from "../working-hold";

export type FakeClock = WorkingClock & { advance(ms: number): void };

/** A clock at 0 whose timers fire, in order, as `advance` passes them. */
export function fakeClock(): FakeClock {
  let now = 0;
  let nextId = 0;
  const timers = new Map<number, { at: number; run: () => void }>();
  return {
    setTimeout(run, ms) {
      nextId += 1;
      timers.set(nextId, { at: now + ms, run });
      return nextId;
    },
    clearTimeout(handle) {
      timers.delete(handle as number);
    },
    advance(ms) {
      const until = now + ms;
      for (;;) {
        const due = [...timers.entries()].filter(([, timer]) => timer.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
        if (due === undefined) break;
        timers.delete(due[0]);
        now = due[1].at;
        due[1].run();
      }
      now = until;
    }
  };
}
