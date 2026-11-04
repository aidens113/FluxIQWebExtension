// Headed, provider-free: the answer turn over REAL rows. The Spain-hubs task is read off the real
// crossborder-marketplace site by the product's own walk (content-script actions, then the domain's evidence
// runtime over the detected list, no model and no Core). The rows it read are then given, as the run's exported
// dataset, to the extension's own results adapter, and the chat is asked to show them. Nothing is invented: the
// expected rows are the scenario's own `spainHubRecords()`.
import { expect, test } from "../../../index.js";
import { buildAnswerChatBundle, openChatRail, type AnswerBundle } from "../answer-chat-page.js";
import { readSpainHubs, SPAIN_HUBS_EXPECTED } from "../spain-hubs-read.js";

let bundle: AnswerBundle;
test.beforeAll(async () => {
  bundle = await buildAnswerChatBundle();
});

type Win = { __mount(config: unknown): Promise<void>; __downloads: Array<{ fileName: string; contentType: string; body: string }>; __exportsAsked: Array<Record<string, unknown>> };

test("crossborder-marketplace: the rows a real provider-free read took are shown unverified, first five, total 13", async ({ openHarness, page }, testInfo) => {
  test.setTimeout(240_000);
  const harness = await openHarness("crossborder-marketplace");
  const rows = await readSpainHubs(harness);
  expect(rows, "the real read equals the scenario's own expected rows").toEqual(SPAIN_HUBS_EXPECTED);
  expect(rows).toHaveLength(13);

  // Tall enough to see the whole card in one picture; the chat itself is the same.
  await page.setViewportSize({ width: 1280, height: 1300 });
  const { frame, locator } = await openChatRail(page, bundle, { width: 420, height: 1300 });
  const now = Date.now();
  await frame.evaluate(async ({ rows, now }) => {
    await (window as unknown as Win).__mount({ request: "List every USB-C hub that ships from Spain, ships free and is rated 4.5 or better",
      real: { runId: "run-spain-hubs-1", flowId: "flow-spain-hubs", datasetId: "spain_hubs", startedAt: now - 41_000, finishedAt: now - 2_000, rows } });
  }, { rows, now });

  const turn = locator.locator(".answer-turn");
  await expect(turn).toHaveCount(1, { timeout: 15_000 });
  await expect(turn).toHaveAttribute("data-kind", "rows");
  // Nothing confirmed these rows, so the turn says so and draws no tick.
  await expect(locator.locator(".answer-headline")).toHaveText("Found 13 rows");
  await expect(locator.locator(".answer-check")).toHaveAttribute("data-state", "unverified");
  expect(await turn.evaluate((element) => element.textContent?.includes("✓"))).toBe(false);
  await expect(locator.locator(".answer-mark")).toHaveCount(0);
  expect(await turn.innerText(), "this port has no real spend, so nothing about cost").not.toContain("$");
  await expect(locator.locator("th")).toHaveText(["Title", "Store", "Price", "Rating"]);
  await expect(locator.locator(".answer-row")).toHaveCount(5);
  const shown = await locator.locator(".answer-row").evaluateAll((trs) => trs.map((tr) => Array.from(tr.querySelectorAll("td")).map((td) => td.textContent)));
  expect(shown, "the first five rows are the first five the page answered").toEqual(SPAIN_HUBS_EXPECTED.slice(0, 5).map((row) => [row.title, row.store, row.price, row.rating]));
  await expect(locator.locator('[data-action="toggle-rows"]')).toHaveText("Show all 13");
  await page.screenshot({ path: testInfo.outputPath("real-rows-first-five.png") });

  await locator.locator('[data-action="toggle-rows"]').click();
  await expect(locator.locator(".answer-row")).toHaveCount(13);
  const all = await locator.locator(".answer-row").evaluateAll((trs) => trs.map((tr) => Array.from(tr.querySelectorAll("td")).map((td) => td.textContent)));
  expect(all, "every row, in the order the page gave them").toEqual(SPAIN_HUBS_EXPECTED.map((row) => [row.title, row.store, row.price, row.rating]));
  await page.screenshot({ path: testInfo.outputPath("real-rows-show-all.png") });

  // The files come from the run's export through the adapter, whole.
  await locator.locator('[data-action="export-json"]').click();
  await expect.poll(() => frame.evaluate(() => (window as unknown as Win).__downloads.length)).toBe(1);
  await locator.locator('[data-action="export-csv"]').click();
  await expect.poll(() => frame.evaluate(() => (window as unknown as Win).__downloads.length)).toBe(2);
  const files = await frame.evaluate(() => (window as unknown as Win).__downloads);
  expect(JSON.parse(files.find((file) => file.fileName.endsWith(".json"))!.body)).toEqual(SPAIN_HUBS_EXPECTED);
  expect(files.find((file) => file.fileName.endsWith(".csv"))!.body.split("\n")).toHaveLength(14);
  expect(await frame.evaluate(() => (window as unknown as Win).__exportsAsked.map((asked) => asked.format))).toEqual(expect.arrayContaining(["json", "csv"]));
});
