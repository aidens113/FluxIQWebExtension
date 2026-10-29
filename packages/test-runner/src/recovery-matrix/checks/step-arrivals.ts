// A step's arrivals in a run's trace: each time the run came to it, with the
// attempts it spent there.
//
// Retries are counted per arrival (Core `step-loop/arrival.ts`), and a loop's
// body step is arrived at once per pass, so "at most four attempts" and "the
// fourth attempt re-acquired" are statements about one arrival, not about the
// node over the whole run. An arrival opens with an attempt that is no retry,
// and the retries Core stamped after it are its own (`retry.attemptNumber`).

import type { MatrixTraceAttempt } from "../records/index.js";

/** The arrivals at the step `isStep` picks out, in trace order, each its attempts in order. */
export function matrixStepArrivals(trace: readonly MatrixTraceAttempt[], isStep: (attempt: MatrixTraceAttempt) => boolean): MatrixTraceAttempt[][] {
  const arrivals: MatrixTraceAttempt[][] = [];
  let current: MatrixTraceAttempt[] | undefined;
  for (const attempt of trace) {
    if (!isStep(attempt)) continue;
    if (current === undefined || attempt.retryNumber === null) {
      current = [attempt];
      arrivals.push(current);
    } else {
      current.push(attempt);
    }
  }
  return arrivals;
}
