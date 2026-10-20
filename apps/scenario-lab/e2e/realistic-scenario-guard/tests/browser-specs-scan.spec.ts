import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { isRealisticScenario } from "../../../../../packages/test-runner/src/realistic-scenarios/index.js";
import { listScenarios } from "../../../src/registry.js";
import { findSyntheticPageUses } from "../find-synthetic-page-uses.js";

// The static half of the realistic-scenarios rule: no browser-spec source in
// either Playwright tree opens a synthetic Scenario Lab scenario or serves a
// page of its own. Synthetic scenarios stay for unit tests that never open a
// browser (`apps/scenario-lab/src/**/tests`), which this does not scan.

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const BROWSER_SPEC_ROOTS = ["apps/scenario-lab/e2e", "apps/extension/e2e"];
const SKIPPED_DIRECTORIES = new Set(["node_modules", "test-results", ".harness-build"]);
const THIS_SCANNER = path.join("apps", "scenario-lab", "e2e", "realistic-scenario-guard");
const syntheticScenarioIds = listScenarios().map((scenario) => scenario.id).filter((id) => !isRealisticScenario(id));

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return SKIPPED_DIRECTORIES.has(entry.name) ? [] : sourceFiles(full);
    return /\.(?:ts|mts|mjs|js)$/u.test(entry.name) ? [full] : [];
  });
}

test("the registry still has synthetic scenarios for the scan to look for", () => {
  expect(syntheticScenarioIds.length).toBeGreaterThan(0);
  expect(syntheticScenarioIds).toContain("basic-form");
});

test("no browser-spec source opens a synthetic scenario or serves its own page", () => {
  const found: string[] = [];
  for (const root of BROWSER_SPEC_ROOTS) {
    for (const file of sourceFiles(path.join(repositoryRoot, root))) {
      const relative = path.relative(repositoryRoot, file);
      if (relative.startsWith(THIS_SCANNER)) continue;
      for (const use of findSyntheticPageUses(readFileSync(file, "utf8"), syntheticScenarioIds)) found.push(`${relative.replaceAll("\\", "/")}:${use.line}: ${use.what}`);
    }
  }
  expect(found, "Browser specs may open only the ten realistic scenarios (AGENTS.md). Retarget each use to a realistic scenario, or move browser-free checks to a unit test.").toEqual([]);
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
