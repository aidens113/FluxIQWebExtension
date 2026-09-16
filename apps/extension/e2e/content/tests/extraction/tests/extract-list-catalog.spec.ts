// `web.dom.extract_list` against the product catalog, whose pages are fetched
// and swapped in after a delay, and the structured field specs read there.
//
// What these rows are really proving:
// - the records are the page's own text and raw attributes, not a shape the
//   extractor invented;
// - following Next reads each new page rather than the stale one it replaced;
// - `maxPages` and `maxItems` stopping early is reported as `truncated`, while
//   the list simply ending is not;
// - a read that returns gives its own account on `extraction` beside the
//   records: the counts, the truncation flag, and the declared field keys;
// - a structured field spec reads by kind -- text, an attribute, or a link
//   resolved against the page -- and an optional field the page cannot read is
//   `null` rather than a field the record lacks;
// - a declared field no record yields, or fewer records than `minItems`, fails
//   the validation with `output_not_observed`, so a dropped column or an empty
//   list cannot pass as a clean read;
// - the command's `timeoutMs` bounds the whole read, and running out of it
//   reports `timed_out` with what was read.
//
// The other fixtures are in the sibling specs: `extract-list-table.spec.ts`,
// `extract-list-sensitive.spec.ts` and `extract-list-pagination.spec.ts`.

import { expect, test } from "../../../index.js";
import { armVariant, reloadHarness } from "./scenario-variant.js";

const CARD = '[data-testid="product-card"]';
const LINK = '[data-testid="product-link"]';
const NEXT = '[data-testid="pagination-next"]';
/** Every numbered page control, which `numbered` pagination walks in turn. */
const PAGE_NUMBERS = '[data-testid^="pagination-page-"]';
const PAGE_STATUS = '[data-testid="page-status"]';

/** Name, price, and rating as the card renders them, and the product link's raw root-relative href. */
const cardFields = {
  name: '[data-testid="product-name"]',
  price: '[data-testid="product-price"]',
  rating: '[data-testid="product-rating"]',
  url: `${LINK}@href`
};

const FIRST_PAGE = [
  { name: "Aurora Desk Lamp", price: "$49.00", rating: "4.6 out of 5", url: "/scenarios/product-catalog/products/aurora-desk-lamp" },
  { name: "Birch Bookshelf", price: "$189.00", rating: "4.3 out of 5", url: "/scenarios/product-catalog/products/birch-bookshelf" },
  { name: "Cobalt Ceramic Mug", price: "$14.50", rating: "4.8 out of 5", url: "/scenarios/product-catalog/products/cobalt-ceramic-mug" },
  { name: "Drift Wool Throw", price: "$72.00", rating: "4.4 out of 5", url: "/scenarios/product-catalog/products/drift-wool-throw" },
  { name: "Ember Scented Candle", price: "$22.00", rating: "4.1 out of 5", url: "/scenarios/product-catalog/products/ember-scented-candle" },
  { name: "Fjord Standing Desk", price: "$1,249.00", rating: "4.7 out of 5", url: "/scenarios/product-catalog/products/fjord-standing-desk" },
  { name: "Grove Planter Set", price: "$38.75", rating: "3.9 out of 5", url: "/scenarios/product-catalog/products/grove-planter-set" },
  { name: "Harbor Wall Clock", price: "$56.00", rating: "4.2 out of 5", url: "/scenarios/product-catalog/products/harbor-wall-clock" }
];

test.describe("on product-catalog", () => {
  test("page one: every card's text and its link's raw href", async ({ openHarness }) => {
    const harness = await openHarness("product-catalog");
    const reply = await harness.runAction({
      commandId: "extract-page-one",
      actionType: "web.dom.extract_list",
      extractList: { item: CARD, fields: cardFields }
    });
    expect(reply).toMatchObject({
      status: "succeeded",
      message: "List extracted.",
      validation: {
        status: "passed",
        expected: "at least 1 record, each carrying name, price, rating, url",
        actual: "8 records from 1 page; every declared field present"
      },
      extraction: { recordCount: 8, pagesRead: 1, truncated: false, missingFields: [], fieldNames: ["name", "price", "rating", "url"] }
    });
    expect(reply.extracted).toEqual(FIRST_PAGE);
  });

  test("every page: Next is followed until it is absent, and each new page is read, not the stale one", async ({ openHarness, page }) => {
    const harness = await openHarness("product-catalog");
    const reply = await harness.runAction({
      commandId: "extract-all-pages",
      actionType: "web.dom.extract_list",
      extractList: { item: CARD, fields: cardFields, paginate: { next: NEXT, maxPages: 5 } }
    });
    expect(reply).toMatchObject({
      status: "succeeded",
      validation: { status: "passed", actual: "23 records from 3 pages; every declared field present" }
    });
    const records = reply.extracted as Array<Record<string, string>>;
    expect(records).toHaveLength(23);
    expect(records.slice(0, 8)).toEqual(FIRST_PAGE);
    expect(records[22]).toEqual({
      name: "Willow Reading Lamp",
      price: "$64.00",
      rating: "4.4 out of 5",
      url: "/scenarios/product-catalog/products/willow-reading-lamp"
    });
    // Every name is distinct, so no page was read twice.
    expect(new Set(records.map((record) => record.name)).size).toBe(23);
    await expect(page.locator(PAGE_STATUS)).toHaveText("Page 3 of 3");
    await expect(page.locator(NEXT)).toHaveCount(0);
  });

  test("maxPages: stopping with a page left is reported as truncated", async ({ openHarness, page }) => {
    const harness = await openHarness("product-catalog");
    const reply = await harness.runAction({
      commandId: "extract-two-pages",
      actionType: "web.dom.extract_list",
      extractList: { item: CARD, fields: cardFields, paginate: { next: NEXT, maxPages: 2 } }
    });
    expect(reply).toMatchObject({
      status: "succeeded",
      validation: { status: "passed", actual: "16 records from 2 pages, truncated; every declared field present" },
      extraction: { recordCount: 16, pagesRead: 2, truncated: true, missingFields: [] }
    });
    await expect(page.locator(PAGE_STATUS)).toHaveText("Page 2 of 3");
  });

  test("maxItems: the record list is bounded and reported as truncated", async ({ openHarness }) => {
    const harness = await openHarness("product-catalog");
    const reply = await harness.runAction({
      commandId: "extract-three",
      actionType: "web.dom.extract_list",
      extractList: { item: CARD, fields: cardFields, maxItems: 3 }
    });
    expect(reply).toMatchObject({
      status: "succeeded",
      validation: { status: "passed", actual: "3 records from 1 page, truncated; every declared field present" }
    });
    expect(reply.extracted).toEqual(FIRST_PAGE.slice(0, 3));
  });

  test("a declared field no record yields fails the validation with output_not_observed", async ({ openHarness }) => {
    const harness = await openHarness("product-catalog");
    const reply = await harness.runAction({
      commandId: "extract-missing-field",
      actionType: "web.dom.extract_list",
      extractList: { item: CARD, fields: { name: cardFields.name, sku: '[data-testid="product-sku"]' } }
    });
    expect(reply).toMatchObject({
      status: "failed",
      message: "List extracted.",
      validation: {
        status: "failed",
        expected: "at least 1 record, each carrying name, sku",
        actual: "8 records from 1 page; missing from some records: sku"
      },
      failure: { category: "output_not_observed", code: "web.validation.output_not_observed", retryable: true, stage: "verification" },
      // Every missing field is a declared one, so the domain's wire copy keeps the summary.
      extraction: { recordCount: 8, pagesRead: 1, truncated: false, missingFields: ["sku"], fieldNames: ["name", "sku"] }
    });
    // The records that were read are still reported: the failure is the missing field, not the read.
    expect(reply.extracted).toEqual(FIRST_PAGE.map((record) => ({ name: record.name })));
  });

  test("an item selector matching nothing fails with output_not_observed", async ({ openHarness }) => {
    const harness = await openHarness("product-catalog");
    const reply = await harness.runAction({
      commandId: "extract-no-items",
      actionType: "web.dom.extract_list",
      extractList: { item: '[data-testid="no-such-card"]', fields: cardFields }
    });
    expect(reply).toMatchObject({
      status: "failed",
      validation: {
        status: "failed",
        expected: "at least 1 record, each carrying name, price, rating, url",
        actual: "0 records from 1 page; fewer than the 1 required"
      },
      failure: { category: "output_not_observed", code: "web.validation.output_not_observed" }
    });
    expect(reply.extracted).toEqual([]);
  });

  test("minItems: 0 lets an empty list succeed", async ({ openHarness }) => {
    const harness = await openHarness("product-catalog");
    const reply = await harness.runAction({
      commandId: "extract-empty-allowed",
      actionType: "web.dom.extract_list",
      extractList: { item: '[data-testid="no-such-card"]', fields: cardFields, minItems: 0 }
    });
    expect(reply).toMatchObject({
      status: "succeeded",
      validation: { status: "passed", actual: "0 records from 1 page; every declared field present" }
    });
    expect(reply.extracted).toEqual([]);
  });

  test("timeoutMs: a read that outlasts it reports timed_out with the pages it read", async ({ openHarness }) => {
    const harness = await openHarness("product-catalog");
    // The catalog waits 150 ms before it even fetches the next page, so a
    // 100 ms budget runs out while the read is waiting for page two.
    const reply = await harness.runAction({
      commandId: "extract-out-of-time",
      actionType: "web.dom.extract_list",
      timeoutMs: 100,
      extractList: { item: CARD, fields: cardFields, paginate: { next: NEXT, maxPages: 5 } }
    });
    expect(reply).toMatchObject({
      status: "timed_out",
      message: "Timed out extracting the list after 1 page.",
      validation: { status: "failed", actual: "8 records from 1 page; the time ran out before the list ended" },
      failure: { code: "web.action.timeout", category: "timeout" },
      extraction: { recordCount: 8, pagesRead: 1, truncated: false, missingFields: [], fieldNames: ["name", "price", "rating", "url"] }
    });
    expect(reply.extracted).toEqual(FIRST_PAGE);
    // Which page is showing is deliberately not asserted: a read that ran out
    // of time makes no promise about it (decision D5).
  });

  test("numbered: every page is visited once, ending on the last, and reading what Next reads", async ({ openHarness, page }) => {
    const harness = await openHarness("product-catalog");
    const numbered = await harness.runAction({
      commandId: "extract-numbered",
      actionType: "web.dom.extract_list",
      extractList: { item: CARD, fields: cardFields, paginate: { mode: "numbered", pages: PAGE_NUMBERS, maxPages: 5 } }
    });
    expect(numbered).toMatchObject({
      status: "succeeded",
      validation: { status: "passed", actual: "23 records from 3 pages; every declared field present" },
      extraction: { recordCount: 23, pagesRead: 3, truncated: false, missingFields: [] }
    });
    // Each page read once: a page re-visited would repeat its eight names.
    expect(new Set((numbered.extracted as Array<Record<string, string>>).map((record) => record.name)).size).toBe(23);
    await expect(page.locator(PAGE_STATUS)).toHaveText("Page 3 of 3");
    // The fixture's own record of the view it last served: the read ended on
    // the last page it read (decision D5).
    expect((await harness.finalState()).state).toMatchObject({ view: { page: 3 } });

    // The same records Next reads, from a page one that is back where it began.
    await reloadHarness(harness);
    const next = await harness.runAction({
      commandId: "extract-numbered-against-next",
      actionType: "web.dom.extract_list",
      extractList: { item: CARD, fields: cardFields, paginate: { next: NEXT, maxPages: 5 } }
    });
    expect(numbered.extracted).toEqual(next.extracted);
  });

  test("text-variant: rewritten price text is extracted as the page now renders it", async ({ openHarness }) => {
    const harness = await openHarness("product-catalog");
    await armVariant(harness, "set-variant", { variant: "text-variant" });
    const reply = await harness.runAction({
      commandId: "extract-text-variant",
      actionType: "web.dom.extract_list",
      extractList: { item: CARD, fields: cardFields }
    });
    expect(reply).toMatchObject({ status: "succeeded", validation: { status: "passed" } });
    expect(reply.extracted).toEqual(FIRST_PAGE.map((record) => ({ ...record, price: `${record.price.slice(1)} USD` })));
  });
});

test.describe("structured field specs, on product-catalog", () => {
  test("each kind reads what it names, an optional miss is null, and an excluded field is no key at all", async ({ openHarness }) => {
    const harness = await openHarness("product-catalog");
    const reply = await harness.runAction({
      commandId: "extract-field-specs",
      actionType: "web.dom.extract_list",
      extractList: {
        item: CARD,
        fields: {
          name: { kind: "text", selector: cardFields.name },
          href: { kind: "attribute", selector: LINK, attribute: "href" },
          url: { kind: "link", selector: LINK },
          sku: { kind: "text", selector: '[data-testid="product-sku"]', required: false },
          price: { kind: "text", selector: cardFields.price, handling: "exclude" }
        }
      }
    });
    expect(reply).toMatchObject({
      status: "succeeded",
      validation: { status: "passed", expected: "at least 1 record, each carrying name, href, url, sku" },
      extraction: { recordCount: 8, pagesRead: 1, truncated: false, missingFields: [], fieldNames: ["name", "href", "url", "sku"] }
    });
    // `attribute` reads the raw href; `link` resolves the same href against the
    // page; the card has no sku, and an optional field the page cannot read is
    // `null`; the excluded price is not a key.
    expect(reply.extracted).toEqual(FIRST_PAGE.map(({ name, url }) => ({ name, href: url, url: new URL(url, harness.url).href, sku: null })));
  });

  test("a required field the page cannot read still fails with output_not_observed", async ({ openHarness }) => {
    const harness = await openHarness("product-catalog");
    const reply = await harness.runAction({
      commandId: "extract-required-spec",
      actionType: "web.dom.extract_list",
      extractList: { item: CARD, fields: { name: cardFields.name, sku: { kind: "text", selector: '[data-testid="product-sku"]' } } }
    });
    expect(reply).toMatchObject({
      status: "failed",
      validation: { status: "failed", actual: "8 records from 1 page; missing from some records: sku" },
      failure: { category: "output_not_observed" },
      extraction: { missingFields: ["sku"], fieldNames: ["name", "sku"] }
    });
    expect(reply.extracted).toEqual(FIRST_PAGE.map(({ name }) => ({ name })));
  });
});
