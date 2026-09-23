// Detection and `web.dom.extract_list` against the everything store's search
// results: the page a Flow built from an instruction actually has to read.
//
// The other extraction specs use fixtures whose items carry a `data-testid` on
// every value, which is the easy case and the one that hid two defects until a
// live campaign measured them (task t092):
//
// - **the read did not wait for its list.** The store renders eight
//   placeholder cards and swaps the real ones in 700ms later, so an extraction
//   dispatched as the page loads read nothing and reported it as a clean read
//   of nothing. That is what a Flow built by running nodes does: it carries no
//   wait step, because nobody recorded one. Measured: 0 records where 16 were
//   expected;
// - **inference could not name a nested value.** A field was named by its tag
//   and its position among its *parent's* children, kept only when that named
//   one element in the whole item, so on a card whose values sit three and four
//   levels down almost every field was dropped -- and the proposal carried the
//   image, a stray span, the delivery date and the Add to cart button while
//   omitting the name, the price, the rating and the link, which are the four
//   columns the instruction asks for.
//
// These rows hold both fixed. They assert behaviour rather than keys: which
// key a field lands under is derived from page structure and would change with
// the store's markup, while "the proposal can read this card's own title,
// price, rating and link" is the claim that matters.

import type {
  WebAutomationExtractField,
  WebAutomationExtractListRequest,
  WebAutomationStructureDetection
} from "@fluxiq-web-extension/domain/client";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

/** The Plus-only wireless-earbud search: the live instruction task's own page. */
const SEARCH = "/scenarios/everything-store/s?k=wireless+earbuds&rh=plus";
/** An organic result card. Placeholders carry the container attribute and no listing id. */
const ORGANIC = '[data-component="search-result"][data-sku]:not([data-ad-id])';

type Detected = Extract<WebAutomationStructureDetection, { ok: true }>;

/**
 * Opens the search, passing the store's browser check when it stands. The
 * check is the first thing a session meets, and it is not what these rows are
 * about. Its button unlocks after `STORE_TIMINGS.softCheckButton`, and passing
 * it reloads onto what was asked for.
 *
 * The wait is a poll rather than `page.waitForFunction`: the store serves a
 * Content Security Policy without `unsafe-eval`, which is what a real store
 * serves, and `waitForFunction` compiles a string in the page.
 */
async function openSearch(harness: ContentHarness): Promise<void> {
  const url = new URL(SEARCH, harness.lab.origin).href;
  // Every step tolerates the page going out from under it: the check passes
  // itself after `STORE_TIMINGS.softCheckAuto` whether or not its button is
  // pressed, and the reload that follows destroys whatever was mid-call.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await harness.page.goto(url, { waitUntil: "load" }).catch(() => undefined);
    const blocked = await harness.page.locator("[data-continue]").count().catch(() => 1);
    if (!blocked) return;
    await harness.page.waitForTimeout(1_700);
    await harness.page.locator("[data-continue]").click().catch(() => undefined);
    await harness.page.waitForTimeout(2_000);
  }
  throw new Error("The store kept answering with its browser check.");
}

async function detect(harness: ContentHarness): Promise<Detected> {
  const reply = await harness.runAction({ commandId: `detect-${Date.now()}`, actionType: "web.dom.capture_snapshot", detectStructure: {} });
  const structure = reply.structure as WebAutomationStructureDetection;
  expect(structure.ok, `a structure was detected: ${JSON.stringify(structure)}`).toBe(true);
  if (!structure.ok) throw new Error("No structure detected.");
  return structure;
}

/**
 * The detection as the request its handle would stand for, reading only the
 * page it is on: this instruction asks for the first page of results.
 */
function requestFrom(structure: Detected, minItems?: number): WebAutomationExtractListRequest {
  const fields = structure.proposal.fields.filter((field) => field.spec.handling !== "exclude");
  return {
    item: structure.proposal.item,
    fields: Object.fromEntries(fields.map((field) => [field.key, field.spec as WebAutomationExtractField])),
    ...(minItems === undefined ? {} : { minItems })
  };
}

test("the read waits for a list the page has not drawn yet, and stops waiting the moment it has one", async ({ openHarness, page }) => {
  test.setTimeout(120_000);
  const harness = await openHarness("everything-store");
  await openSearch(harness);
  await page.waitForTimeout(1_500);
  const request = requestFrom(await detect(harness));

  // The replay: the same request, on a freshly loaded page, dispatched at once.
  // Before this wait existed it read the eight placeholder cards' grid, found
  // none of them, and reported 0 records as a clean read.
  await page.goto(new URL(SEARCH, harness.lab.origin).href, { waitUntil: "load" });
  const started = Date.now();
  const waited = await harness.runAction({ commandId: "extract-waits", actionType: "web.dom.extract_list", extractList: request });
  const waitedMs = Date.now() - started;
  expect(waited.status, JSON.stringify(waited.validation)).toBe("succeeded");
  expect(waited.extraction?.recordCount ?? 0, "the results the store drew, not the placeholders").toBeGreaterThanOrEqual(12);
  expect(waited.validation?.status).toBe("passed");

  // And `minItems: 0` -- the picker preview's contract, and what a model wrote
  // on the first Flow built after this landed -- does not switch it off: an
  // empty list and a list the page has not drawn yet are the same document.
  await page.goto(new URL(SEARCH, harness.lab.origin).href, { waitUntil: "load" });
  const permissive = await harness.runAction({ commandId: "extract-min-zero", actionType: "web.dom.extract_list", extractList: { ...request, minItems: 0 } });
  expect(permissive.extraction?.recordCount ?? 0).toBeGreaterThanOrEqual(12);

  // A ceiling, not a sleep: the page already holds its list, so the same read
  // is not made to wait out the window for it.
  const again = Date.now();
  const settled = await harness.runAction({ commandId: "extract-settled", actionType: "web.dom.extract_list", extractList: request });
  expect(settled.extraction?.recordCount).toBe(waited.extraction?.recordCount);
  expect(Date.now() - again, `a page that already holds its list is read at once (first read ${waitedMs}ms)`).toBeLessThan(5_000);
});

test("the fields the detection proposes can read a card's own name, price, rating and link", async ({ openHarness, page }) => {
  test.setTimeout(120_000);
  const harness = await openHarness("everything-store");
  await openSearch(harness);
  await page.waitForTimeout(1_500);
  const structure = await detect(harness);
  const request = requestFrom(structure);

  // What the first organic card says, read off the page directly, so the
  // assertion below is against the store rather than against itself.
  const card = await page.evaluate((selector) => {
    const first = document.querySelector(selector);
    if (!first) return null;
    return {
      name: first.querySelector("h2 a span")?.textContent?.trim() ?? "",
      price: first.querySelector('[itemprop="offers"] > a > span > span:first-child')?.textContent?.trim() ?? "",
      rating: first.querySelector('h2 + div > span > span[aria-hidden="true"]')?.textContent?.trim() ?? "",
      url: first.querySelector("h2 a")?.getAttribute("href") ?? ""
    };
  }, ORGANIC);
  expect(card, "the store showed an organic result to read").toBeTruthy();
  if (!card) throw new Error("no organic card");

  const read = await harness.runAction({ commandId: "extract-fields", actionType: "web.dom.extract_list", extractList: request });
  expect(read.status, JSON.stringify(read.validation)).toBe("succeeded");
  const records = (read.extracted ?? []) as ReadonlyArray<Record<string, unknown>>;
  const values = records.flatMap((record) => Object.values(record).filter((value): value is string => typeof value === "string"));
  const carries = (what: string, value: string): void => {
    expect(values.some((seen) => seen === value || seen.endsWith(value)), `the proposal reads each card's ${what}`).toBe(true);
  };
  carries("name", card.name);
  carries("price", card.price);
  carries("rating", card.rating);
  carries("link", card.url);

  // And every one of those is a column a record carries in every item, not one
  // the page shows on some cards only: a field below full coverage is proposed
  // optional and reads `null`, which is how the title used to arrive.
  const full = structure.proposal.fields.filter((field) => field.coverage >= 1);
  expect(full.length, "most of what a card exposes is in every card").toBeGreaterThanOrEqual(8);
});
