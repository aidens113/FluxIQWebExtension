// What a live run actually spent, read back from Core's persisted run detail
// rather than from anything the runner believed while the run was in flight.
// Counts, token totals and a cost figure only: no prompt, no response, and no
// page data is read here, so this can be published in an evaluation.

import type { ExistingRunDetail, ExistingRunIntervention, ExistingRunLlmAccounting, ExistingRunProviderCall } from "../existing-fluxiq-control.js";

/** One provider call Core recorded, reduced to what a budget check and an evaluation need. */
export type LiveLlmObservedCall = {
  requestId: string | null;
  /** Core's task kind, such as `evidence_tool_decision`. `null` where Core did not say. */
  taskKind: string | null;
  stage: string | null;
  provider: string | null;
  model: string | null;
  promptVersion: string | null;
  validationOk: boolean | null;
  /**
   * Core's issue codes for a call whose answer did not validate: codes only,
   * never message text, so a failed call says why without quoting the provider.
   */
  validationCodes: string[];
  /** What the provider reported. `null` where it reported nothing: never a reservation, never a zero. */
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  estimatedCostUsd: number | null;
};

/**
 * Whether `observedCalls` itemizes every provider call Core counted.
 *
 * - `recorded`: Core's own per-call lines, one for every call it counted.
 * - `incomplete`: Core published per-call lines that do not account for
 *   exactly the calls it counted, so some call escaped the per-call checks.
 * - `not recorded`: Core published no per-call lines (a Core older than them),
 *   so `observedCalls` falls back to the interventions, and a call that left
 *   no intervention -- an evidence-gathering call, say -- is not itemized.
 */
export type LiveLlmPerCallRecords = "recorded" | "incomplete" | "not recorded";

export type LiveLlmObservedUsage = {
  /** Core's own provider call count where it published one, else the calls it itemized. */
  calls: number;
  interventions: number;
  observedCalls: LiveLlmObservedCall[];
  perCallRecords: LiveLlmPerCallRecords;
  /**
   * Calls Core counted that `observedCalls` does not itemize. `null` when that
   * cannot be known, because Core itemized nothing.
   */
  unrecordedCalls: number | null;
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
 * Reduces a run detail to its provider usage.
 *
 * Core's per-call lines are the source wherever it published them: they are
 * one line per call, evidence-gathering calls included. A run detail without
 * them is read the old way, from the interventions, and says so, because an
 * intervention exists only for a diagnosis or a patch. `providerCallCount` is
 * Core's own accounting and is trusted where present; the interventions are
 * counted only as a floor, because an intervention Core recorded without
 * reaching a provider (a resolution failure, say) still appears in that list.
 */
export function liveLlmObservedUsage(detail: ExistingRunDetail): LiveLlmObservedUsage {
  const interventions = detail.interventions ?? [];
  const accounting = detail.llmAccounting ?? null;
  const gate = detail.llmGate ?? null;
  const lines = detail.providerCalls;
  if (lines === undefined) {
    const observedCalls = interventions.map(fromIntervention);
    return {
      calls: accounting?.calls ?? detail.providerCallCount ?? observedCalls.filter(call => call.totalTokens !== null).length,
      interventions: interventions.length,
      observedCalls,
      perCallRecords: "not recorded",
      unrecordedCalls: null,
      totalEstimatedCostUsd: accounting?.estimatedCostUsd ?? observedCalls.reduce((sum, call) => sum + (call.estimatedCostUsd ?? 0), 0),
      accounting,
      gate,
    };
  }
  const omitted = detail.providerCallsOmitted ?? 0;
  const calls = accounting?.calls ?? detail.providerCallCount ?? lines.length + omitted;
  const complete = omitted === 0 && lines.length === calls;
  return {
    calls,
    interventions: interventions.length,
    observedCalls: lines.map(fromProviderCall),
    perCallRecords: complete ? "recorded" : "incomplete",
    unrecordedCalls: Math.max(0, calls - lines.length),
    // Core's charged figures add up to its accounting, reservations included,
    // so they are the fallback total; the reported figures alone would not be.
    totalEstimatedCostUsd: accounting?.estimatedCostUsd ?? lines.reduce((sum, line) => sum + line.charged.estimatedCostUsd, 0),
    accounting,
    gate,
  };
}

function fromProviderCall(line: ExistingRunProviderCall): LiveLlmObservedCall {
  return {
    requestId: line.requestId,
    taskKind: line.taskKind,
    stage: line.stage,
    provider: line.provider,
    model: line.model,
    promptVersion: line.promptVersion,
    validationOk: line.validationOk,
    validationCodes: [...line.validationCodes],
    inputTokens: line.inputTokens,
    outputTokens: line.outputTokens,
    totalTokens: line.totalTokens,
    estimatedCostUsd: line.estimatedCostUsd,
  };
}

function fromIntervention(item: ExistingRunIntervention): LiveLlmObservedCall {
  return {
    requestId: item.requestId ?? null,
    taskKind: null,
    stage: null,
    provider: item.provider ?? null,
    model: item.model ?? null,
    promptVersion: item.promptVersion ?? null,
    validationOk: item.validationOk ?? null,
    validationCodes: [...(item.validationCodes ?? [])],
    inputTokens: item.inputTokens ?? null,
    outputTokens: item.outputTokens ?? null,
    totalTokens: item.totalTokens ?? null,
    estimatedCostUsd: item.estimatedCostUsd ?? null,
  };
}
