// One safe read of Core, tried until it answers: the first try plus 3 retries
// when it fails on time, on the transport, or on a Core server error (the
// user's rule: every safe read retries). Lane A's run `run-mv0fu9uq-107ab0de`
// died on one unretried 10 s `list-flows` before the instruction was ever
// typed. A refusal (a 4xx, a malformed answer) or a caller's abort is not
// retried: asking again gets the same answer.
//
// The failure it gives up on is the last one, with the same category, message
// and details -- the facility projection (`../../facility-failure/`) keys on
// that message and carries the endpoint from the details -- plus the endpoint's
// name, how many tries it made and how long they took.

import { RunnerFailure } from "../../failure.js";

/** Tries after the first. */
const RETRIES = 3;
/** The wait before each retry, in order. */
const PAUSES_MS = [500, 1_000, 2_000] as const;
const REAL_CLOCK = { now: Date.now, sleep: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)) };

/**
 * `read` is one try; `clock` tells time and waits between tries (the real
 * clock when absent; tests pass a fake).
 */
export async function retriedRead<T>(endpoint: string, read: () => Promise<T>, clock: Readonly<{ now(): number; sleep(ms: number): Promise<void> }> = REAL_CLOCK): Promise<T> {
  const startedAt = clock.now();
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await read();
    } catch (error) {
      if (!retryable(error)) throw error;
      if (attempt > RETRIES) {
        throw new RunnerFailure(error.category, error.message, { cause: error, details: { ...error.details, endpoint, attempts: attempt, elapsedMs: clock.now() - startedAt } });
      }
      await clock.sleep(PAUSES_MS[attempt - 1] ?? PAUSES_MS[PAUSES_MS.length - 1]!);
    }
  }
}

/** A failure that a second try can answer: Core did not answer in time, the connection failed, or Core failed on its side. A caller's abort is not one. */
function retryable(error: unknown): error is RunnerFailure {
  if (!(error instanceof RunnerFailure)) return false;
  const details = error.details;
  if (details?.bounded === "timeout") return true;
  if (error.message === "FluxIQ HTTP transport failed") return true;
  return typeof details?.status === "number" && details.status >= 500 && details.status <= 599;
}
