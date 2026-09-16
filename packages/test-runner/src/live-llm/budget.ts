// The caps, checked against what the run actually spent.
//
// Core enforces the same numbers on its own side, through the Flow's saved
// settings and the execution grant it counts down. This is the second check,
// and it is not redundant: the numbers Core enforces are the ones this runner
// sent it, so a bug that sent the wrong ones -- or a Core that stopped honouring
// them -- would leave a run over its budget with every call reported green. An
// unenforced cap on a path that spends real money is a defect, so a breach
// fails the run rather than being noted.

import { RunnerFailure } from "../failure.js";
import type { LiveLlmPlan } from "./live-llm-plan.js";
import type { LiveLlmObservedUsage } from "./observed-usage.js";

/** Every breach found, as short sentences naming the option that was exceeded. */
export function liveLlmBudgetBreaches(plan: LiveLlmPlan, usage: LiveLlmObservedUsage): string[] {
  const declared = plan.declared;
  // The run-wide totals are judged across the calls the grant authorized, not
  // across the operator's cap. The two are equal for an iterating purpose; for
  // one that makes a single call, the cap may be larger, and multiplying by it
  // would let one call spend what ten were allowed.
  const calls = plan.maxCalls;
  const breaches: string[] = [];
  if (usage.calls > calls) breaches.push(`the run made ${usage.calls} provider call(s) against an authorized ${calls}`);
  if (usage.calls > declared.maxCallsPerRun) breaches.push(`the run made ${usage.calls} provider call(s) against --llm-max-calls ${declared.maxCallsPerRun}`);
  // The total the grant asked for: the per-call limit across the authorized
  // calls, held to Core's own ceiling. Multiplying the operator's per-call cap by
  // a large call count would give a number no grant can reach.
  if (usage.totalEstimatedCostUsd > plan.maxTotalEstimatedCostUsd) {
    breaches.push(`the run's estimated cost ${usage.totalEstimatedCostUsd} exceeded its total cost limit of ${plan.maxTotalEstimatedCostUsd} (--llm-max-cost-usd ${declared.maxEstimatedCostUsd} across ${calls} authorized call(s), held to Core's ceiling)`);
  }
  const accounting = usage.accounting;
  if (accounting) {
    // Core counts its own breaches. One is a breach whatever this runner then computes.
    if (accounting.budgetBreaches > 0) breaches.push(`Core recorded ${accounting.budgetBreaches} budget breach(es) of its own during the run`);
    if (accounting.inputTokens > declared.maxInputTokens * calls) breaches.push(`the run used ${accounting.inputTokens} input tokens against --llm-max-input-tokens ${declared.maxInputTokens} across ${calls} authorized call(s)`);
    if (accounting.outputTokens > declared.maxOutputTokens * calls) breaches.push(`the run used ${accounting.outputTokens} output tokens against --llm-max-output-tokens ${declared.maxOutputTokens} across ${calls} authorized call(s)`);
  }
  // Total tokens are judged against the run token budget the grant asked for,
  // which is never more than every authorized call at its per-call limit and is
  // usually much less: tokens, not calls, are what bound an iterating run. Core's
  // accounting is preferred; the per-call records are the floor where Core
  // published no accounting or reported less than they add up to.
  const recordedTokens = usage.observedCalls.reduce((sum, call) => sum + (call.totalTokens ?? 0), 0);
  const runTokens = Math.max(accounting?.totalTokens ?? 0, recordedTokens);
  if (runTokens > plan.maxTotalTokensPerRun) {
    breaches.push(`the run used ${runTokens} total tokens against its run token budget of ${plan.maxTotalTokensPerRun}${declared.maxTotalTokensPerRun === undefined ? "" : ` (--llm-max-run-tokens ${declared.maxTotalTokensPerRun})`}`);
  }
  // Every itemized call is held to the per-call caps, the calls that gathered
  // evidence as much as the diagnosis and the patch. A figure the provider did
  // not report is not checked here rather than read as zero; Core's run totals
  // above still bound it.
  for (const [index, call] of usage.observedCalls.entries()) {
    const name = `call ${index + 1}${call.taskKind ? ` (${call.taskKind})` : ""}`;
    if (call.estimatedCostUsd !== null && call.estimatedCostUsd > declared.maxEstimatedCostUsd) {
      breaches.push(`${name} cost ${call.estimatedCostUsd} against --llm-max-cost-usd ${declared.maxEstimatedCostUsd}`);
    }
    if (call.inputTokens !== null && call.inputTokens > declared.maxInputTokens) {
      breaches.push(`${name} used ${call.inputTokens} input tokens against --llm-max-input-tokens ${declared.maxInputTokens}`);
    }
    if (call.outputTokens !== null && call.outputTokens > declared.maxOutputTokens) {
      breaches.push(`${name} used ${call.outputTokens} output tokens against --llm-max-output-tokens ${declared.maxOutputTokens}`);
    }
    if (call.totalTokens !== null && call.totalTokens > declared.maxTotalTokensPerRequest) {
      breaches.push(`${name} used ${call.totalTokens} total tokens against --llm-max-total-tokens ${declared.maxTotalTokensPerRequest}`);
    }
  }
  // Core itemized its calls and the lines do not account for every one it
  // counted: whatever escaped them escaped every per-call cap above, which is
  // the silent skip itemizing exists to end. A Core that itemizes nothing is
  // an older Core, reported as `not recorded` on the usage rather than failed.
  if (usage.perCallRecords === "incomplete") {
    const unrecorded = usage.unrecordedCalls ?? 0;
    breaches.push(unrecorded > 0
      ? `Core counted ${usage.calls} provider call(s) but itemized ${usage.observedCalls.length}, so ${unrecorded} call(s) escaped the per-call caps`
      : `Core counted ${usage.calls} provider call(s) but itemized ${usage.observedCalls.length}; its per-call lines and its accounting disagree`);
  }
  return breaches;
}

/**
 * Fails the run on any breach. `performance.budget` is the category, because a
 * run that overspent its authorization is a budget result, not a defect in what
 * the automation did.
 */
export function assertLiveLlmBudgetHeld(plan: LiveLlmPlan, usage: LiveLlmObservedUsage): void {
  const breaches = liveLlmBudgetBreaches(plan, usage);
  if (breaches.length) throw new RunnerFailure("performance.budget", `Live LLM budget exceeded: ${breaches.join("; ")}`, { details: { breaches } });
}

/**
 * Fails a live run that never reached the provider.
 *
 * `--live-llm` is a request for a real provider call, so a run that finished
 * without one has not done what was asked, whatever else it did. Reporting such
 * a run as a green live-LLM result is the exact failure this path exists to
 * avoid: a deterministic pass wearing a live run's clothes. Core's own gate
 * reason is quoted where it published one, because it is the only thing that
 * says whether the model was skipped deliberately or could not be reached.
 */
export function assertLiveLlmProviderWasReached(plan: LiveLlmPlan, usage: LiveLlmObservedUsage): void {
  if (usage.calls > 0) return;
  const gate = usage.gate;
  const reason = gate?.reason ?? (gate ? "Core published no reason." : "Core published no LLM gate for this run.");
  const code = gate?.code ? ` (${gate.code})` : "";
  throw new RunnerFailure("runtime.behavior", `Live LLM run reached no provider: --live-llm authorized ${plan.maxCalls} ${plan.provider} call(s) for --llm-task ${plan.task} and Core made none. ${reason}${code}`, {
    details: { calls: 0, interventions: usage.interventions, ...(gate ? { gate } : {}) },
  });
}
