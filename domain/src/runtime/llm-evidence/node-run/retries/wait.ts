// The wait between two attempts of a node a build runs (t355).

/**
 * The wait between attempts, ended early by a cancelled build. A held timer
 * rather than Core's unreferenced default: a build waiting to try a node again
 * is the work in hand, and nothing else may be keeping its process alive.
 */
export function webNodeRetryWait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", stop);
      resolve();
    }, ms);
    const stop = () => {
      clearTimeout(timer);
      resolve();
    };
    signal?.addEventListener("abort", stop, { once: true });
  });
}

