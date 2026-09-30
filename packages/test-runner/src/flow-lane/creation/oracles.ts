// Both oracles a created Flow's run is held to: the records it stored, and the
// state the scenario declares the page must be left in.
//
// A dataset task was judged by its records alone, and a task's declared
// `finalState` was never read (lane t184). So a run that stored the right
// records by the wrong route passed: bigbox pickup-order that deleted the soap
// instead of saving it for later, or a kettle-to-cart run that deleted the
// phone case, left the same records as the honest run. A run now passes only
// when every oracle the task declares holds, and a failure names which did not.

import { RunnerFailure } from "../../failure.js";
import type { FlowExtractionJudgement } from "../expectations.js";
import { assertCreatedFlowDataset, createdFlowDatasetHolds } from "./judgement.js";

/** Each oracle's verdict, `not_declared` where the task holds the run to no such thing. */
export type CreatedFlowOracles = Readonly<{
  records: "held" | "failed" | "not_declared";
  finalState: "held" | "failed" | "not_declared";
}>;

/**
 * The verdict of each oracle. The final state is consulted for a dataset task
 * only when its workflow declares one; a goal task is judged by it always, as
 * it always was.
 */
export async function judgeCreatedFlowOracles(input: {
  extraction: FlowExtractionJudgement | null;
  declaresFinalState: boolean;
  checkFinalState: () => Promise<boolean>;
}): Promise<CreatedFlowOracles> {
  const records = input.extraction ? (createdFlowDatasetHolds(input.extraction) ? "held" : "failed") : "not_declared";
  const finalState = !input.extraction || input.declaresFinalState ? ((await input.checkFinalState()) ? "held" : "failed") : "not_declared";
  return { records, finalState };
}

/** Whether every oracle the task declares held. */
export function createdFlowOraclesHold(oracles: CreatedFlowOracles): boolean {
  return oracles.records !== "failed" && oracles.finalState !== "failed";
}

/**
 * Fails a run whose oracles did not all hold, naming which. The records'
 * own failure keeps its account of what was stored and expected; a final state
 * that also failed is added to it rather than hidden behind it.
 */
export function assertCreatedFlowOracles(extraction: FlowExtractionJudgement | null, oracles: CreatedFlowOracles): void {
  const finalStateFailed = oracles.finalState === "failed";
  if (extraction && oracles.records === "failed") {
    try {
      assertCreatedFlowDataset(extraction);
    } catch (error) {
      if (!finalStateFailed || !(error instanceof RunnerFailure)) throw error;
      throw new RunnerFailure(error.category, `${error.message}; and the scenario's final state did not hold afterwards`, { details: { ...(error.details ?? {}), oracles } });
    }
  }
  if (!finalStateFailed) return;
  throw new RunnerFailure("runtime.behavior", extraction
    ? "The created Flow stored the expected records, but the scenario's final state did not hold afterwards"
    : "The created Flow ran, but the scenario's playback goal did not hold afterwards", { details: { oracles } });
}
