import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { EVERYTHING_STORE_DEMONSTRATIONS } from "../demonstrations.js";
import { COUPON_EARBUDS_WORKFLOW } from "../workflows/index.js";
import { BROWSER_KIT as kit, type StoreSession } from "./browser-kit.js";

/**
 * The couponed-earbuds demonstration in a browser, provider-free: its sort and delivery-filter detours change what
 * the results show and their undo restores it, and the demonstration's steps, with the five-page sweep a person
 * makes where the paged read cannot be recorded, read exactly the expected records. The kit drives headless
 * Chromium only; it has no headed switch.
 */
const [demonstration] = EVERYTHING_STORE_DEMONSTRATIONS;
const EXPECTED = COUPON_EARBUDS_WORKFLOW.expected.extracted![0]!.records!;
const EXTRACT_ID = "extract-coupon-earbuds";
/** Enough between two results pages that a person's pace never meets the rate limiter. */
const READING_PACE_MS = 2200;
/** The store refuses a sixth results page within this window (`STORE_THROTTLE`). */
const THROTTLE_WINDOW_MS = 8500;
const PAGE_LENGTHS = [16, 17, 17, 17, 7];
/** The step of each detour at which the page shows the detour applied. */
const SHOWN_AT = ["demo-plus-shown"];

/** What a person sees of the results: the sort chosen, whether a filter is on, the count line and the first cards in order. */
async function snapshot(session: StoreSession) {
  const { page } = session;
  await page.locator(`[data-component="search-result"][data-sku]`).first().waitFor();
  return page.evaluate(`({
    sort: document.querySelector('select[name="s"]')?.selectedOptions[0]?.textContent.trim() ?? '',
    filtered: Boolean([...document.querySelectorAll('aside a')].find((link) => link.textContent.trim() === 'Clear all filters')),
    count: document.querySelector('[data-testid="result-count"]')?.textContent.trim() ?? '',
    names: [...document.querySelectorAll('[data-component="search-result"][data-sku] h2 a')].slice(0, 6).map((link) => link.textContent.trim()),
  })`);
}

/** The demonstration's steps up to the paged read, then the sweep of every page that read describes, each card kept once. */
async function readEverything(session: StoreSession): Promise<Array<Record<string, string>>> {
  const extractAt = demonstration!.steps.findIndex((step) => step.id === EXTRACT_ID);
  await kit.playRecording(session, demonstration!.steps.slice(0, extractAt));
  const { pagination: _paged, ...single } = demonstration!.steps[extractAt]!;
  // The search, its check and the detour made four results loads; let the store's eight-second window drain before paging.
  await kit.pause(THROTTLE_WINDOW_MS);
  const kept = new Map<string, Record<string, string>>();
  for (let pageNumber = 1; pageNumber <= PAGE_LENGTHS.length; pageNumber += 1) {
    if (pageNumber > 1) {
      await kit.pause(READING_PACE_MS);
      await session.page.getByRole("link", { name: `Go to page ${pageNumber}`, exact: true }).click();
      await session.page.locator(`[data-component="search-result"][data-sku]`).first().waitFor();
    }
    const cards = await kit.readWholePage(session.page, PAGE_LENGTHS[pageNumber - 1]!);
    // The recorded read keeps every couponed organic card, rating unread; the person reading the stars keeps the rated ones and drops the accessories.
    for (const record of (await kit.playRecording(session, [single]))[EXTRACT_ID] ?? []) {
      const card = cards.find((candidate) => candidate.url === record.url);
      if (!card || Number(card.rating) < 4 || /^(Replacement|Charging Case)/u.test(card.name)) continue;
      if (!kept.has(record.url!)) kept.set(record.url!, record);
    }
  }
  return [...kept.values()];
}

describe("the couponed-earbuds demonstration in a browser", { concurrency: true }, () => {
  after(() => kit.closeBrowser());

  it("each detour visibly changes the results and its undo restores them", async () => {
    const session = await kit.openStore();
    try {
      assert.equal(demonstration!.detours.length, SHOWN_AT.length);
      let done = 0;
      /** Runs the steps after the ones already run, through the named step. */
      const advanceTo = async (id: string) => {
        const end = demonstration!.steps.findIndex((step) => step.id === id) + 1;
        assert.ok(end >= done, `${id} is not before the steps already run`);
        if (end > done) await kit.playRecording(session, demonstration!.steps.slice(done, end));
        done = end;
      };
      for (const [index, detour] of demonstration!.detours.entries()) {
        const first = demonstration!.steps.findIndex((step) => step.id === detour.stepIds[0]);
        await advanceTo(demonstration!.steps[first - 1]!.id);
        const resting = await snapshot(session);
        await advanceTo(SHOWN_AT[index]!);
        assert.notDeepEqual(await snapshot(session), resting, `${detour.stepIds[0]} changed what the page shows`);
        await advanceTo(detour.stepIds[detour.stepIds.length - 1]!);
        assert.deepEqual(await snapshot(session), resting, `${detour.stepIds.at(-1)} restored what the page showed before the detour`);
      }
      assert.deepEqual(await kit.factFailures(session.page, [COUPON_EARBUDS_WORKFLOW.expected.finalState![0]!]), []);
    } finally { await session.close(); }
  });

  it("reads exactly the expected records, record by record, across every page", async () => {
    const session = await kit.openStore();
    try {
      const read = await readEverything(session);
      assert.equal(read.length, EXPECTED.length);
      EXPECTED.forEach((record, index) => assert.deepEqual(read[index], record, `record ${index + 1}`));
      assert.deepEqual(await kit.factFailures(session.page, COUPON_EARBUDS_WORKFLOW.expected.finalState ?? []), []);
    } finally { await session.close(); }
  });
});
