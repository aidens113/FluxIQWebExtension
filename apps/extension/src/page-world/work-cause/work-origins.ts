// Which scheduled lineage the page's code is running in, for telling a press's
// own requests from the page's background (t1094, `../request-starts.ts`).
//
// Every timer, interval and animation frame the page schedules is stamped, when
// it is scheduled, with an origin: the origin of the callback scheduling it, or
// a fresh one -- a number from one clock that only rises -- when no stamped
// callback is running. While a stamped callback runs, its origin is `current`
// (`../page-work/timers.ts` enters it). So a beacon loop, a poller or an
// animation loop keeps the origin of whatever first started it, however many
// fresh closures it schedules. A request mark takes a number from the same
// clock: work whose origin is below a press's mark was set in motion before the
// press, and the press cannot have caused it.
//
// Work run outside any stamped callback -- an event handler, a promise
// continuation, a message -- has no origin here (`current` is undefined), and
// says nothing about its cause.

type WorkOrigins = {
  /** The origin of the stamped callback running now; undefined outside one. */
  readonly current: number | undefined;
  /** A number from the rising clock, as a mark takes it. */
  tick(): number;
  /** The origin a callback scheduled now carries: the running one's, or a fresh one. */
  scheduled(): number;
  /** Runs `run` as a callback of `origin`. */
  enter<T>(origin: number, run: () => T): T;
};

let clock = 0;
let running: number | undefined;

/** The page world's one origin clock (header). */
export const workOrigins: WorkOrigins = {
  get current() {
    return running;
  },
  tick() {
    clock += 1;
    return clock;
  },
  scheduled() {
    return running ?? workOrigins.tick();
  },
  enter(origin, run) {
    const before = running;
    running = origin;
    try {
      return run();
    } finally {
      running = before;
    }
  }
};
