import type { ExistingRunDetail } from "../../index.js";

/** A missing ledger is unknown. Require an explicit zero and reject contradictory evidence. */
export function providerFreeReplayFailures(detail: Pick<ExistingRunDetail,
  "providerCallCount" | "llmAccounting" | "providerCalls" | "providerCallsOmitted" | "interventions" | "llmGate"
>, harnessActivations: number): string[] {
  const failures: string[] = [];
  const accounting = detail.llmAccounting;
  if (detail.providerCallCount === undefined && accounting?.calls === undefined) failures.push("Core published no provider call accounting for the replay");
  if (detail.providerCallCount !== undefined && detail.providerCallCount !== 0) failures.push("Core reported provider calls during the replay");
  if (accounting && (["calls", "inputTokens", "outputTokens", "totalTokens", "estimatedCostUsd", "budgetBreaches", "pendingCalls"] as const).some(key => accounting[key] !== 0)) failures.push("Core reported nonzero or incomplete model accounting during the replay");
  if (detail.providerCalls?.length || detail.providerCallsOmitted) failures.push("Core recorded or omitted provider calls during the replay");
  if (detail.interventions?.length) failures.push("Core recorded model interventions during the replay");
  if (detail.llmGate && detail.llmGate.invoked !== false) failures.push("Core's model gate was invoked during the replay");
  if (harnessActivations !== 0) failures.push("Core's recovery harness activated during the replay");
  return failures;
}
