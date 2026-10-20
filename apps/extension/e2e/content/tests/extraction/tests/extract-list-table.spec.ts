// `web.dom.extract_list` against the company website's price list, one table
// per category whose only column mapping is its header row, fetched after the
// page loads and fetched again, and redrawn, whenever the VAT switch is used.
//
// What these rows are really proving:
// - a field declared `column:` reads the cell under that header, the row's own
//   `th scope=row` cell included;
// - a header the table does not have leaves its column blank and says so, rather
//   than being read from another column -- and rather than failing the read, since
//   the `column:` grammar cannot say `required` (2026-09-26);
// - the `{ kind: "column" }` spec reads what the `column:` grammar does;
// - text the page rewrote after it loaded is extracted as the page now renders
//   it, not as it first did.
//
// Reading by header surviving a column reorder needs one table drawn in two
// column orders, which no realistic site has; that is a unit test of the header
// lookup (`src/content/extraction/tests/field-reader-column.test.ts`).

import { PRICE_LIST, priceText, type PriceBasis } from "../../../../../../scenario-lab/src/scenarios/company-website/data/index.js";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

/** A service row of the open "Servicing & safety checks" table; a partner advert's name cell carries a "Sponsored" tag. */
const ROW = '[data-category="servicing"] tbody tr:not(:has(th span))';

/** Every field reads the cell under its header. */
const columnFields = { service: "column:Service", included: "column:What is included", price: "column:Price" };

/** The servicing services, partner adverts left out, in page order, priced on `basis` as the page writes it. */
function servicing(basis: PriceBasis): Array<{ service: string; included: string; price: string }> {
  const category = PRICE_LIST.find(({ id }) => id === "servicing");
  if (!category) throw new Error("The price list has no servicing category.");
  return category.rows.filter((row) => !row.partner).map((row) => ({ service: row.name, included: row.detail, price: priceText(row, basis) }));
}

const HOMEOWNER = servicing("inc");

/** One site operation, as the page's own scripts send it. */
async function apply(harness: ContentHarness, operation: string, payload: object = {}): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  expect(response.ok, `${operation} answered ${response.status}`).toBe(true);
}

/** Opens "Services & prices" with consent answered and the timed prompts dismissed, as a returning visitor sees it. */
async function openPrices(harness: ContentHarness): Promise<void> {
  await apply(harness, "set-consent", { choice: "essential" });
  await apply(harness, "dismiss-newsletter");
  await apply(harness, "dismiss-chat-greeting");
  await harness.page.goto(new URL("/scenarios/company-website/services", harness.lab.origin).href);
  await expect.poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady")).toBe(true);
}

test("the servicing table holds six services and an advert, so the rows read a real table with a row to leave out", () => {
  expect(HOMEOWNER).toHaveLength(6);
  expect(HOMEOWNER.map(({ price }) => price)).not.toEqual(servicing("ex").map(({ price }) => price));
});

test.describe("on company-website", () => {
  test.setTimeout(60_000);

  test("column: each field reads the cell under its header", async ({ openHarness }) => {
    const harness = await openHarness("company-website");
    await openPrices(harness);
    // The list is skeleton lines when the read is sent: it waits for the table.
    const reply = await harness.runAction({
      commandId: "extract-prices",
      actionType: "web.dom.extract_list",
      extractList: { item: ROW, fields: columnFields }
    });
    expect(reply).toMatchObject({
      status: "succeeded",
      validation: {
        status: "passed",
        expected: "at least 1 record, each carrying service, included, price",
        actual: "6 records from 1 page; every declared field present"
      }
    });
    expect(reply.extracted).toEqual(HOMEOWNER);
  });

  test("a column header the table does not have is left blank and said, not read from another column", async ({ openHarness }) => {
    const harness = await openHarness("company-website");
    await openPrices(harness);
    const reply = await harness.runAction({
      commandId: "extract-renamed-column",
      actionType: "web.dom.extract_list",
      extractList: { item: ROW, fields: { service: "column:Service", duration: "column:Duration" } }
    });
    // `duration` is never read from another column, and a header the table
    // lacks is a stated gap instead of destroying the rows read correctly.
    expect(reply).toMatchObject({
      status: "succeeded",
      validation: { status: "passed", actual: expect.stringContaining("6 records short of a declared field, blank in duration") },
      extraction: { recordCount: 6, missingFields: [], itemsSeen: 6, emptyRecords: 0 }
    });
    expect(reply.extracted).toEqual(HOMEOWNER.map((row) => ({ service: row.service, duration: null })));
  });

  test("a column spec reads the cell under its header, as the column: grammar does", async ({ openHarness }) => {
    const harness = await openHarness("company-website");
    await openPrices(harness);
    const reply = await harness.runAction({
      commandId: "extract-column-spec",
      actionType: "web.dom.extract_list",
      extractList: { item: ROW, fields: { service: { kind: "column", header: "Service" }, price: { kind: "column", header: "  Price  " } } }
    });
    expect(reply).toMatchObject({ status: "succeeded", validation: { status: "passed" } });
    expect(reply.extracted).toEqual(HOMEOWNER.map(({ service, price }) => ({ service, price })));
  });

  test("prices the VAT switch redrew are extracted as the page now renders them", async ({ openHarness, page }) => {
    const harness = await openHarness("company-website");
    await openPrices(harness);
    const before = await harness.runAction({
      commandId: "extract-homeowner-prices",
      actionType: "web.dom.extract_list",
      extractList: { item: ROW, fields: columnFields }
    });
    expect(before.extracted).toEqual(HOMEOWNER);

    // The switch re-fetches the list and replaces every table: the rows read
    // above are gone, and the read that follows waits for the new ones.
    await page.getByText("Landlords & business (ex. VAT)", { exact: true }).click();
    const after = await harness.runAction({
      commandId: "extract-business-prices",
      actionType: "web.dom.extract_list",
      extractList: { item: ROW, fields: columnFields }
    });
    expect(after).toMatchObject({ status: "succeeded", validation: { status: "passed" } });
    expect(after.extracted).toEqual(servicing("ex"));
  });
});
