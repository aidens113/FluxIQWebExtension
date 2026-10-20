import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { chromium, type Browser, type Page } from "@playwright/test";
import { parseSearchQuery, searchPostings } from "../../catalog/index.js";
import { createJobBoardState, mutateJobBoardState } from "../../state.js";
import { openLabSession, type LabSession } from "../../tests/lab-session.js";
import { boardClasses } from "../classes.js";
import { renderResultsPage } from "../results-page.js";

/*
 * The armable `in-place-filters` results page: a filter option fetches the
 * filtered results and swaps them in under `aria-busy`, leaving the address
 * alone. The baseline board is unchanged and still loads a new page.
 */

const context = { runToken: "job-board-unit-token", seed: 42, alternateOrigin: "http://127.0.0.1:9" };
const ANY = parseSearchQuery(new URLSearchParams());

test("arming in-place-filters starts the board over in that rendering", () => {
  const busy = { ...createJobBoardState(), consent: "accepted" as const, resultsViews: 4 };
  const armed = mutateJobBoardState(busy, "set-mode", { mode: "in-place-filters" });
  assert.deepEqual(armed, createJobBoardState("in-place-filters"));
});

test("only the in-place rendering marks the results column busy-aware; the listing is otherwise the baseline's", () => {
  const baseline = renderResultsPage(createJobBoardState(), ANY, context, false);
  const inPlace = renderResultsPage(createJobBoardState("in-place-filters"), ANY, context, false);
  const c = boardClasses(context.seed);
  assert.equal(/aria-busy="/u.test(baseline), false);
  assert.equal(inPlace.match(/aria-busy="/gu)?.length, 1);
  assert.ok(inPlace.includes(`<div class="${c.left}" aria-busy="false">`));
  const normalised = inPlace.replace(` aria-busy="false"`, "").replace(`"mode":"in-place-filters"`, `"mode":"baseline"`);
  assert.equal(normalised, baseline);
});

let browser: Browser;
before(async () => { browser = await chromium.launch({ channel: "chromium", headless: true, args: ["--process-per-site"] }); });
after(async () => { await browser?.close(); });

async function returningVisitorOnResults(run: LabSession): Promise<Page> {
  for (const [operation, payload] of [["consent", { choice: "accepted" }], ["dismiss-alert-offer", {}], ["minimise-chat", {}]] as const) {
    const response = await fetch(`${run.lab.origin}/api/job-board/${operation}`, {
      method: "POST", headers: { authorization: `Bearer ${run.lab.runToken}`, "content-type": "application/json" }, body: JSON.stringify(payload),
    });
    assert.equal(response.ok, true, operation);
  }
  await run.page.goto(`${run.lab.origin}/scenarios/job-board/jobs`);
  await run.page.locator("ol article[data-jk]").first().waitFor();
  return run.page;
}

async function chooseRemoteOnly(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Remote", exact: true }).click();
  await page.getByRole("link", { name: "Remote only", exact: true }).click();
}

const remoteCount = searchPostings("baseline", parseSearchQuery(new URLSearchParams("wp=remote")), false).filter((posting) => !posting.fresh).length;
const countText = (page: Page) => page.getByText(/^Page \d+ of \d+ jobs$/u).innerText();

describe("filter options in a browser", { concurrency: true, timeout: 60_000 }, () => {
  test("in place: Remote only swaps the remote results in under aria-busy and the address does not move", async () => {
    const run = await openLabSession(browser, "in-place-filters");
    try {
      const page = await returningVisitorOnResults(run);
      const c = boardClasses(42);
      const address = page.url();
      assert.notEqual(await countText(page), `Page 1 of ${remoteCount} jobs`);
      // Every value the column's aria-busy takes, recorded in the page; the record also proves the document stayed.
      await page.locator(`.${c.left}`).evaluate((column) => {
        const seen: string[] = [];
        (globalThis as unknown as { busySeen: string[] }).busySeen = seen;
        const Observer = (globalThis as unknown as { MutationObserver: new (callback: () => void) => { observe(target: unknown, options: object): void } }).MutationObserver;
        new Observer(() => seen.push(column.getAttribute("aria-busy") ?? "")).observe(column, { attributes: true, attributeFilter: ["aria-busy"] });
      });
      await chooseRemoteOnly(page);
      const busySeen = () => page.evaluate(() => (globalThis as unknown as { busySeen: string[] }).busySeen);
      // Polled from here: the board's CSP refuses the string evaluation waitForFunction relies on.
      for (const deadline = Date.now() + 5_000; (await busySeen()).at(-1) !== "false";) {
        if (Date.now() > deadline) throw new Error(`no in-place answer by 5 s; aria-busy went ${JSON.stringify(await busySeen())}, address ${page.url()}`);
        await delay(50);
      }
      assert.deepEqual(await busySeen(), ["true", "false"]);
      assert.equal(await countText(page), `Page 1 of ${remoteCount} jobs`);
      assert.equal(page.url(), address);
      assert.ok(await page.locator(`.${c.pill}.${c.pillActive}`, { hasText: "Remote" }).isVisible());
      // The swapped column still works: its per-page select loads the filtered search at fifty.
      await page.locator('select[name="limit"]').selectOption("50");
      await page.waitForURL(/limit=50/u);
      assert.match(page.url(), /wp=remote/u);
      assert.deepEqual(run.errors, []);
    } finally { await run.close(); }
  });

  test("baseline: the same option is a plain link that loads the filtered page", async () => {
    const run = await openLabSession(browser);
    try {
      const page = await returningVisitorOnResults(run);
      await chooseRemoteOnly(page);
      await page.waitForURL(/wp=remote/u);
      assert.equal(await countText(page), `Page 1 of ${remoteCount} jobs`);
      assert.equal(await page.locator("[aria-busy]").count(), 0);
      assert.deepEqual(run.errors, []);
    } finally { await run.close(); }
  });
});
