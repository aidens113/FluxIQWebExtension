// The realistic-scenarios rule for browser specs (AGENTS.md, "Lab and browser
// test runs use only the ten realistic scenarios"). The runtime half: the
// Playwright fixtures install `installRealisticScenarioGuard`, so a spec
// cannot open a synthetic Scenario Lab scenario. The static half:
// `findSyntheticPageUses`, which tests/browser-specs-scan.spec.ts runs over
// every browser-spec source. The list itself is
// packages/test-runner/src/realistic-scenarios/index.ts.

export { findSyntheticPageUses, type SyntheticPageUse } from "./find-synthetic-page-uses.js";
export { installRealisticScenarioGuard, type RealisticScenarioGuard } from "./install-realistic-scenario-guard.js";
export { scenarioIdInUrl } from "./scenario-id-in-url.js";
