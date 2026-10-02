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
import type { FinalStateVerdict, UnheldFact } from "./final-state-facts.js";
import { assertCreatedFlowDataset, createdFlowDatasetHolds } from "./judgement.js";

/**
 * Each oracle's verdict, `not_declared` where the task holds the run to no such
 * thing. A failed final state carries the facts that did not hold
 * (`final-state-facts.ts`), and `finalStateUnjudged` when they could not be read.
 */
export type CreatedFlowOracles = Readonly<{
  records: "held" | "failed" | "not_declared";
  finalState: "held" | "failed" | "not_declared";
  unheldFacts?: readonly UnheldFact[];
  finalStateUnjudged?: string;
}>;

/**
 * The verdict of each oracle. The final state is consulted for a dataset task
 * only when its workflow declares one; a goal task is judged by it always, as
 * it always was.
 */
export async function judgeCreatedFlowOracles(input: {
  extraction: FlowExtractionJudgement | null;
  declaresFinalState: boolean;
  judgeFinalState: () => Promise<FinalStateVerdict>;
}): Promise<CreatedFlowOracles> {
  const records = input.extraction ? (createdFlowDatasetHolds(input.extraction) ? "held" : "failed") : "not_declared";
  if (input.extraction && !input.declaresFinalState) return { records, finalState: "not_declared" };
  const verdict = await input.judgeFinalState();
  if (verdict.held) return { records, finalState: "held" };
  return { records, finalState: "failed", ...(verdict.unheldFacts.length > 0 ? { unheldFacts: verdict.unheldFacts } : {}), ...(verdict.unjudged === undefined ? {} : { finalStateUnjudged: verdict.unjudged }) };
}

/** The facts a failed final state names, for the failure's one line: `cart-line, coupons-held`, or why none could be named. */
function unheldFactsClause(oracles: CreatedFlowOracles): string {
  const ids = (oracles.unheldFacts ?? []).map(fact => fact.factId);
  if (ids.length > 0) return ` (fact${ids.length === 1 ? "" : "s"} not held: ${ids.join(", ")})`;
  return oracles.finalStateUnjudged === undefined ? "" : ` (its facts could not be read: ${oracles.finalStateUnjudged})`;
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
      throw new RunnerFailure(error.category, `${error.message}; and the scenario's final state did not hold afterwards${unheldFactsClause(oracles)}`, { details: { ...(error.details ?? {}), oracles } });
    }
  }
  if (!finalStateFailed) return;
  throw new RunnerFailure("runtime.behavior", extraction
    ? `The created Flow stored the expected records, but the scenario's final state did not hold afterwards${unheldFactsClause(oracles)}`
    : `The created Flow ran, but the scenario's playback goal did not hold afterwards${unheldFactsClause(oracles)}`, { details: { oracles } });
}
