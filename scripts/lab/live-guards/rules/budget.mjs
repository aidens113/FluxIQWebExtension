// Rule `budget`: a live run starts only under a budget a person set, and only
// while the window's recorded spend is below it.
//
// "Reached" is the test, so the run that crosses the line is the last one; a
// single run can still overshoot by up to its own cost ceiling, which the
// runner enforces separately. A missing or invalid budget file is never
// overridable -- `OVERRIDE-budget` lets a run past a spent budget, not past
// having none.

import { windowSpend } from "../ledger-queries.mjs";
import { budgetWindowStart } from "../spend-budget.mjs";

/** @param {import("./guard-state.mjs").GuardState} state */
export function checkSpendBudget(state) {
  const { budget, files } = state;
  if (!budget.ok) {
    return {
      rule: "budget", overridable: false,
      why: budget.reason,
      remedy: `Only the user sets the budget: they write ${files.budget} as {"maxUsd": <dollars>, "window": "day"}. An agent must not create or edit it; ask the user.`,
    };
  }
  const spent = windowSpend(state.entries, budgetWindowStart(budget.window, state.now));
  if (spent.usd < budget.maxUsd) return null;
  return {
    rule: "budget", overridable: true,
    why: `today's recorded live spend, $${spent.usd.toFixed(4)} over ${spent.runs} run(s), has reached the $${budget.maxUsd} budget in ${files.budget}`,
    remedy: `Wait for the next day, or ask the user to raise "maxUsd" or to create ${files.override("budget")}.`,
  };
}
