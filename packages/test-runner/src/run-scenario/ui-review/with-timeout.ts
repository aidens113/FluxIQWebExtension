/**
 * `work`, or a rejection naming `what` once `ms` have passed. The UI review
 * reads a browser that may be busy, crashed or showing a tab that does not
 * paint, and a read that never answers must not hold the run's next moment.
 * The work itself is not cancelled; its late answer is ignored (the race has
 * already subscribed to it, so a late rejection is not an unhandled one).
 */
export async function withTimeout<T>(work: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`${what} did not answer within ${ms} ms`)), ms); });
  try {
    return await Promise.race([work, expired]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
