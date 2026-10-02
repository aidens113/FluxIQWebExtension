// Asks every rule, then applies the override files a person created.
//
// An override is a file, `lab-slots/OVERRIDE-<rule>`, never a flag or an
// environment variable: an agent passes flags, and the point of these rules is
// that an agent alone cannot talk its way past them. A rule that says it is
// not overridable (`balance`) refuses
// whatever files exist.

import { checkBalanceStop, checkBehindDev, checkPreviousDebug, checkRelaunchLoop, checkUnchangedRerun } from "./rules/index.mjs";

const RULES = [checkBalanceStop, checkBehindDev, checkRelaunchLoop, checkPreviousDebug, checkUnchangedRerun];

/**
 * @param {import("./rules/guard-state.mjs").GuardState} state
 * @param {Set<string>} overrides the rules whose override file exists
 * @returns {{ refusals: import("./rules/guard-state.mjs").Refusal[], overridden: string[] }}
 */
export function evaluateLiveGuards(state, overrides) {
  const refusals = [];
  const overridden = [];
  for (const check of RULES) {
    const refusal = check(state);
    if (refusal === null) continue;
    if (refusal.overridable && overrides.has(refusal.rule)) overridden.push(refusal.rule);
    else refusals.push(refusal);
  }
  return { refusals, overridden };
}
