// A promise held to a time limit: it settles as the work does, or rejects
// with a `TimeoutError` once the limit passes, whichever comes first. The work
// itself is not cancelled -- a caller that can abort it passes its own signal
// as well -- but nothing waits on it any longer.

export async function withinTime<T>(work: Promise<T>, timeoutMs: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new DOMException(`${what} took longer than ${timeoutMs} ms.`, "TimeoutError")), Math.max(0, timeoutMs));
  });
  try {
    return await Promise.race([work, limit]);
  } finally {
    clearTimeout(timer);
  }
}
