// The ten realistic Scenario Lab scenarios: the only scenarios any Lab or
// browser test run may open, live or provider-free, with a model or without
// one (user rule, 2026-09-29). Every launch entry refuses any other scenario
// before it starts anything: `scripts/lab/run-lab.mjs` (run, interactive,
// replay, matrix), the runner's CLI (the same, plus bench), the live campaign's
// task selection, `pnpm ui:e2e`, the demo workspace's browser sessions and the
// extension chat check. Unit tests and fixtures that never launch a browser may
// still use the other scenarios.
//
// This file is the one list. It lives in the barrel itself, imports nothing
// and uses only erasable TypeScript, because the Lab's `.mjs` launchers import
// it directly from source (Node strips the types) to refuse before they build
// anything, and a re-export such as `./list.js` would not resolve there. Keep
// it that way, or those launchers cannot load it.

/** The ten realistic scenarios, in the order the rule names them. */
export const REALISTIC_SCENARIO_IDS = Object.freeze([
  "everything-store",
  "crossborder-marketplace",
  "bigbox-retail",
  "job-board",
  "local-classifieds",
  "auction-marketplace",
  "photo-social",
  "social-network-feed",
  "company-website",
  "professional-network",
] as const);

export type RealisticScenarioId = typeof REALISTIC_SCENARIO_IDS[number];

/** Whether `scenarioId` is one of the ten realistic scenarios. */
export function isRealisticScenario(scenarioId: string): scenarioId is RealisticScenarioId {
  return (REALISTIC_SCENARIO_IDS as readonly string[]).includes(scenarioId);
}

/**
 * The refusal for the scenarios in `scenarioIds` that are not realistic, naming
 * the rule, the launch entry and the ten; `null` when every one is realistic.
 */
export function unrealisticScenarioRefusal(scenarioIds: readonly string[], entry: string): string | null {
  const refused = [...new Set(scenarioIds.filter(scenarioId => !isRealisticScenario(scenarioId)))];
  if (refused.length === 0) return null;
  return `${entry} refused ${refused.join(", ")}: every Lab or browser test run, live or provider-free, uses only the ten realistic scenarios (user rule, 2026-09-29): ${REALISTIC_SCENARIO_IDS.join(", ")}.`;
}

/** Throws the refusal for any scenario in `scenarioIds` that is not realistic. */
export function assertRealisticScenarios(scenarioIds: readonly string[], entry: string): void {
  const refusal = unrealisticScenarioRefusal(scenarioIds, entry);
  if (refusal !== null) throw new Error(refusal);
}
