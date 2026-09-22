// A deterministic run, as Core records it: no provider call, no intervention,
// no adaptation, no change proposal. Every journey that runs a saved Flow
// under "No LLM intervention" checks the run it started against this, so a run
// that quietly consulted a model can never be counted as the Flow working.
import type { ExistingRunDetail } from "../../existing-fluxiq-control.js";
import { RunnerFailure } from "../../failure.js";

/** The model activity Core recorded for one run, as counts. */
export type RunModelActivity = Readonly<{ providerCalls: number; accountedCalls: number; interventions: number; adaptations: number; changeProposals: number }>;

export function runModelActivity(detail: ExistingRunDetail): RunModelActivity {
  return {
    providerCalls: detail.providerCallCount ?? 0,
    accountedCalls: detail.llmAccounting?.calls ?? 0,
    interventions: detail.interventions?.length ?? 0,
    adaptations: detail.adaptationIds?.length ?? 0,
    changeProposals: detail.changeProposalIds?.length ?? 0,
  };
}

/** Fails `run.model_activity` when Core recorded any model activity for the run. */
export function assertProviderFreeRun(detail: ExistingRunDetail): RunModelActivity {
  const activity = runModelActivity(detail);
  if (Object.values(activity).some(count => count !== 0)) {
    throw new RunnerFailure("runtime.behavior", "A run started under No LLM intervention recorded model activity", { details: { reasonCode: "run.model_activity", ...activity } });
  }
  return activity;
}
