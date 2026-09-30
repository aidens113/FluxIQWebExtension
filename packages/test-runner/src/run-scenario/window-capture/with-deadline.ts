/**
 * Runs `work` for at most `timeoutMs`, rejecting when it runs over.
 *
 * On expiry the signal handed to `work` is aborted, so a child process started
 * with it is killed rather than left running beside the run. Work that ignores
 * the signal still settles later; this promise has already rejected by then,
 * and the late result is dropped -- which is the point: a screenshot must never
 * hold a run up, so a capture that is late is a capture that did not happen.
 */
export function withDeadline<T>(work: (signal: AbortSignal) => Promise<T>, timeoutMs: number, label: string): Promise<T> {
  const controller = new AbortController();
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`${label} took longer than ${timeoutMs} ms`));
    }, Math.max(0, timeoutMs));
    Promise.resolve().then(() => work(controller.signal)).then(
      value => { clearTimeout(timer); resolve(value); },
      (error: unknown) => { clearTimeout(timer); reject(error); },
    );
  });
}
