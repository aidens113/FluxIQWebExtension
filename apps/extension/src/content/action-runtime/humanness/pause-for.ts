// A human pause: a timer the verb awaits. Only a command above humanness 0
// ever reaches one, and a pause of nothing sets no timer.

/** Resolves after `ms` milliseconds; at once, without a timer, for `ms` of 0 or less. */
export function pauseFor(ms: number): Promise<void> {
  if (!(ms > 0)) return Promise.resolve();
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
