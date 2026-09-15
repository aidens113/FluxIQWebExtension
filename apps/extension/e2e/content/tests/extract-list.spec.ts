// `web.dom.extract_list` against the two extraction fixtures: the catalog,
// whose pages are fetched and swapped in after a delay, and the inventory
// table, whose only column mapping is its header row -- and against the
// sensitive-input, auth-gate and basic-form fixtures for what those two cannot
// show.
//
// What each spec is really proving:
// - the records are the page's own text and raw attributes, not a shape the
//   extractor invented;
// - following Next reads each new page rather than the stale one it replaced,
//   and a page that appends rather than replaces yields each item once;
// - `maxPages`, `maxItems` and the page's own item cap stopping early is
//   reported as `truncated`, while the list simply ending is not;
// - a declared field no record yields, or fewer records than `minItems`, fails
//   the validation with `output_not_observed`, so a dropped column or an empty
//   list cannot pass as a clean read -- and an empty list on a sign-in gate is
//   `auth_required`;
// - a field that resolves to a sensitive control refuses the whole read, and a
//   text field skips the contents of sensitive controls inside it;
// - the command's `timeoutMs` bounds the whole read, and running out of it
//   reports `timed_out` with what was read;
// - reading by column header survives the columns being reordered, which
//   reading by position would not.

import type { Page } from "@playwright/test";
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

/** The sensitive-input fixture's own pre-filled secrets: the password, the card, and the multi-token billing card. */
const FIXTURE_SECRETS = ["SYNTHETIC_PASSWORD_DO_NOT_USE", "4111111111111111", "4222222222222220"];
const SENSITIVE_LABELS = '[data-testid="sensitive-form"] label';

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
        expected: "at least 1 record, each carrying name, price, rating, url",
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
        expected: "at least 1 record, each carrying name, sku",
        actual: "8 records from 1 page; missing from some records: sku"
      },
      failure: { category: "output_not_observed", code: "web.validation.output_not_observed", retryable: true, stage: "verification" }
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
      failure: { code: "web.action.timeout", category: "timeout" }
    });
    expect(reply.extracted).toEqual(FIRST_PAGE);
    // Which page is showing is deliberately not asserted: a read that ran out
    // of time makes no promise about it (decision D5).
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
        expected: "at least 1 record, each carrying product, category, price, stock",
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

test.describe("on sensitive-input", () => {
  test("a field that resolves to a sensitive control refuses the whole read", async ({ openHarness }) => {
    const harness = await openHarness("sensitive-input");
    const reply = await harness.runAction({
      commandId: "extract-sensitive-fields",
      actionType: "web.dom.extract_list",
      extractList: { item: SENSITIVE_LABELS, fields: { value: "input@value" } }
    });
    expect(reply).toMatchObject({
      status: "failed",
      failure: { code: "web.action.rejected", category: "blocked_by_capability_or_policy" }
    });
    expect(reply).not.toHaveProperty("extracted");
    const wire = JSON.stringify(reply);
    for (const secret of FIXTURE_SECRETS) expect(wire).not.toContain(secret);
  });

  test("a text field skips the contents of sensitive controls inside it", async ({ openHarness, page }) => {
    const harness = await openHarness("sensitive-input");
    await page.evaluate((labels) => {
      const form = document.querySelector(labels.replace(/ label$/u, ""));
      if (!form) throw new Error("the sensitive form is missing");
      form.insertAdjacentHTML(
        "beforeend",
        '<label>Recovery note <textarea data-sensitive="true">SYNTHETIC_RECOVERY_NOTE</textarea></label>' +
          '<label>Security answer <select data-sensitive="true"><option>SYNTHETIC_ANSWER_LABEL</option></select></label>'
      );
    }, SENSITIVE_LABELS);
    const reply = await harness.runAction({
      commandId: "extract-label-text",
      actionType: "web.dom.extract_list",
      extractList: { item: SENSITIVE_LABELS, fields: { label: "" } }
    });
    expect(reply).toMatchObject({ status: "succeeded", validation: { status: "passed" } });
    expect(reply.extracted).toEqual(
      ["Email", "Password", "Test card", "Billing card", "Recovery note", "Security answer"].map((label) => ({ label }))
    );
    const wire = JSON.stringify(reply);
    for (const secret of FIXTURE_SECRETS) expect(wire).not.toContain(secret);
    // The injected contents are scanned in the records, not the whole reply:
    // the reply's page snapshot still quotes them through the descriptor's
    // `text`, `visibleText` and `accessibleName` -- a defect outside
    // extraction, reported by x0-page.
    for (const secret of ["SYNTHETIC_RECOVERY_NOTE", "SYNTHETIC_ANSWER_LABEL"]) expect(JSON.stringify(reply.extracted)).not.toContain(secret);
  });
});

test.describe("on auth-gate", () => {
  test("an empty list on a sign-in gate is auth_required", async ({ openHarness }) => {
    // The start page is the sign-in form, with a rendered password control, so
    // a list of account rows matches nothing because the session is gone.
    const harness = await openHarness("auth-gate");
    const reply = await harness.runAction({
      commandId: "extract-behind-gate",
      actionType: "web.dom.extract_list",
      extractList: { item: '[data-testid="account-row"]', fields: { holder: "" } }
    });
    expect(reply).toMatchObject({ status: "failed", failure: { category: "auth_required" } });
    expect(reply.extracted).toEqual([]);
  });
});

test.describe("on basic-form", () => {
  test("an appending Next reads each item once", async ({ openHarness, page }) => {
    const harness = await openHarness("basic-form");
    await injectAppendingFeed(page);
    const reply = await harness.runAction({
      commandId: "extract-appending",
      actionType: "web.dom.extract_list",
      extractList: { item: '[data-testid="feed"] li', fields: { text: "" }, paginate: { next: '[data-testid="more"]', maxPages: 5 } }
    });
    expect(reply).toMatchObject({
      status: "succeeded",
      validation: { status: "passed", actual: "7 records from 3 pages; every declared field present" }
    });
    expect(reply.extracted).toEqual(Array.from({ length: 7 }, (_, index) => ({ text: `Feed item ${index + 1}` })));
  });

  test("an unbounded read stops at the domain's cap", async ({ openHarness, page }) => {
    const harness = await openHarness("basic-form");
    await page.evaluate((count) => {
      const list = document.createElement("ol");
      list.dataset.testid = "bulk";
      for (let index = 1; index <= count; index += 1) {
        const item = document.createElement("li");
        item.textContent = `Bulk item ${index}`;
        list.append(item);
      }
      document.querySelector("main")?.append(list);
    }, 1_005);
    const reply = await harness.runAction({
      commandId: "extract-capped",
      actionType: "web.dom.extract_list",
      extractList: { item: '[data-testid="bulk"] li', fields: { text: "" } }
    });
    expect(reply).toMatchObject({
      status: "succeeded",
      validation: { status: "passed", actual: "1000 records from 1 page, truncated; every declared field present" }
    });
    const records = reply.extracted as Array<Record<string, string>>;
    expect(records).toHaveLength(1_000);
    expect(records[999]).toEqual({ text: "Bulk item 1000" });
  });
});

/**
 * A feed of three items and a "more" control that appends two after 50 ms. Its
 * second click removes it in the same tick as the append, so the read sees
 * pages of 3, 5 and 7 items and then no control.
 */
async function injectAppendingFeed(page: Page): Promise<void> {
  await page.evaluate(() => {
    const feed = document.createElement("ul");
    feed.dataset.testid = "feed";
    let added = 0;
    const append = (count: number): void => {
      for (let index = 0; index < count; index += 1) {
        added += 1;
        const item = document.createElement("li");
        item.textContent = `Feed item ${added}`;
        feed.append(item);
      }
    };
    append(3);
    const more = document.createElement("button");
    more.type = "button";
    more.dataset.testid = "more";
    more.textContent = "Load more";
    let clicks = 0;
    more.addEventListener("click", () => {
      clicks += 1;
      const click = clicks;
      setTimeout(() => {
        append(2);
        if (click === 2) more.remove();
      }, 50);
    });
    document.querySelector("main")?.append(feed, more);
  });
}
