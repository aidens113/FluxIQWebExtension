import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { chromium, type Browser, type Page } from "@playwright/test";
import { remoteEasyApplyWorkflow } from "../breadth/index.js";
import { JOB_BOARD_DEMONSTRATIONS } from "../demonstrations.js";
import { openLabSession } from "./lab-session.js";
import { Driver } from "./scenario-driver.js";

/**
 * The remote Easily-apply demonstration in a browser, provider-free: its Job type and sort detours change what the
 * results show and their undo restores it, and its steps read exactly the expected records. The suite launches
 * headless Chromium only; it has no headed switch.
 */
const [demonstration] = JOB_BOARD_DEMONSTRATIONS;
const EXTRACT_ID = "extract-remote-easy-apply";
const EXPECTED = remoteEasyApplyWorkflow.expected.extracted![0]!.records!;
/** The step of each detour at which the page shows the detour applied. */
const SHOWN_AT = ["demo-full-time-shown", "demo-relevance-shown"];

let browser: Browser;
// Same-site tabs share one renderer process (see browser-paths.test.ts).
before(async () => { browser = await chromium.launch({ channel: "chromium", headless: true, args: ["--process-per-site"] }); });
after(async () => { await browser?.close(); });

/** What a person sees of the results: the sort line, the count line and the first cards in order. */
async function snapshot(page: Page) {
  await page.locator("article[data-jk]").first().waitFor();
  return page.evaluate(`({
    sort: [...document.querySelectorAll('span')].find((span) => span.textContent.startsWith('Sort by:'))?.textContent.trim() ?? '',
    count: [...document.querySelectorAll('span')].find((span) => /^Page \\d+ of \\d+ jobs$/.test(span.textContent.trim()))?.textContent.trim() ?? '',
    titles: [...document.querySelectorAll('article[data-jk] h2 a')].slice(0, 8).map((link) => link.textContent.trim()),
  })`);
}

describe("the remote Easily-apply demonstration in a browser", { concurrency: true, timeout: 120_000 }, () => {
  test("each detour visibly changes the results and its undo restores them", async () => {
    const run = await openLabSession(browser);
    try {
      const driver = new Driver(run.context, run.page);
      assert.equal(demonstration!.detours.length, SHOWN_AT.length);
      let done = 0;
      /** Runs the steps after the ones already run, through the named step. */
      const advanceTo = async (id: string) => {
        const end = demonstration!.steps.findIndex((step) => step.id === id) + 1;
        assert.ok(end >= done, `${id} is not before the steps already run`);
        await driver.run(demonstration!.steps.slice(done, end));
        done = end;
      };
      for (const [index, detour] of demonstration!.detours.entries()) {
        const first = demonstration!.steps.findIndex((step) => step.id === detour.stepIds[0]);
        await advanceTo(demonstration!.steps[first - 1]!.id);
        const resting = await snapshot(driver.active);
        await advanceTo(SHOWN_AT[index]!);
        assert.notDeepEqual(await snapshot(driver.active), resting, `${detour.stepIds[0]} changed what the page shows`);
        await advanceTo(detour.stepIds[detour.stepIds.length - 1]!);
        assert.deepEqual(await snapshot(driver.active), resting, `${detour.stepIds.at(-1)} restored what the page showed before the detour`);
      }
      assert.deepEqual(run.errors.filter((error) => !error.includes("status of 429")), []);
    } finally { await run.close(); }
  });

  test("reads exactly the expected records, record by record", async () => {
    const run = await openLabSession(browser);
    try {
      const driver = new Driver(run.context, run.page);
      await driver.run(demonstration!.steps);
      const read = driver.extracted.get(EXTRACT_ID) ?? [];
      assert.equal(read.length, EXPECTED.length);
      EXPECTED.forEach((record, index) => assert.deepEqual(read[index], record, `record ${index + 1}`));
      assert.deepEqual(run.errors.filter((error) => !error.includes("status of 429")), []);
    } finally { await run.close(); }
  });
});
