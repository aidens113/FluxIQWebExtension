// Watches an applied Flow bootstrap's execution binding for a short window
// after apply. Core records the applied digest inside the apply; a Flow whose
// current digest then moves away from it cannot be run, diagnosed or reverted
// as that application, so the apply step checks for it before reporting
// success rather than leaving the next step to find it.

export type AppliedBindingRead = Readonly<{ applied?: string; current?: string }>;

export type AppliedBindingWatch = Readonly<{
  reads: number;
  /** Milliseconds after the first read at which the binding was first unequal; absent when it held. */
  driftedAtMs?: number;
}>;

export async function watchAppliedBinding(
  read: () => Promise<AppliedBindingRead>,
  options: Readonly<{
    settleMs: number;
    intervalMs: number;
    /** The applied digest the apply response named, when the caller has it. */
    expectedApplied?: string;
    now?: () => number;
    pause?: (ms: number) => Promise<void>;
  }>,
): Promise<AppliedBindingWatch> {
  const now = options.now ?? Date.now;
  const pause = options.pause ?? (ms => new Promise<void>(resolve => setTimeout(resolve, ms)));
  const started = now();
  let reads = 0;
  for (;;) {
    const binding = await read();
    reads += 1;
    const elapsed = now() - started;
    if (!binding.applied || binding.current !== binding.applied
      || (options.expectedApplied !== undefined && binding.applied !== options.expectedApplied)) {
      return Object.freeze({ reads, driftedAtMs: elapsed });
    }
    if (elapsed >= options.settleMs) return Object.freeze({ reads });
    await pause(options.intervalMs);
  }
}
