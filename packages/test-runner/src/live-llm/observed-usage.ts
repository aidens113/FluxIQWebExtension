// What a live run actually spent, read back from Core's persisted run detail
// rather than from anything the runner believed while the run was in flight.
// Counts, token totals and a cost figure only: no prompt, no response, and no
// page data is read here, so this can be published in an evaluation.

import type { ExistingRunDetail, ExistingRunLlmAccounting } from "../existing-fluxiq-control.js";

/** One provider call Core recorded, reduced to what a budget check and an evaluation need. */
export type LiveLlmObservedCall = {
  provider: string | null;
  model: string | null;
  promptVersion: string | null;
  validationOk: boolean | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  estimatedCostUsd: number | null;
};

export type LiveLlmObservedUsage = {
  /** Core's own provider call count where it published one, else the calls whose tokens it recorded. */
  calls: number;
  interventions: number;
  observedCalls: LiveLlmObservedCall[];
  totalEstimatedCostUsd: number;
  /**
   * Core's per-run accounting, which is what the budget is actually judged
   * against. An intervention record may omit its token usage -- a staged
   * diagnosis does -- and reading only those would leave a run with real spend
   * looking like a run that spent nothing.
   */
  accounting: ExistingRunLlmAccounting | null;
  /** Core's gate record: why it did or did not reach the provider. */
  gate: ExistingRunDetail["llmGate"] | null;
};

/**
 * Reduces a run detail to its provider usage. `providerCallCount` is Core's own
 * accounting and is trusted where present; the interventions are counted only
 * as a floor, because an intervention Core recorded without reaching a provider
 * (a resolution failure, say) still appears in that list.
 */
export function liveLlmObservedUsage(detail: ExistingRunDetail): LiveLlmObservedUsage {
  const interventions = detail.interventions ?? [];
  const observedCalls = interventions.map(item => ({
    provider: item.provider ?? null,
    model: item.model ?? null,
    promptVersion: item.promptVersion ?? null,
    validationOk: item.validationOk ?? null,
    inputTokens: item.inputTokens ?? null,
    outputTokens: item.outputTokens ?? null,
    totalTokens: item.totalTokens ?? null,
    estimatedCostUsd: item.estimatedCostUsd ?? null,
  }));
  const accounting = detail.llmAccounting ?? null;
  return {
    calls: accounting?.calls ?? detail.providerCallCount ?? observedCalls.filter(call => call.totalTokens !== null).length,
    interventions: interventions.length,
    observedCalls,
    totalEstimatedCostUsd: accounting?.estimatedCostUsd ?? observedCalls.reduce((sum, call) => sum + (call.estimatedCostUsd ?? 0), 0),
    accounting,
    gate: detail.llmGate ?? null,
  };
}
