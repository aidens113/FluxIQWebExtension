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
  const breaches: string[] = [];
  if (usage.calls > plan.maxCalls) breaches.push(`the run made ${usage.calls} provider call(s) against an authorized ${plan.maxCalls}`);
  if (usage.calls > declared.maxCallsPerRun) breaches.push(`the run made ${usage.calls} provider call(s) against --llm-max-calls ${declared.maxCallsPerRun}`);
  if (usage.totalEstimatedCostUsd > declared.maxEstimatedCostUsd * declared.maxCallsPerRun) {
    breaches.push(`the run's estimated cost ${usage.totalEstimatedCostUsd} exceeded --llm-max-cost-usd ${declared.maxEstimatedCostUsd} across ${declared.maxCallsPerRun} authorized call(s)`);
  }
  const accounting = usage.accounting;
  if (accounting) {
    // Core counts its own breaches. One is a breach whatever this runner then computes.
    if (accounting.budgetBreaches > 0) breaches.push(`Core recorded ${accounting.budgetBreaches} budget breach(es) of its own during the run`);
    if (accounting.inputTokens > declared.maxInputTokens * declared.maxCallsPerRun) breaches.push(`the run used ${accounting.inputTokens} input tokens against --llm-max-input-tokens ${declared.maxInputTokens} across ${declared.maxCallsPerRun} authorized call(s)`);
    if (accounting.outputTokens > declared.maxOutputTokens * declared.maxCallsPerRun) breaches.push(`the run used ${accounting.outputTokens} output tokens against --llm-max-output-tokens ${declared.maxOutputTokens} across ${declared.maxCallsPerRun} authorized call(s)`);
    if (accounting.totalTokens > declared.maxTotalTokensPerRequest * declared.maxCallsPerRun) breaches.push(`the run used ${accounting.totalTokens} total tokens against --llm-max-total-tokens ${declared.maxTotalTokensPerRequest} across ${declared.maxCallsPerRun} authorized call(s)`);
  }
  for (const [index, call] of usage.observedCalls.entries()) {
    if (call.estimatedCostUsd !== null && call.estimatedCostUsd > declared.maxEstimatedCostUsd) {
      breaches.push(`call ${index + 1} cost ${call.estimatedCostUsd} against --llm-max-cost-usd ${declared.maxEstimatedCostUsd}`);
    }
    if (call.inputTokens !== null && call.inputTokens > declared.maxInputTokens) {
      breaches.push(`call ${index + 1} used ${call.inputTokens} input tokens against --llm-max-input-tokens ${declared.maxInputTokens}`);
    }
    if (call.outputTokens !== null && call.outputTokens > declared.maxOutputTokens) {
      breaches.push(`call ${index + 1} used ${call.outputTokens} output tokens against --llm-max-output-tokens ${declared.maxOutputTokens}`);
    }
    if (call.totalTokens !== null && call.totalTokens > declared.maxTotalTokensPerRequest) {
      breaches.push(`call ${index + 1} used ${call.totalTokens} total tokens against --llm-max-total-tokens ${declared.maxTotalTokensPerRequest}`);
    }
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
