import { flowScores, type BenchAnswerScore, type FlowScore, type RunEvaluation } from "@fluxiq-web-extension/test-contracts";

/** A run judged on real inputs only: one with a stand-in anywhere proves the Lab, not the product, and enters no rate. */
const realAnswer = (evaluation: RunEvaluation) => (evaluation.answer && evaluation.answer.standIns.length === 0 ? evaluation.answer : undefined);

/**
 * Right over right and wrong for one result's runs. `undefined` when no run was
 * judged, so a result from before answer scores states none and nothing is inferred
 * from its `verdict`; `null` when every judged run ended excused.
 */
export function benchAnswerRate(evaluations: readonly RunEvaluation[]): number | null | undefined {
  const judged = evaluations.flatMap((evaluation) => {
    const answer = realAnswer(evaluation);
    return answer ? [answer] : [];
  });
  if (judged.length === 0) return undefined;
  const right = judged.filter((answer) => answer.verdict === "right").length;
  const decided = right + judged.filter((answer) => answer.verdict === "wrong").length;
  return decided === 0 ? null : right / decided;
}

/** The answer's score over every evaluated run, or `undefined` when none was judged, as in a bench from before it. */
export function benchAnswerScore(evaluations: readonly RunEvaluation[]): BenchAnswerScore | undefined {
  const scored = evaluations.filter((evaluation) => evaluation.answer);
  if (scored.length === 0) return undefined;
  const flow = Object.fromEntries(flowScores.map((score) => [score, 0])) as Record<FlowScore, number>;
  const counts = { right: 0, wrong: 0, budgetOut: 0, stoppedByPerson: 0, runsWithRepeatedActs: 0 };
  let judged = 0;
  for (const evaluation of scored) {
    const answer = realAnswer(evaluation);
    if (!answer) continue;
    judged += 1;
    flow[answer.flow] += 1;
    if (answer.repeatedActs.length > 0) counts.runsWithRepeatedActs += 1;
    if (answer.verdict === "right") counts.right += 1;
    else if (answer.verdict === "wrong") counts.wrong += 1;
    else if (answer.verdict === "budget_out") counts.budgetOut += 1;
    else counts.stoppedByPerson += 1;
  }
  const decided = counts.right + counts.wrong;
  return { judged, ...counts, rate: decided === 0 ? null : counts.right / decided, flow, standInRuns: scored.length - judged };
}
