import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { chromium, type Browser, type Page } from "@playwright/test";
import { withinPageTime } from "./within-page-time.js";

/**
 * A step's budget is the page's own time: a page whose main thread was frozen
 * gets the frozen time back, and a page that ran and never reached the state
 * still fails at its budget.
 *
 * Headless full Chromium, as the scenario page specs run it.
 */
let browser: Browser;
before(async () => {
  browser = await chromium.launch({ channel: "chromium", headless: true });
});
after(async () => {
  await browser?.close();
});

async function freshPage(): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.setContent("<main></main>");
  // The first call arms the heartbeat on the document already open.
  await withinPageTime(page, 1_000, "arm", async () => undefined);
  return page;
}

test("a page frozen for three seconds still gets its 1.5 s budget to show what it shows 0.5 s into its own time", async () => {
  const page = await freshPage();
  // Freezes 50 ms after the step starts, so the freeze falls inside the step's own clock.
  await page.evaluate(`
    setTimeout(() => {
      const end = performance.now() + 3000;
      while (performance.now() < end) {}
    }, 50);
    setTimeout(() => document.body.append(Object.assign(document.createElement("p"), { id: "ready", textContent: "Ready" })), 500);
  `);
  const started = Date.now();
  await withinPageTime(page, 1_500, "waitForState #ready", () => page.locator("#ready").waitFor({ timeout: 0 }));
  assert.ok(Date.now() - started >= 2_500, "the state appeared only after the freeze, past the wall-clock budget");
  await page.context().close();
});

test("a page that runs and never reaches the state fails at its budget, naming the step", async () => {
  const page = await freshPage();
  const started = Date.now();
  await assert.rejects(withinPageTime(page, 1_000, "waitForState #never", () => page.locator("#never").waitFor({ timeout: 0 })), /waitForState #never: not done within 1000 ms of the page's own time/u);
  assert.ok(Date.now() - started < 3_000, `failed after ${Date.now() - started} ms`);
  await page.context().close();
});

test("a failure of the action itself is raised as it is, not as a timeout", async () => {
  const page = await freshPage();
  await assert.rejects(withinPageTime(page, 5_000, "click", () => Promise.reject(new Error("strict mode violation"))), /strict mode violation/u);
  await page.context().close();
});
