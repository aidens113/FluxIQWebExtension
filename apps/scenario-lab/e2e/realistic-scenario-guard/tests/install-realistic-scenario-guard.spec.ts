import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { startScenarioLab } from "../../../src/server.js";
import { readFinalState } from "../../lab-fixture.js";
import { installRealisticScenarioGuard } from "../install-realistic-scenario-guard.js";

// The guard the Scenario Lab fixture installs on every test, and the content
// harness and extension sessions on theirs. Each request for a synthetic
// scenario is aborted in the browser before it reaches the lab, so no
// synthetic page ever loads here. The plain Playwright `test` is used, not the
// lab fixture, because the fixture's own guard would fail this test for the
// refusals it provokes on purpose.

test("a synthetic scenario is refused before it loads, by goto and by fetch, and the refusal names the rule", async ({ browser }) => {
  const lab = await startScenarioLab({ runToken: randomBytes(24).toString("base64url"), seed: 42 });
  const context = await browser.newContext();
  try {
    const guard = await installRealisticScenarioGuard(context, "guard test");
    const page = await context.newPage();

    await expect(page.goto(`${lab.origin}/scenarios/basic-form/`)).rejects.toThrow(/ERR_BLOCKED_BY_CLIENT/u);
    expect(guard.refusedScenarioIds).toEqual(["basic-form"]);

    // A realistic page loads, and a fetch from it to a synthetic scenario's API is refused too.
    const response = await page.goto(`${lab.origin}/scenarios/company-website/`);
    expect(response?.status()).toBe(200);
    const fetched = await page.evaluate(async (url) => {
      try {
        await fetch(url, { method: "POST", body: "{}" });
        return "reached";
      } catch {
        return "refused";
      }
    }, `${lab.origin}/api/sensitive-input/submit`);
    expect(fetched).toBe("refused");
    expect(guard.refusedScenarioIds).toEqual(["basic-form", "sensitive-input"]);

    expect(() => guard.assertClean()).toThrow(/guard test refused basic-form, sensitive-input: every Lab or browser test run, live or provider-free, uses only the ten realistic scenarios/u);
  } finally {
    await context.close();
    await lab.close();
  }
});

test("a context that opens only realistic scenarios stays clean", async ({ browser }) => {
  const lab = await startScenarioLab({ runToken: randomBytes(24).toString("base64url"), seed: 42 });
  const context = await browser.newContext();
  try {
    const guard = await installRealisticScenarioGuard(context, "guard test");
    const page = await context.newPage();
    expect((await page.goto(`${lab.origin}/scenarios/everything-store/`))?.status()).toBe(200);
    expect(guard.refusedScenarioIds).toEqual([]);
    expect(() => guard.assertClean()).not.toThrow();
  } finally {
    await context.close();
    await lab.close();
  }
});

test("the fixture's oracle helper refuses a synthetic scenario without a browser", async () => {
  const lab = await startScenarioLab({ runToken: randomBytes(24).toString("base64url"), seed: 42 });
  try {
    await expect(readFinalState(lab, "basic-form")).rejects.toThrow(/refused basic-form/u);
  } finally {
    await lab.close();
  }
});
