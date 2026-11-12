import type { StepRecord } from "./step-record.js";

/**
 * A run's steps cut into its attempts, in order. A new attempt begins at a typed instruction (`chat`), and at a saved Flow's
 * first node (`flow`) when it follows a judge or a note, which is how one attempt's replay ends and the next one's begins.
 * Steps of one attempt that run the Flow after exploring stay with it.
 */
export function splitAttempts(records: readonly StepRecord[]): StepRecord[][] {
  const attempts: StepRecord[][] = [];
  records.forEach((record, index) => {
    const before = records[index - 1];
    const begins = attempts.length === 0 || record.kind === "chat" || (record.kind === "flow" && before !== undefined && (before.kind === "judge" || before.kind === "note"));
    if (begins && !(record.kind === "chat" && attempts.at(-1)?.length === 0)) attempts.push([]);
    attempts.at(-1)!.push(record);
  });
  return attempts;
}
