// `web.dom.extract_list` against the inventory table, whose only column mapping
// is its header row.
//
// What these rows are really proving:
// - a field declared `column:` reads the cell under that header;
// - reading by column header survives the columns being reordered, which
//   reading by position would not;
// - a header the table does not have is reported missing rather than read from
//   another column;
// - the `{ kind: "column" }` spec reads what the `column:` grammar does.

import { expect, test } from "../../../index.js";
import { armVariant } from "./scenario-variant.js";

const ROW = '[data-testid="inventory-row"]';

/** Every field reads the cell under its header, so extraction survives the column-reorder variant. */
const columnFields = { product: "column:Product", category: "column:Category", price: "column:Price", stock: "column:Stock" };

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
