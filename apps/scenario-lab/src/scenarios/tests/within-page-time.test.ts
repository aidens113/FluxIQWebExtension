import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, test } from "node:test";
import { chromium, type Browser, type Page } from "@playwright/test";
import { startScenarioLab, type RunningScenarioLab } from "../../server.js";
import { withinPageTime } from "./within-page-time.js";

/**
 * A step's budget is the page's own time: a page whose main thread was frozen
 * gets the frozen time back, and a page that ran and never reached the state
 * still fails at its budget.
 *
 * The page is a realistic site, company-website's home page (browser runs open
 * only the ten realistic scenarios). The test adds nothing to it: it freezes
 * the page's main thread, which is what a starved renderer does, and presses
 * the site's own "Get a free quote" button on a page timer, so the state the
 * step waits for is the site's own quote drawer opening.
 *
 * Headless full Chromium, as the scenario browser paths run it.
 */
let browser: Browser;
let lab: RunningScenarioLab;
before(async () => {
  browser = await chromium.launch({ channel: "chromium", headless: true });
  lab = await startScenarioLab({ runToken: randomBytes(24).toString("base64url"), seed: 42 });
});
after(async () => {
  await browser?.close();
  await lab?.close();
});

/** The quote drawer's first field, which the site shows once its drawer opens. */
const DRAWER_FIELD = 'input[name="fullName"]';

async function freshPage(): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto(`${lab.origin}/scenarios/company-website/`);
  await page.locator("header button", { hasText: "Get a free quote" }).waitFor({ state: "attached" });
  // The first call arms the heartbeat on the document already open.
  await withinPageTime(page, 1_000, "arm", async () => undefined);
  return page;
}

test("a page frozen for three seconds still gets its 1.5 s budget to show what it shows 0.5 s into its own time", async () => {
  const page = await freshPage();
  assert.equal(await page.locator(DRAWER_FIELD).isVisible(), false, "the drawer starts closed");
  // Freezes 50 ms after the step starts, so the freeze falls inside the step's own clock;
  // the site's own button is pressed 0.5 s into the page's time, after the freeze.
  await page.evaluate(`
    setTimeout(() => {
      const end = performance.now() + 3000;
      while (performance.now() < end) {}
    }, 50);
    setTimeout(() => [...document.querySelectorAll("header button")].find((button) => button.textContent.trim() === "Get a free quote").click(), 500);
  `);
  const started = Date.now();
  await withinPageTime(page, 1_500, "waitForState drawer", () => page.locator(DRAWER_FIELD).waitFor({ timeout: 0 }));
  assert.ok(Date.now() - started >= 2_500, "the state appeared only after the freeze, past the wall-clock budget");
  await page.context().close();
});

test("a page that runs and never reaches the state fails at its budget, naming the step", async () => {
  const page = await freshPage();
  const started = Date.now();
  // Nothing presses the button, so the drawer never opens.
  await assert.rejects(withinPageTime(page, 1_000, "waitForState drawer", () => page.locator(DRAWER_FIELD).waitFor({ timeout: 0 })), /waitForState drawer: not done within 1000 ms of the page's own time/u);
  assert.ok(Date.now() - started < 3_000, `failed after ${Date.now() - started} ms`);
  await page.context().close();
});

test("a failure of the action itself is raised as it is, not as a timeout", async () => {
  const page = await freshPage();
  await assert.rejects(withinPageTime(page, 5_000, "click", () => Promise.reject(new Error("strict mode violation"))), /strict mode violation/u);
  await page.context().close();
});
