import type { AttemptOutcomeRecord } from "./read.js";

/**
 * A proof stopped waiting: not a judgement of the attempt, which is not over. `stood` says where it was, in words.
 * `attempt` is what Core had recorded of the attempt that did not end, when it had recorded one: its spend still counts.
 */
export class AttemptProofStuck extends Error {
  readonly name = "AttemptProofStuck";

  constructor(readonly stood: string, readonly attempt: AttemptOutcomeRecord | null = null) {
    super(`The proof stopped waiting: ${stood}`);
  }
}
