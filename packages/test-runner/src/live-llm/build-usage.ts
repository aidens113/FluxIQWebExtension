// What a live Flow build spent, in the shape the budget and provider checks
// already judge. A build is not a run: Core accounts for it on the proposal it
// left (or the refusal it answered with), as a call count and provider-reported
// totals, and it does not itemize the calls one by one.

import type { CreatedFlowBuild } from "../flow-lane/index.js";
import type { LiveLlmObservedUsage } from "./observed-usage.js";

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
 * behind a guess. `observedCalls` is empty and `perCallRecords` is
 * `not recorded`, which is the truth for a build: the per-call caps are then
 * judged through Core's totals. A build that reached no provider carries a
 * gate naming Core's stage and code, so the refusal says why.
 */
export function liveLlmBuildUsage(build: CreatedFlowBuild): LiveLlmObservedUsage {
  const calls = build.providerCalls ?? (build.providerInvocation === "not_attempted" ? 0 : 1);
  const totals = build.accounting;
  const failure = build.failure;
  return {
    calls,
    interventions: 0,
    observedCalls: [],
    perCallRecords: "not recorded",
    unrecordedCalls: null,
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
