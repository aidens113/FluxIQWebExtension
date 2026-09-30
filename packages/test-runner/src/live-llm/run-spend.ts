// Every provider call a live run made, added up once, with where each came from.
//
// A live run pays for up to four kinds of call, and Core keeps each in a
// different record: the build's on its proposal, the Flow run's own recovery
// on the run's accounting, the result check's on the run's interventions, and
// a re-author's on `metadata.resultReauthor` and its adaptation. Settlements
// used to publish one of them as the run's `observed` total, so the machine's
// spend ledger, which reads exactly that total, under-reported every run that
// judged or re-authored (`run-munw7ffn-fe1cecd2`: $0.0418 recorded of about
// $0.0861 spent). This is the sum, and the phases stay beside it so each can
// still be read, and budgeted, on its own.
//
// **No call is counted twice.** The result check's calls are made outside the
// run's budget, so Core's accounting and per-call lines leave them out -- but
// a run detail with neither is read from its interventions, which do include
// them (`observed-usage.ts`). A check call the run phase already itemized, by
// its request id, is taken out of that phase and counted under `judge` only.

import type { LiveLlmObservedUsage } from "./observed-usage.js";
import type { LiveLlmReauthorRecord } from "./reauthor-record.js";

/** One phase's share: Core's call count where it gave one, and its cost. */
export type LiveLlmSpendPhase = { calls: number | null; estimatedCostUsd: number };

export type LiveLlmRunSpend = {
  /** Every call the phases counted. A phase that could not count its calls adds none, and `uncountedPhases` names it. */
  calls: number;
  totalEstimatedCostUsd: number;
  phases: {
    build: LiveLlmSpendPhase | null;
    /** The Flow run's own calls: diagnosis, exploration and runtime repair. */
    runtime: LiveLlmSpendPhase | null;
    /** Core's result check, on the run's interventions. */
    judge: LiveLlmSpendPhase | null;
    /** Every re-author attempt, its retries included. */
    reauthor: LiveLlmSpendPhase | null;
  };
  uncountedPhases: Array<"judge" | "reauthor">;
};

/** The result check's calls, as the settlement's verification record lists them. */
export type LiveLlmJudgeCalls = { interventions: ReadonlyArray<{ requestId: string | null; estimatedCostUsd: number | null }> };

export function liveLlmRunSpend(input: {
  build?: LiveLlmObservedUsage | null | undefined;
  runtime?: LiveLlmObservedUsage | null | undefined;
  judge?: LiveLlmJudgeCalls | null | undefined;
  reauthor?: LiveLlmReauthorRecord | null | undefined;
}): LiveLlmRunSpend {
  const build = input.build ? { calls: input.build.calls, estimatedCostUsd: input.build.totalEstimatedCostUsd } : null;
  const judgeCalls = input.judge?.interventions ?? [];
  const judge = judgeCalls.length > 0 ? { calls: judgeCalls.length, estimatedCostUsd: sum(judgeCalls.map((call) => call.estimatedCostUsd ?? 0)) } : null;
  const runtime = input.runtime ? runtimeWithoutJudge(input.runtime, judgeCalls) : null;
  const reauthor = input.reauthor && input.reauthor.attempts.length > 0
    ? { calls: input.reauthor.uncountedAttempts > 0 && input.reauthor.calls === 0 ? null : input.reauthor.calls, estimatedCostUsd: input.reauthor.totalEstimatedCostUsd }
    : null;
  const phases = [build, runtime, judge, reauthor];
  return {
    calls: phases.reduce((total, phase) => total + (phase?.calls ?? 0), 0),
    totalEstimatedCostUsd: sum(phases.map((phase) => phase?.estimatedCostUsd ?? 0)),
    phases: { build, runtime, judge, reauthor },
    uncountedPhases: input.reauthor && input.reauthor.uncountedAttempts > 0 ? ["reauthor"] : [],
  };
}

/**
 * The run phase with any result-check call it itemized taken out.
 *
 * Only a run read from its interventions -- no accounting, no per-call lines
 * -- can hold one, and there its figures are the interventions' own, so the
 * matched calls come out of both its count and its cost.
 */
function runtimeWithoutJudge(runtime: LiveLlmObservedUsage, judgeCalls: LiveLlmJudgeCalls["interventions"]): LiveLlmSpendPhase {
  const fromInterventions = runtime.accounting === null && runtime.perCallRecords === "not recorded";
  const judgeIds = new Set(judgeCalls.flatMap((call) => call.requestId ?? []));
  const matched = fromInterventions ? runtime.observedCalls.filter((call) => call.requestId !== null && judgeIds.has(call.requestId)) : [];
  return {
    calls: Math.max(0, runtime.calls - matched.filter((call) => call.totalTokens !== null || call.estimatedCostUsd !== null).length),
    estimatedCostUsd: Math.max(0, sum([runtime.totalEstimatedCostUsd, ...matched.map((call) => -(call.estimatedCostUsd ?? 0))])),
  };
}

/** Rounded to the nano-dollar, so a sum of provider figures does not carry float dust into a ledger. */
function sum(values: readonly number[]): number {
  return Number(values.reduce((total, value) => total + value, 0).toFixed(9));
}
