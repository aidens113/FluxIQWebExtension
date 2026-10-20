import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { isRealisticScenario } from "../../../../../packages/test-runner/src/realistic-scenarios/index.js";
import { listScenarios } from "../../../src/registry.js";
import { findBrowserTestFiles } from "../find-browser-test-files.js";
import { findSyntheticPageUses } from "../find-synthetic-page-uses.js";

// The static half of the realistic-scenarios rule, over every browser test in
// the repository: each source in a Playwright tree (any directory holding a
// Playwright config), and each test file anywhere else that imports a browser
// driver or launches a browser. None may open a synthetic Scenario Lab
// scenario or serve a page of its own. The repository is walked, not a list of
// roots, so a browser test added anywhere is covered. Synthetic scenarios stay
// for unit tests that never open a browser, which this leaves alone.

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
/** This scanner's own sources name every pattern on purpose. */
const THIS_SCANNER = "apps/scenario-lab/e2e/realistic-scenario-guard/";
const syntheticScenarioIds = listScenarios().map((scenario) => scenario.id).filter((id) => !isRealisticScenario(id));
const browserTests = findBrowserTestFiles(repositoryRoot);

test("the registry still has synthetic scenarios for the scan to look for", () => {
  expect(syntheticScenarioIds.length).toBeGreaterThan(0);
  expect(syntheticScenarioIds).toContain("basic-form");
});

test("the walk finds the browser tests of every package that has them", () => {
  // An empty or shrunken list would mean the scan looked nowhere; each of these holds browser tests today.
  const has = (prefix: string, why: string) => browserTests.some((file) => file.relativePath.startsWith(prefix) && file.why === why);
  expect(has("apps/scenario-lab/e2e/", "playwright-tree")).toBe(true);
  expect(has("apps/extension/e2e/", "playwright-tree")).toBe(true);
  expect(has("apps/extension/e2e/content/", "playwright-tree")).toBe(true);
  expect(has("apps/scenario-lab/src/scenarios/", "launches-a-browser")).toBe(true);
  expect(has("packages/test-runner/src/", "launches-a-browser")).toBe(true);
  expect(browserTests.some((file) => /(?:^|\/)(?:node_modules|dist|test-runs|\.test-build[^/]*)\//u.test(file.relativePath))).toBe(false);
});

test("no browser test in the repository opens a synthetic scenario or serves its own page", () => {
  const found: string[] = [];
  for (const { relativePath } of browserTests) {
    if (relativePath.startsWith(THIS_SCANNER)) continue;
    const scenario = /^apps\/scenario-lab\/src\/scenarios\/([^/]+)\//u.exec(relativePath)?.[1];
    if (scenario !== undefined && syntheticScenarioIds.some((id) => id === scenario)) found.push(`${relativePath}: launches a browser inside synthetic scenario ${scenario}`);
    for (const use of findSyntheticPageUses(readFileSync(path.join(repositoryRoot, relativePath), "utf8"), syntheticScenarioIds)) found.push(`${relativePath}:${use.line}: ${use.what}`);
  }
  expect(found, "A browser may open only the ten realistic scenarios (AGENTS.md), in Playwright specs and unit tests alike. Retarget each use to a realistic scenario, or make the check browser-free.").toEqual([]);
});

test("the scanner finds each kind of use and ignores comments", () => {
  const sample = [
    "// openHarness(\"basic-form\") in a comment is history, not a use",
    "await openHarness(\"basic-form\");",
    "await page.goto(`${lab.origin}/scenarios/modal-flows/`);",
    "await page.goto(\"http://127.0.0.1:1/scenarios/sensitive-input?x=1\");",
    "const options = { scenarioId: 'data-table' };",
    "await readFinalState(lab, \"navigation\");",
    "import { PLANTED } from \"../../src/scenarios/sensitive-input/index.js\";",
    "await page.setContent(\"<p>hi</p>\");",
    "await page.goto(\"data:text/html,<p>hi</p>\");",
    "createServer((req, res) => res.setHeader(\"content-type\", \"text/html\"));",
    "await openHarness(\"everything-store\"); await page.goto(`/scenarios/navigationx/`);",
  ].join("\n");
  const uses = findSyntheticPageUses(sample, ["basic-form", "modal-flows", "sensitive-input", "data-table", "navigation"]);
  expect(uses.map((use) => `${use.line} ${use.what}`)).toEqual([
    "2 opens synthetic scenario basic-form",
    "3 opens synthetic scenario modal-flows",
    "4 opens synthetic scenario sensitive-input",
    "5 opens synthetic scenario data-table",
    "6 uses synthetic scenario navigation",
    "7 imports synthetic scenario sensitive-input",
    "8 serves its own page with setContent",
    "9 serves its own page as a data: URL",
    "10 serves its own HTML page from an HTTP server",
  ]);
});
