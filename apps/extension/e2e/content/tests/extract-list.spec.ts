// `web.dom.extract_list` against the two extraction fixtures: the catalog,
// whose pages are fetched and swapped in after a delay, and the inventory
// table, whose only column mapping is its header row -- and against the
// infinite-feed, sensitive-input, auth-gate and basic-form fixtures for what
// those two cannot show.
//
// What each spec is really proving:
// - the records are the page's own text and raw attributes, not a shape the
//   extractor invented;
// - following Next reads each new page rather than the stale one it replaced,
//   and a page that appends rather than replaces yields each item once;
// - `maxPages`, `maxItems` and the page's own item cap stopping early is
//   reported as `truncated`, while the list simply ending is not;
// - a read that returns gives its own account on `extraction` beside the
//   records: the counts, the truncation flag, and the declared field keys;
// - a structured field spec reads by kind -- text, an attribute, a link
//   resolved against the page, a control's live value, or a table column --
//   and an optional field the page cannot read is `null` rather than a field
//   the record lacks;
// - an excluded field is never read, so excluding a sensitive control's value
//   leaves the read to succeed while reading it refuses the whole read (D12);
// - every pagination mode -- `next`, `loadMore`, `scroll` and `numbered` --
//   reads each item once, reports its own bound as truncation but the list
//   ending as not, and leaves the page on the last page it read;
// - a declared field no record yields, or fewer records than `minItems`, fails
//   the validation with `output_not_observed`, so a dropped column or an empty
//   list cannot pass as a clean read -- and an empty list on a sign-in gate is
//   `auth_required`;
// - a field that resolves to a sensitive control, or to an element inside one
//   such as its option, refuses the whole read, and a text field skips the
//   contents of sensitive controls inside it;
// - the command's `timeoutMs` bounds the whole read, and running out of it
//   reports `timed_out` with what was read;
// - reading by column header survives the columns being reordered, which
//   reading by position would not.

import type { Page } from "@playwright/test";
import { expect, test } from "../index.js";
import type { ContentHarness } from "../index.js";

const CARD = '[data-testid="product-card"]';
const LINK = '[data-testid="product-link"]';
const NEXT = '[data-testid="pagination-next"]';
/** Every numbered page control, which `numbered` pagination walks in turn. */
const PAGE_NUMBERS = '[data-testid^="pagination-page-"]';
const PAGE_STATUS = '[data-testid="page-status"]';
const ROW = '[data-testid="inventory-row"]';

/** Name, price, and rating as the card renders them, and the product link's raw root-relative href. */
const cardFields = {
  name: '[data-testid="product-name"]',
  price: '[data-testid="product-price"]',
  rating: '[data-testid="product-rating"]',
  url: `${LINK}@href`
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
const SENSITIVE_FORM = '[data-testid="sensitive-form"]';
const SENSITIVE_LABELS = `${SENSITIVE_FORM} label`;
/** The email the sensitive-input fixture pre-fills, which is ordinary page content, not a secret. */
const FIXTURE_EMAIL = "synthetic-user@example.test";

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
  await reloadHarness(harness);
}

/** Reloads the fixture page and waits for the content script to announce itself again. */
async function reloadHarness(harness: ContentHarness): Promise<void> {
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

  test("a column spec reads the cell under its header, as the column: grammar does", async ({ openHarness }) => {
    const harness = await openHarness("data-table");
    const reply = await harness.runAction({
      commandId: "extract-column-spec",
      actionType: "web.dom.extract_list",
      extractList: { item: ROW, fields: { product: { kind: "column", header: "Product" }, stock: { kind: "column", header: "  Stock  " } } }
    });
    expect(reply).toMatchObject({ status: "succeeded", validation: { status: "passed" } });
    expect(reply.extracted).toEqual(INVENTORY.map(({ product, stock }) => ({ product, stock })));
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

  test("a field that resolves inside a sensitive control, such as one of its options, refuses the whole read", async ({ openHarness, page }) => {
    const harness = await openHarness("sensitive-input");
    // An option carries its sensitive select's value and label, so reading the
    // option is reading the control (decision D2).
    await page.evaluate(() => {
      const list = document.createElement("ul");
      list.dataset.testid = "security-answers";
      list.insertAdjacentHTML(
        "beforeend",
        '<li>Security answer <select data-sensitive="true"><option value="SYNTHETIC_OPTION_VALUE">SYNTHETIC_OPTION_LABEL</option></select></li>'
      );
      document.body.append(list);
    });
    const reads = [
      { why: "an option's text", item: '[data-testid="security-answers"] li', fields: { answer: "option" } },
      { why: "an option's value attribute", item: '[data-testid="security-answers"] li', fields: { answer: "option@value" } },
      { why: "an item that is itself an option", item: '[data-testid="security-answers"] option', fields: { answer: "" } }
    ];
    for (const [index, { why, item, fields }] of reads.entries()) {
      const reply = await harness.runAction({
        commandId: `extract-inside-sensitive-${index}`,
        actionType: "web.dom.extract_list",
        extractList: { item, fields }
      });
      expect(reply, why).toMatchObject({
        status: "failed",
        failure: { code: "web.action.rejected", category: "blocked_by_capability_or_policy" }
      });
      expect(reply, why).not.toHaveProperty("extracted");
      const wire = JSON.stringify(reply);
      for (const secret of [...FIXTURE_SECRETS, "SYNTHETIC_OPTION_VALUE", "SYNTHETIC_OPTION_LABEL"]) expect(wire, why).not.toContain(secret);
    }
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
    // The whole reply, its page snapshot included: no element descriptor quotes
    // a sensitive control's contents either.
    const wire = JSON.stringify(reply);
    for (const secret of [...FIXTURE_SECRETS, "SYNTHETIC_RECOVERY_NOTE", "SYNTHETIC_ANSWER_LABEL"]) expect(wire).not.toContain(secret);
  });

  test("a value field refuses a sensitive control and reads an ordinary one", async ({ openHarness }) => {
    const harness = await openHarness("sensitive-input");
    const refused = await harness.runAction({
      commandId: "extract-sensitive-value",
      actionType: "web.dom.extract_list",
      extractList: { item: SENSITIVE_FORM, fields: { password: { kind: "value", selector: '[data-testid="password"]' } } }
    });
    expect(refused).toMatchObject({ status: "failed", failure: { code: "web.action.rejected", category: "blocked_by_capability_or_policy" } });
    expect(refused).not.toHaveProperty("extracted");
    for (const secret of FIXTURE_SECRETS) expect(JSON.stringify(refused)).not.toContain(secret);

    const read = await harness.runAction({
      commandId: "extract-ordinary-value",
      actionType: "web.dom.extract_list",
      extractList: { item: SENSITIVE_FORM, fields: { username: { kind: "value", selector: 'input[name="username"]' } } }
    });
    expect(read).toMatchObject({ status: "succeeded", validation: { status: "passed" } });
    expect(read.extracted).toEqual([{ username: FIXTURE_EMAIL }]);
  });

  test("an excluded field is never read, so excluding a sensitive control leaves the read to succeed", async ({ openHarness }) => {
    const harness = await openHarness("sensitive-input");
    const reply = await harness.runAction({
      commandId: "extract-excluded-sensitive",
      actionType: "web.dom.extract_list",
      extractList: {
        item: SENSITIVE_FORM,
        fields: {
          username: { kind: "value", selector: 'input[name="username"]' },
          password: { kind: "value", selector: '[data-testid="password"]', handling: "exclude" },
          card: { kind: "value", selector: '[data-testid="payment"]', handling: "exclude" }
        }
      }
    });
    // Reading either excluded field would refuse the whole read, as the row
    // above shows. The read succeeding is what proves they were never read.
    expect(reply).toMatchObject({
      status: "succeeded",
      validation: { status: "passed", expected: "at least 1 record, each carrying username" },
      extraction: { recordCount: 1, fieldNames: ["username"] }
    });
    expect(reply.extracted).toEqual([{ username: FIXTURE_EMAIL }]);
    const wire = JSON.stringify(reply);
    for (const secret of FIXTURE_SECRETS) expect(wire).not.toContain(secret);
  });
});

test.describe("on infinite-feed", () => {
  const POST = '[data-testid="feed-item"]';
  /** The fixture's own post id, so a post read twice would show up, and the post's title. */
  const postFields = { id: "@data-item-id", title: '[data-testid="feed-item-title"]' };

  const postIds = (extracted: unknown): string[] => (extracted as Array<Record<string, string>>).map((record) => record.id ?? "");

  test("scroll: the feed is read to its end, each post once", async ({ openHarness }) => {
    const harness = await openHarness("infinite-feed");
    const reply = await harness.runAction({
      commandId: "extract-feed",
      actionType: "web.dom.extract_list",
      extractList: { item: POST, fields: postFields, paginate: { mode: "scroll", maxScrolls: 20 } }
    });
    expect(reply).toMatchObject({
      status: "succeeded",
      validation: { status: "passed", actual: "60 records from 6 pages; every declared field present" },
      extraction: { recordCount: 60, pagesRead: 6, truncated: false, missingFields: [] }
    });
    expect(new Set(postIds(reply.extracted)).size).toBe(60);
    // The fixture's own count of what it served: the read stopped because the
    // feed ended, not because it stopped looking.
    expect((await harness.finalState()).state).toMatchObject({ loadedCount: 60, ended: true });
  });

  test("scroll: maxScrolls stops the read and reports it truncated", async ({ openHarness }) => {
    const harness = await openHarness("infinite-feed");
    const reply = await harness.runAction({
      commandId: "extract-feed-capped",
      actionType: "web.dom.extract_list",
      extractList: { item: POST, fields: postFields, paginate: { mode: "scroll", maxScrolls: 2 } }
    });
    expect(reply).toMatchObject({
      status: "succeeded",
      validation: { status: "passed", actual: "30 records from 3 pages, truncated; every declared field present" },
      extraction: { recordCount: 30, pagesRead: 3, truncated: true }
    });
    // Two scrolls loaded two further pages, and the read scrolled no more.
    expect((await harness.finalState()).state).toMatchObject({ loadedCount: 30, ended: false });
  });

  test("scroll: a feed that ends early is read to that end", async ({ openHarness, page }) => {
    const harness = await openHarness("infinite-feed");
    await armVariant(harness, "set-mode", { mode: "end-early" });
    const reply = await harness.runAction({
      commandId: "extract-feed-end-early",
      actionType: "web.dom.extract_list",
      extractList: { item: POST, fields: postFields, paginate: { mode: "scroll", maxScrolls: 20 } }
    });
    expect(reply).toMatchObject({
      status: "succeeded",
      validation: { status: "passed", actual: "25 records from 3 pages; every declared field present" },
      extraction: { recordCount: 25, truncated: false }
    });
    expect(new Set(postIds(reply.extracted)).size).toBe(25);
    await expect(page.locator('[data-testid="feed-end"]')).toBeVisible();
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
    const feed = await injectAppendingFeed(page);
    const reply = await harness.runAction({
      commandId: "extract-appending",
      actionType: "web.dom.extract_list",
      extractList: { item: feed.item, fields: { text: "" }, paginate: { next: feed.control, maxPages: 5 } }
    });
    expect(reply).toMatchObject({
      status: "succeeded",
      validation: { status: "passed", actual: "7 records from 3 pages; every declared field present" }
    });
    expect(reply.extracted).toEqual(feedItems(7));
  });

  test("loadMore: appended items are read once, and a vanished control ends the list", async ({ openHarness, page }) => {
    const harness = await openHarness("basic-form");
    const feed = await injectAppendingFeed(page);
    const all = await harness.runAction({
      commandId: "extract-load-more",
      actionType: "web.dom.extract_list",
      extractList: { item: feed.item, fields: { text: "" }, paginate: { mode: "loadMore", control: feed.control, maxPages: 5 } }
    });
    expect(all).toMatchObject({
      status: "succeeded",
      validation: { status: "passed", actual: "7 records from 3 pages; every declared field present" },
      extraction: { recordCount: 7, pagesRead: 3, truncated: false }
    });
    expect(all.extracted).toEqual(feedItems(7));

    const capped = await injectAppendingFeed(page, { id: "capped-feed" });
    const stopped = await harness.runAction({
      commandId: "extract-load-more-capped",
      actionType: "web.dom.extract_list",
      extractList: { item: capped.item, fields: { text: "" }, paginate: { mode: "loadMore", control: capped.control, maxPages: 2 } }
    });
    expect(stopped).toMatchObject({
      status: "succeeded",
      validation: { status: "passed", actual: "5 records from 2 pages, truncated; every declared field present" },
      extraction: { recordCount: 5, pagesRead: 2, truncated: true }
    });
    expect(stopped.extracted).toEqual(feedItems(5));
    // The control is still there: stopping at maxPages is truncation, not the end.
    await expect(page.locator(capped.control)).toHaveCount(1);
  });

  test("loadMore: a control that ends up disabled ends the list rather than truncating it", async ({ openHarness, page }) => {
    const harness = await openHarness("basic-form");
    for (const ends of ["disabled", "aria-disabled"] as const) {
      const feed = await injectAppendingFeed(page, { id: `${ends}-feed`, ends });
      const reply = await harness.runAction({
        commandId: `extract-load-more-${ends}`,
        actionType: "web.dom.extract_list",
        extractList: { item: feed.item, fields: { text: "" }, paginate: { mode: "loadMore", control: feed.control, maxPages: 3 } }
      });
      // Three pages read and the control no longer usable: the list ended on
      // the page the bound would also have stopped at, and ending wins.
      expect(reply, ends).toMatchObject({
        status: "succeeded",
        validation: { status: "passed", actual: "7 records from 3 pages; every declared field present" },
        extraction: { recordCount: 7, pagesRead: 3, truncated: false }
      });
      expect(reply.extracted, ends).toEqual(feedItems(7));
    }
  });

  test("loadMore: an advance that outlasts timeoutMs reports timed_out with the first page", async ({ openHarness, page }) => {
    const harness = await openHarness("basic-form");
    const feed = await injectAppendingFeed(page, { id: "slow-feed", appendAfterMs: 150 });
    const reply = await harness.runAction({
      commandId: "extract-load-more-timeout",
      actionType: "web.dom.extract_list",
      timeoutMs: 100,
      extractList: { item: feed.item, fields: { text: "" }, paginate: { mode: "loadMore", control: feed.control, maxPages: 5 } }
    });
    expect(reply).toMatchObject({
      status: "timed_out",
      message: "Timed out extracting the list after 1 page.",
      failure: { code: "web.action.timeout", category: "timeout" },
      extraction: { recordCount: 3, pagesRead: 1, truncated: false }
    });
    expect(reply.extracted).toEqual(feedItems(3));
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

/** How an injected feed stops offering more: the way its control goes away. */
type FeedOptions = {
  /** Test id of the feed; its control is `<id>-more`. Several feeds can share a page. */
  id?: string;
  ends?: "removed" | "disabled" | "aria-disabled";
  /** How long the control takes to append, so a read can be given less time than that. */
  appendAfterMs?: number;
};

/**
 * A feed of three items and a control that appends two more after a delay. Its
 * second press ends the feed, in the same tick as that append, so a read sees
 * pages of 3, 5 and 7 items and then no way forward. Returns the selectors,
 * because several feeds may sit on one page.
 */
async function injectAppendingFeed(page: Page, options: FeedOptions = {}): Promise<{ item: string; control: string }> {
  const { id = "feed", ends = "removed", appendAfterMs = 50 } = options;
  await page.evaluate(({ id, ends, appendAfterMs }) => {
    const feed = document.createElement("ul");
    feed.dataset.testid = id;
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
    more.dataset.testid = `${id}-more`;
    more.textContent = "Load more";
    let clicks = 0;
    more.addEventListener("click", () => {
      // A control marked aria-disabled is still clickable; the page, like a
      // real one, ignores the press rather than loading again.
      if (more.getAttribute("aria-disabled") === "true") return;
      clicks += 1;
      const click = clicks;
      setTimeout(() => {
        append(2);
        if (click < 2) return;
        if (ends === "removed") more.remove();
        else if (ends === "disabled") more.disabled = true;
        else more.setAttribute("aria-disabled", "true");
      }, appendAfterMs);
    });
    document.querySelector("main")?.append(feed, more);
  }, { id, ends, appendAfterMs });
  return { item: `[data-testid="${id}"] li`, control: `[data-testid="${id}-more"]` };
}

/** The first `count` records an injected feed yields. */
function feedItems(count: number): Array<{ text: string }> {
  return Array.from({ length: count }, (_, index) => ({ text: `Feed item ${index + 1}` }));
}
