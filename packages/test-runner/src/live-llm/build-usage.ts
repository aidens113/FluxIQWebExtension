// What a live Flow build spent, in the shape the budget and provider checks
// already judge. A build is not a run: Core accounts for it on the proposal it
// left (or the refusal it answered with), as a call count and provider-reported
// totals, and its per-call ledger is the evidence loop's own decision rows
// rather than the per-call lines a run carries.

import type { CreatedFlowBuild, CreatedFlowBuildStep } from "../flow-lane/index.js";
import type { LiveLlmObservedCall, LiveLlmObservedUsage } from "./observed-usage.js";

/**
 * `calls` is Core's count: `totalProviderCallCount`, which is one per loop
 * decision plus whatever the build spent outside the loop. It is per
 * *decision*, never per published trace row. Core counted rows until t098, and
 * the one kind of decision that edits the draft and re-runs a step writes two
 * of them under a single iteration, so a build that made 16 provider calls was
 * reported here as having made 22 and every per-call figure anyone derived from
 * it -- input tokens, money, seconds -- came out 27% too low
 * (`run-mudw1ktb-0557816b`). Nothing changed in this function for that; the
 * number arriving in `providerCalls` is simply the right one now.
 *
 * Where Core gave none, a build it says it sent a
 * request for counts as one call and a build it says it never sent counts as
 * none, so an unknown count can neither pass as spend-free nor hide a refusal
 * behind a guess. A build that reached no provider carries a gate naming Core's
 * stage and code, so the refusal says why.
 *
 * **The per-call ledger is read, not declared absent.** `observedCalls` was the
 * empty list and `perCallRecords` the constant `not recorded` for every build
 * ever measured, so no per-call cap was ever checked on the one paid step of a
 * created-Flow run and no bundle said what any single call of a build cost.
 * Core records the call on the decision row -- its iteration, its call id and
 * what it spent -- and `buildProviderCalls` reads the rows that carry one. A
 * Core, or a reader, that publishes none still reports `not recorded`, which
 * stays the honest answer rather than a hard-coded one.
 */
export function liveLlmBuildUsage(build: CreatedFlowBuild): LiveLlmObservedUsage {
  const calls = build.providerCalls ?? (build.providerInvocation === "not_attempted" ? 0 : 1);
  const totals = build.accounting;
  const failure = build.failure;
  const observedCalls = buildProviderCalls(build);
  return {
    calls,
    interventions: 0,
    observedCalls,
    perCallRecords: observedCalls.length >= calls && observedCalls.length > 0 ? "recorded" : "not recorded",
    unrecordedCalls: observedCalls.length === 0 ? null : Math.max(0, calls - observedCalls.length),
    totalEstimatedCostUsd: totals?.estimatedCostUsd ?? 0,
    accounting: totals
      ? {
          calls,
          inputTokens: totals.inputTokens ?? 0,
          outputTokens: totals.outputTokens ?? 0,
          totalTokens: totals.totalTokens ?? (totals.inputTokens ?? 0) + (totals.outputTokens ?? 0),
          estimatedCostUsd: totals.estimatedCostUsd ?? 0,
          budgetBreaches: 0,
          pendingCalls: 0,
        }
      : null,
    gate: calls > 0
      ? { invoked: true }
      : {
          invoked: false,
          reason: failure
            ? `Core's Flow build stopped${failure.stage ? ` at ${failure.stage}` : ""} before a provider answered.`
            : "Core's Flow build reported no provider call.",
          ...(failure ? { code: failure.code } : {}),
        },
  };
}

/**
 * The build's provider calls, one per paid loop iteration, from the decision
 * rows that carry a record of one.
 *
 * A row is grouped by its iteration, because that is what Core counts a
 * provider call by: an `amend_draft` decision that re-runs a step writes its
 * own row and the rerun's row under the one iteration that paid for both, and
 * counting the rows would itemize one call twice. Figures are filled in from
 * the first row that reports them and never added together, for the same
 * reason. Iteration 0 is the deterministic observation the loop may make before
 * its first decision and is not a paid call, so it is left out.
 *
 * **`incomplete` is never reported here, and that is deliberate.** For a run it
 * means a call escaped every per-call cap, and it fails the run. A build's
 * counted calls include the ones Core makes outside the loop -- reading what
 * the person's instruction already asks for -- which write no decision row and
 * can never be itemized from one, so judging a build's rows as a run's lines
 * would fail every build that Core accounted for correctly. A ledger that does
 * not reach the count is reported as the fallback it is: the calls it did
 * itemize are published and still held to every per-call cap, and
 * `unrecordedCalls` says how many were not.
 */
function buildProviderCalls(build: CreatedFlowBuild): LiveLlmObservedCall[] {
  const steps = build.evidenceLoop?.steps;
  if (!steps) return [];
  const byCall = new Map<string, LiveLlmObservedCall>();
  for (const [index, step] of steps.entries()) {
    const iteration = count(step.iteration);
    if (iteration === 0) continue;
    const callId = text(step.callId);
    const usage = usageOf(step);
    // A row that records no call of its own -- an older Core's row, or one
    // whose decision Core reported nothing per-call for -- itemizes nothing.
    if (callId === null && usage === undefined) continue;
    const key = iteration !== null ? `iteration:${iteration}` : callId !== null ? `call:${callId}` : `row:${index}`;
    const known = byCall.get(key);
    byCall.set(key, known ? fillGaps(known, observedCall(build, callId, usage)) : observedCall(build, callId, usage));
  }
  return [...byCall.values()];
}

/** One call as the budget checks read it: what the row said, and the provider and model the build itself ran on. */
function observedCall(build: CreatedFlowBuild, callId: string | null, usage: Readonly<Record<string, string | number | boolean>> | undefined): LiveLlmObservedCall {
  const inputTokens = count(usage?.inputTokens);
  const outputTokens = count(usage?.outputTokens);
  return {
    requestId: callId,
    // Core names no task kind, stage, prompt version or validation verdict per
    // decision row. They are `null` rather than invented: a build's row says
    // what the call spent, not how it was composed.
    taskKind: null,
    stage: null,
    // The build's own reported provider and model. A build runs under one
    // grant, bound to one provider and one model, and `settleBuild` fails the
    // run when Core reports it ran on another.
    provider: build.accounting?.provider ?? null,
    model: build.accounting?.model ?? null,
    promptVersion: null,
    validationOk: null,
    validationCodes: [],
    inputTokens,
    outputTokens,
    // Core's own usage keeps `totalTokens === inputTokens + outputTokens`
    // wherever it reports them, so a missing total is derived rather than left
    // unchecked against the per-request ceiling.
    totalTokens: count(usage?.totalTokens) ?? (inputTokens !== null && outputTokens !== null ? inputTokens + outputTokens : null),
    estimatedCostUsd: count(usage?.estimatedCostUsd),
  };
}

/** The same call, seen twice under one iteration: whatever the second row adds is taken, and nothing is added up. */
function fillGaps(known: LiveLlmObservedCall, later: LiveLlmObservedCall): LiveLlmObservedCall {
  return {
    ...known,
    requestId: known.requestId ?? later.requestId,
    inputTokens: known.inputTokens ?? later.inputTokens,
    outputTokens: known.outputTokens ?? later.outputTokens,
    totalTokens: known.totalTokens ?? later.totalTokens,
    estimatedCostUsd: known.estimatedCostUsd ?? later.estimatedCostUsd,
  };
}

/** The row's own per-call spend, where it carried one. */
function usageOf(step: CreatedFlowBuildStep): Readonly<Record<string, string | number | boolean>> | undefined {
  const usage = step.usage;
  return usage !== undefined && typeof usage === "object" && !Array.isArray(usage) ? usage : undefined;
}

/** A number a row reported, or `null` for anything that is not one: never a zero standing in for what was not said. */
function count(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
