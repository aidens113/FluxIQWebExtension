// `web.dom.extract_list` against the two extraction fixtures: the catalog,
// whose pages are fetched and swapped in after a delay, and the inventory
// table, whose only column mapping is its header row.
//
// What each spec is really proving:
// - the records are the page's own text and raw attributes, not a shape the
//   extractor invented;
// - following Next reads each new page rather than the stale one it replaced;
// - `maxPages` and `maxItems` stopping early is reported as `truncated`, while
//   the list simply ending is not;
// - a declared field no record yields fails the validation with
//   `output_not_observed`, so a dropped column cannot pass as a clean read;
// - reading by column header survives the columns being reordered, which
//   reading by position would not.

import { expect, test } from "../index.js";
import type { ContentHarness } from "../index.js";

const CARD = '[data-testid="product-card"]';
const NEXT = '[data-testid="pagination-next"]';
const PAGE_STATUS = '[data-testid="page-status"]';
const ROW = '[data-testid="inventory-row"]';

/** Name, price, and rating as the card renders them, and the product link's raw root-relative href. */
const cardFields = {
  name: '[data-testid="product-name"]',
  price: '[data-testid="product-price"]',
  rating: '[data-testid="product-rating"]',
  url: '[data-testid="product-link"]@href'
};

/** Every field reads the cell under its header, so extraction survives the column-reorder variant. */
const columnFields = { product: "column:Product", category: "column:Category", price: "column:Price", stock: "column:Stock" };

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

const INVENTORY = [
  { product: "Ceramic pour-over set", category: "Kitchen", price: "$34.00", stock: "18" },
  { product: "Walnut desk organizer", category: "Office", price: "$48.50", stock: "7" },
  { product: "Enamel camp mug", category: "Outdoor", price: "$12.00", stock: "64" },
  { product: "Linen table runner", category: "Home", price: "$27.95", stock: "23" },
  { product: "Brass desk lamp", category: "Lighting", price: "$129.00", stock: "4" },
  { product: "Cast iron skillet", category: "Kitchen", price: "$42.00", stock: "31" },
  { product: "Recycled notebook set", category: "Office", price: "$9.50", stock: "120" },
  { product: "Folding camp stool", category: "Outdoor", price: "$36.75", stock: "0" },
  { product: "Wool throw blanket", category: "Home", price: "$89.00", stock: "12" },
  { product: "Paper pendant shade", category: "Lighting", price: "$58.25", stock: "9" },
  { product: "Bamboo cutting board", category: "Kitchen", price: "$19.99", stock: "45" },
  { product: "Stainless water bottle", category: "Outdoor", price: "$24.00", stock: "76" }
];

/**
 * Arms a fixture variant through the Lab's authenticated `mutate` endpoint, as
 * `armScenarioVariant` does, then reloads so the server renders the armed page
 * with the content script back in it.
 */
async function armVariant(harness: ContentHarness, operation: string, payload: unknown = {}): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`The Scenario Lab answered ${response.status} arming ${operation} on ${harness.scenarioId}.`);
  await harness.page.reload();
  const ready = (await harness.messages()).some((message) => message.type === "fluxiq.contentReady");
  expect(ready, "the content script re-announced itself after the reload").toBe(true);
}

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
        expected: "every record carries name, price, rating, url",
        actual: "8 records from 1 page; every declared field present"
      }
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
      validation: { status: "passed", actual: "16 records from 2 pages, truncated; every declared field present" }
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
        expected: "every record carries name, sku",
        actual: "8 records from 1 page; missing from some records: sku"
      },
      failure: { category: "output_not_observed", code: "web.validation.output_not_observed", retryable: true, stage: "verification" }
    });
    // The records that were read are still reported: the failure is the missing field, not the read.
    expect(reply.extracted).toEqual(FIRST_PAGE.map((record) => ({ name: record.name })));
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

test.describe("on data-table", () => {
  test("column: each field reads the cell under its header", async ({ openHarness }) => {
    const harness = await openHarness("data-table");
    const reply = await harness.runAction({
      commandId: "extract-inventory",
      actionType: "web.dom.extract_list",
      extractList: { item: ROW, fields: columnFields }
    });
    expect(reply).toMatchObject({
      status: "succeeded",
      validation: {
        status: "passed",
        expected: "every record carries product, category, price, stock",
        actual: "12 records from 1 page; every declared field present"
      }
    });
    expect(reply.extracted).toEqual(INVENTORY);
  });

  test("column-reorder: the same records come back from reordered columns", async ({ openHarness, page }) => {
    const harness = await openHarness("data-table");
    await armVariant(harness, "reorder-columns");
    await expect(page.locator("thead th").first()).toHaveText("Price");
    const reply = await harness.runAction({
      commandId: "extract-reordered",
      actionType: "web.dom.extract_list",
      extractList: { item: ROW, fields: columnFields }
    });
    expect(reply).toMatchObject({ status: "succeeded", validation: { status: "passed" } });
    expect(reply.extracted).toEqual(INVENTORY);
  });

  test("a column header the table does not have is reported missing, not read from another column", async ({ openHarness }) => {
    const harness = await openHarness("data-table");
    const reply = await harness.runAction({
      commandId: "extract-renamed-column",
      actionType: "web.dom.extract_list",
      extractList: { item: ROW, fields: { product: "column:Product", sku: "column:SKU" } }
    });
    expect(reply).toMatchObject({
      status: "failed",
      validation: { status: "failed", actual: "12 records from 1 page; missing from some records: sku" },
      failure: { category: "output_not_observed" }
    });
    expect(reply.extracted).toEqual(INVENTORY.map((row) => ({ product: row.product })));
  });
});
