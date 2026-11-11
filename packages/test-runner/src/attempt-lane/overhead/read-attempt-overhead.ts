import type { AttemptOverhead } from "./attempt-overhead.js";
import { overheadOfSteps } from "./overhead-of-steps.js";
import { readStepRecords } from "./read-step-records.js";

/** Each attempt's overhead, read from the run's `steps/` folder. Reads files only; an unreadable folder gives none. */
export async function readAttemptOverhead(stepsDirectory: string): Promise<AttemptOverhead[]> {
  return overheadOfSteps(await readStepRecords(stepsDirectory));
}
