// Times each step of the Lab prelude and says whether it rebuilt or reused.
//
// The prelude used to spend minutes before a scenario started without saying
// where; every step now prints one JSON line with its duration and outcome,
// and the whole prelude one summary line, so a slow start is read rather than
// guessed at.

/**
 * @typedef {{ step: string, ms: number, action: string, reason?: string }} StepTiming
 */

/**
 * @param {(line: Record<string, unknown>) => void} write
 * @param {() => number} [now]
 */
export function createStepTimer(write, now = () => performance.now()) {
  const started = now();
  /** @type {StepTiming[]} */
  const rows = [];
  return {
    rows,
    /**
     * Runs `body`, which may return `{ action, reason }`; anything else is
     * recorded as `ran`. A failure is recorded as `failed` and rethrown.
     *
     * @template T
     * @param {string} step
     * @param {() => Promise<T>} body
     * @returns {Promise<T>}
     */
    async time(step, body) {
      const begin = now();
      let outcome;
      try {
        outcome = await body();
      } catch (error) {
        record(step, now() - begin, "failed");
        throw error;
      }
      const action = typeof outcome === "object" && outcome !== null && typeof outcome.action === "string" ? outcome.action : "ran";
      const reason = typeof outcome === "object" && outcome !== null && typeof outcome.reason === "string" ? outcome.reason : undefined;
      record(step, now() - begin, action, reason);
      return outcome;
    },
    /** Prints the one line that says how long the prelude took before the run began. */
    finish() {
      const ms = Math.round(now() - started);
      write({ lab: "prelude", step: "total", ms, rebuilt: rows.filter(row => row.action === "rebuilt").map(row => row.step), reused: rows.filter(row => row.action === "reused").map(row => row.step) });
      return ms;
    }
  };

  /** @param {string} step @param {number} elapsed @param {string} action @param {string} [reason] */
  function record(step, elapsed, action, reason) {
    const row = { step, ms: Math.round(elapsed), action, ...(reason === undefined ? {} : { reason }) };
    rows.push(row);
    write({ lab: "prelude", ...row });
  }
}
