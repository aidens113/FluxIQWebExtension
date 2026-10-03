// A clock the tests move by hand: `Date.now`, `setTimeout` and `clearTimeout`
// are replaced for the duration of `run`, and `advance` fires every timer that
// falls due, in order, at the time it was due.

type Timer = { id: number; due: number; callback: () => void };

export type FakeClock = {
  /** The fake time, in milliseconds since the clock was installed. */
  now(): number;
  /** Moves time forward by `ms`, firing each timer that falls due on the way. */
  advance(ms: number): void;
  /** How many timers are waiting. */
  pending(): number;
};

/** Installs a fake clock starting at 0 for the duration of `run`. */
export function withFakeClock<T>(run: (clock: FakeClock) => T): T {
  const globals = globalThis as unknown as Record<string, unknown>;
  const saved = { setTimeout: globals["setTimeout"], clearTimeout: globals["clearTimeout"], now: Date.now };
  let time = 0;
  let nextId = 1;
  const timers: Timer[] = [];
  globals["setTimeout"] = (callback: () => void, delay = 0) => {
    const timer = { id: nextId++, due: time + Math.max(0, delay), callback };
    timers.push(timer);
    return timer.id;
  };
  globals["clearTimeout"] = (id: number) => {
    const index = timers.findIndex((timer) => timer.id === id);
    if (index >= 0) timers.splice(index, 1);
  };
  Date.now = () => time;
  const clock: FakeClock = {
    now: () => time,
    advance(ms) {
      const until = time + ms;
      for (;;) {
        timers.sort((left, right) => left.due - right.due || left.id - right.id);
        const next = timers[0];
        if (!next || next.due > until) break;
        timers.shift();
        time = next.due;
        next.callback();
      }
      time = until;
    },
    pending: () => timers.length
  };
  try {
    return run(clock);
  } finally {
    globals["setTimeout"] = saved.setTimeout;
    globals["clearTimeout"] = saved.clearTimeout;
    Date.now = saved.now;
  }
}
