// The realistic-scenarios rule for browser tests (AGENTS.md, "Lab and browser
// test runs use only the ten realistic scenarios"). The runtime half: the
// Playwright fixtures install `installRealisticScenarioGuard`, so a spec
// cannot open a synthetic Scenario Lab scenario. The static half:
// `findSyntheticPageUses`, which tests/browser-specs-scan.spec.ts runs over
// every browser test `findBrowserTestFiles` finds in the repository. The list
// itself is packages/test-runner/src/realistic-scenarios/index.ts.

export { drivesABrowser } from "./drives-a-browser.js";
export { findBrowserTestFiles, type BrowserTestFile } from "./find-browser-test-files.js";
export { findSyntheticPageUses, type SyntheticPageUse } from "./find-synthetic-page-uses.js";
export { installRealisticScenarioGuard, type RealisticScenarioGuard } from "./install-realistic-scenario-guard.js";
export { scenarioIdInUrl } from "./scenario-id-in-url.js";
