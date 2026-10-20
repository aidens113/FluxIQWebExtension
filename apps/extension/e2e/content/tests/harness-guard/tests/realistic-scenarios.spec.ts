// The content harness opens only the ten realistic scenarios (AGENTS.md, "Lab
// and browser test runs use only the ten realistic scenarios"): another id is
// refused before a lab starts, and once a realistic page is open, a request
// for another scenario is aborted in the browser, so no synthetic page loads,
// and closing the harness throws the refusal.
//
// The synthetic id is read from the registry rather than written here, so this
// file stays clean for the static scan
// (apps/scenario-lab/e2e/realistic-scenario-guard/tests/browser-specs-scan.spec.ts).
// `openContentHarness` is called directly, not through the `openHarness`
// fixture, because the fixture would close the harness again in teardown and
// fail the test for the refusal it provokes on purpose.

import { isRealisticScenario } from "../../../../../../../packages/test-runner/src/realistic-scenarios/index.js";
import { listScenarios } from "../../../../../../scenario-lab/src/registry.js";
import { openContentHarness } from "../../../harness.js";
import { expect, test } from "../../../fixture.js";

const synthetic = listScenarios().map((scenario) => scenario.id).find((id) => !isRealisticScenario(id));

test("a synthetic scenario id is refused before any lab starts", async ({ page }) => {
  expect(synthetic).toBeDefined();
  await expect(openContentHarness(page, { scenarioId: synthetic! })).rejects.toThrow(/content harness refused .*: every Lab or browser test run, live or provider-free, uses only the ten realistic scenarios/u);
  expect(page.url()).toBe("about:blank");
});

test("from a realistic page, a synthetic scenario is refused in the browser and closing the harness reports it", async ({ page }) => {
  const harness = await openContentHarness(page, { scenarioId: "company-website" });
  let closed = false;
  try {
    await expect(page.goto(new URL(`/scenarios/${synthetic!}/`, harness.lab.origin).href)).rejects.toThrow(/ERR_BLOCKED_BY_CLIENT/u);
    closed = true;
    await expect(harness.close()).rejects.toThrow(new RegExp(`content harness refused ${synthetic!}:`, "u"));
  } finally {
    if (!closed) await harness.close().catch(() => undefined);
  }
});

test("a harness that stays on realistic scenarios closes cleanly", async ({ page }) => {
  const harness = await openContentHarness(page, { scenarioId: "everything-store" });
  await page.goto(new URL("/scenarios/everything-store/cart", harness.lab.origin).href);
  await expect(harness.close()).resolves.toBeUndefined();
});
