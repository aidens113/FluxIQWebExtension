// Findings about a run's budget that are not breaches.
//
// Core reserves a request's size before the call (UTF-8 bytes / 3 plus framing)
// and counts a `budgetBreach` when the provider reports more input than that.
// Text that tokenizes denser than 3 bytes a token trips it with no cap near:
// `run-mvskptb1-c9cef4fe` used 63 of 250 calls and $0.066 of $0.25 and was
// failed as `performance.budget`. While every declared cap held, the overrun is
// a finding. A real cap breach is `liveLlmBudgetBreaches`' and stays a failure.

import { liveLlmBudgetBreaches } from "../budget.js";
import type { LiveLlmPlan } from "../live-llm-plan.js";
import type { LiveLlmBudgetFinding } from "./finding.js";
import type { LiveLlmObservedUsage } from "../observed-usage.js";

/** The findings for `usage`: none when a cap was crossed, since the failure then says what happened. */
export function liveLlmBudgetFindings(plan: LiveLlmPlan, usage: LiveLlmObservedUsage): LiveLlmBudgetFinding[] {
  if (liveLlmBudgetBreaches(plan, usage).length > 0) return [];
  const flagged = usage.observedCalls.flatMap((call, index) => call.budgetBreach === true
    ? [{ call: index + 1, requestId: call.requestId, taskKind: call.taskKind, suppliedInputTokens: call.inputTokens, outputTokens: call.outputTokens }]
    : []);
  const overrunCalls = Math.max(usage.accounting?.budgetBreaches ?? 0, flagged.length);
  if (overrunCalls === 0) return [];
  return [{
    code: "reservation_undercounted",
    overrunCalls,
    calls: flagged,
    message: `Core's reservation undercounted ${overrunCalls} call(s): the provider reported more input than Core reserved, and every declared cap held`,
  }];
}
