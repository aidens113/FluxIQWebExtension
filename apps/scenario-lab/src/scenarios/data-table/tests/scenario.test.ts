import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow, validateWebScenario } from "@fluxiq-web-extension/test-contracts";
import { defaultColumnOrder, inventoryRows, LARGE_INVENTORY_ROWS } from "../inventory.js";
import { dataTableScenario } from "../scenario.js";
import type { DataTableState } from "../table-state.js";

const { manifest } = dataTableScenario;
const context = { runToken: "fixture-run-token-1234", seed: 42 };
const byHeader = { product: "column:Product", category: "column:Category", price: "column:Price", stock: "column:Stock" };
const everyRow = inventoryRows.map(({ product, category, price, stock }) => ({ product, category, price, stock }));
const cheapest = { product: "Recycled notebook set", category: "Office", price: "$9.50", stock: "120" };

const seeded = (): DataTableState => dataTableScenario.createState(42);
const apply = (state: DataTableState, operation: string, payload: unknown = {}): DataTableState => dataTableScenario.mutate(state, operation, payload);
const displayed = (state: DataTableState, key: "product" | "price" | "stock") => state.view.rowOrder.map((id) => state.rows.find((row) => row.id === id)?.[key]);

/** Header texts of the rendered table, left to right. */
function headersOf(html: string): string[] {
  return [...html.matchAll(/<th scope="col"[^>]*><button[^>]*>([^<]*)<\/button><\/th>/g)].map((match) => match[1] ?? "");
}

/** Cell texts of each rendered body row, left to right. */
function rowsOf(html: string): string[][] {
  return [...html.matchAll(/<tr data-testid="inventory-row"[^>]*>(.*?)<\/tr>/g)]
    .map((row) => [...(row[1] ?? "").matchAll(/<td>([^<]*)<\/td>/g)].map((cell) => cell[1] ?? ""));
}

/** Reads each row as a `column:<header>` field does: through the position of its header, never a fixed index. */
function recordsByHeader(html: string): Array<Record<string, string | undefined>> {
  const headers = headersOf(html);
  return rowsOf(html).map((cells) => Object.fromEntries(
    Object.entries(byHeader).map(([field, selector]) => [field, cells[headers.indexOf(selector.slice("column:".length))]]),
  ));
}

test("manifest is valid and resolves W08, its column-reorder variant, and W09", () => {
  const result = validateWebScenario(manifest);
  assert.equal(result.valid, true, result.valid ? "" : JSON.stringify(result.issues));
  assert.deepEqual([manifest.id, manifest.seed, manifest.startPath, manifest.networkPolicy], ["data-table", 115, "/scenarios/data-table/", "loopback-only"]);

  const primary = resolveScenarioWorkflow(manifest);
  assert.deepEqual(primary.recordingScript, [{ id: "extract-inventory", operation: "extract", target: "testid:inventory-row", fields: byHeader }]);
  assert.deepEqual(primary.expected.extracted, [{ step: "extract-inventory", count: 12, records: everyRow }]);
  assert.deepEqual(primary.expected.finalState?.map(({ subject, value }) => [subject, value]), [["row-count", "12 products"], ["sort-status", "Not sorted"]]);

  const reordered = resolveScenarioWorkflow(manifest, { variantId: "column-reorder" });
  assert.deepEqual(reordered.variant?.arm, { operation: "reorder-columns" });
  assert.deepEqual(reordered.recordingScript, primary.recordingScript);
  assert.deepEqual(reordered.expected, primary.expected, "the variant expects the identical records and inherits the rest");

  const sortByPrice = resolveScenarioWorkflow(manifest, { workflowId: "sort-by-price" });
  assert.deepEqual(sortByPrice.recordingScript, [
    { id: "sort-price", operation: "click", target: "testid:sort-price" },
    { id: "extract-cheapest", operation: "extract", target: '[data-testid="inventory-row"]:first-child', fields: byHeader },
  ]);
  assert.deepEqual(sortByPrice.expected.extracted, [{ step: "extract-cheapest", count: 1, records: [cheapest] }]);
  assert.deepEqual(sortByPrice.expected.finalState, [{ id: "sorted-by-price", subject: "sort-status", predicate: "text", value: "Sorted by Price, ascending" }]);
  assert.throws(() => resolveScenarioWorkflow(manifest, { workflowId: "sort-by-price", variantId: "column-reorder" }), /has no variant column-reorder/);
});

test("state is a pure function of the seed, and the seed changes only the snapshot marker", () => {
  const state = seeded();
  assert.deepEqual(seeded(), state);
  assert.deepEqual({ ...dataTableScenario.createState(7), seedMarker: state.seedMarker }, state);
  assert.equal(state.seedMarker, "data-table-seed-42");
  assert.deepEqual(state.columnOrder, ["product", "category", "price", "stock"]);
  assert.deepEqual([state.sort, state.sortCount, state.lastOperation], [null, 0, "seeded"]);
  assert.deepEqual(state.view, { rowOrder: inventoryRows.map((row) => row.id), description: "Not sorted" });
  assert.equal(state.rows.length, 12);
  for (const key of ["id", "product", "price", "stock"] as const) assert.equal(new Set(state.rows.map((row) => row[key])).size, 12, `${key} values are distinct`);
  assert.notEqual(state.rows[0], inventoryRows[0], "state owns copies of the catalog rows");
});

test("sort orders amounts as numbers, toggles direction, and restarts ascending on a new column", () => {
  const initial = seeded();
  const untouched = structuredClone(initial);
  const ascending = apply(initial, "sort", { column: "price" });
  assert.deepEqual(initial, untouched, "mutate does not modify its input");
  assert.deepEqual([ascending.sort, ascending.sortCount, ascending.lastOperation], [{ column: "price", direction: "ascending" }, 1, "sorted"]);
  assert.equal(ascending.view.description, "Sorted by Price, ascending");
  assert.deepEqual(displayed(ascending, "price"), ["$9.50", "$12.00", "$19.99", "$24.00", "$27.95", "$34.00", "$36.75", "$42.00", "$48.50", "$58.25", "$89.00", "$129.00"]);

  const descending = apply(ascending, "sort", { column: "price" });
  assert.deepEqual([descending.sort, descending.sortCount], [{ column: "price", direction: "descending" }, 2]);
  assert.deepEqual(descending.view.rowOrder, [...ascending.view.rowOrder].reverse());
  assert.equal(descending.view.description, "Sorted by Price, descending");
  assert.deepEqual(apply(descending, "sort", { column: "price" }).sort, { column: "price", direction: "ascending" });

  const byStock = apply(descending, "sort", { column: "stock" });
  assert.deepEqual(byStock.sort, { column: "stock", direction: "ascending" });
  assert.deepEqual(displayed(byStock, "stock"), ["0", "4", "7", "9", "12", "18", "23", "31", "45", "64", "76", "120"]);
  assert.deepEqual(displayed(apply(initial, "sort", { column: "category" }), "product"), [
    "Linen table runner", "Wool throw blanket", "Bamboo cutting board", "Cast iron skillet", "Ceramic pour-over set", "Brass desk lamp",
    "Paper pendant shade", "Recycled notebook set", "Walnut desk organizer", "Enamel camp mug", "Folding camp stool", "Stainless water bottle",
  ], "categories sort as text and ties fall back to the product name");
  assert.deepEqual(displayed(apply(initial, "sort", { column: "product" }), "product"), [...inventoryRows.map((row) => row.product)].sort());
});

test("invalid sort payloads and unknown operations leave the state untouched", () => {
  const initial = seeded();
  for (const payload of [{}, { column: "sku" }, { column: "Price" }, null, "price", ["price"]]) assert.equal(apply(initial, "sort", payload), initial, JSON.stringify(payload));
  assert.equal(apply(initial, "shuffle"), initial);
});

test("reorder-columns arms the column-reorder variant and changes only the column order", () => {
  const sorted = apply(seeded(), "sort", { column: "price" });
  const reordered = apply(sorted, "reorder-columns");
  assert.deepEqual(reordered.columnOrder, ["price", "stock", "category", "product"]);
  assert.equal(reordered.lastOperation, "columns-reordered");
  assert.deepEqual({ ...reordered, columnOrder: sorted.columnOrder, lastOperation: sorted.lastOperation }, sorted);
  assert.deepEqual(apply(reordered, "reorder-columns"), reordered);
  reordered.columnOrder.forEach((column, index) => assert.notEqual(column, defaultColumnOrder[index], `${column} changes position`));
});

test("the page maps cells to columns only through header text", () => {
  const html = dataTableScenario.render(seeded(), context);
  assert.match(html, /<caption>Current stock by product<\/caption>/);
  assert.deepEqual(headersOf(html), ["Product", "Category", "Price", "Stock"]);
  for (const column of defaultColumnOrder) assert.match(html, new RegExp(`<th scope="col"><button type="button" data-testid="sort-${column}">`));
  assert.equal(rowsOf(html).length, 12);
  assert.doesNotMatch(html, /<td\s/, "data cells carry no attributes");
  assert.doesNotMatch(html, /<th[^>]*aria-sort=/, "no header is sorted yet");
  assert.deepEqual(recordsByHeader(html), everyRow);
  assert.match(html, /<p data-testid="row-count">12 products<\/p>/);
  assert.match(html, /<p data-testid="sort-status" role="status">Not sorted<\/p>/);
  assert.match(html, /<small data-testid="seed-marker">Snapshot data-table-seed-42<\/small>/);
});

test("the column-reorder render moves every cell with its header, so header mapping still yields the W08 records", () => {
  const html = dataTableScenario.render(apply(seeded(), "reorder-columns"), context);
  assert.deepEqual(headersOf(html), ["Price", "Stock", "Category", "Product"]);
  assert.deepEqual(rowsOf(html)[0], ["$34.00", "18", "Kitchen", "Ceramic pour-over set"]);
  assert.deepEqual(recordsByHeader(html), everyRow);
  const positional = rowsOf(html).map(([product, category, price, stock]) => ({ product, category, price, stock }));
  assert.notDeepEqual(positional, everyRow, "reading cells by index would now be wrong");
});

test("a sorted render persists the order, marks only the sorted header, and embeds the views mutate produces", () => {
  const initial = seeded();
  const html = dataTableScenario.render(apply(initial, "sort", { column: "price" }), context);
  assert.deepEqual(recordsByHeader(html)[0], cheapest);
  assert.equal(html.match(/<th[^>]*aria-sort=/g)?.length, 1, "only the sorted header carries aria-sort");
  assert.match(html, /<th scope="col" aria-sort="ascending"><button type="button" data-testid="sort-price">Price<\/button><\/th>/);
  assert.match(html, /<p data-testid="sort-status" role="status">Sorted by Price, ascending<\/p>/);
  assert.match(html, /content: " \\25B2" \/ ""/, "the sort arrow is a CSS escape, not header text");

  const views = JSON.parse(/const views = (.+);\n/.exec(html)?.[1] ?? "{}") as Record<string, unknown>;
  assert.equal(Object.keys(views).length, 8);
  for (const column of defaultColumnOrder) {
    const ascending = apply(initial, "sort", { column });
    assert.deepEqual(views[`${column}:ascending`], ascending.view, `${column} ascending`);
    assert.deepEqual(views[`${column}:descending`], apply(ascending, "sort", { column }).view, `${column} descending`);
  }
});

test("the fixture serves only its start page", () => {
  assert.equal(dataTableScenario.route, undefined);
});

test("large-table arms 2,000 distinct rows and expects the read to stop at the 1,000-record cap and say so", () => {
  const resolved = resolveScenarioWorkflow(manifest, { variantId: "large-table" });
  assert.deepEqual(resolved.variant?.arm, { operation: "load-large-inventory" });
  assert.deepEqual(resolved.expected.extracted, [{ step: "extract-inventory", count: 1000, truncated: true }]);
  // The expectation is only meaningful while the page holds more rows than the cap.
  assert.ok(LARGE_INVENTORY_ROWS > 1000, "the table must exceed the cap for truncation to be observable");
  assert.deepEqual(resolved.recordingScript, resolveScenarioWorkflow(manifest).recordingScript, "the variant never changes the recording");

  const armed = apply(seeded(), "load-large-inventory");
  assert.equal(armed.rows.length, LARGE_INVENTORY_ROWS);
  assert.deepEqual([armed.lastOperation, armed.sort], ["large-inventory-loaded", null]);
  for (const key of ["id", "product"] as const) {
    assert.equal(new Set(armed.rows.map((row) => row[key])).size, LARGE_INVENTORY_ROWS, `${key} values stay distinct, so a truncated read cannot look de-duplicated`);
  }
  assert.deepEqual(armed.view.rowOrder, armed.rows.map((row) => row.id));
  assert.equal(armed.view.description, "Not sorted");
  assert.deepEqual(armed.rows[0], { ...inventoryRows[0], id: "sku-9001", product: `${inventoryRows[0]?.product} #1` });
});

test("the large table renders every row through the same headers, so extraction reads it the ordinary way", () => {
  const html = dataTableScenario.render(apply(seeded(), "load-large-inventory"), context);
  assert.deepEqual(headersOf(html), ["Product", "Category", "Price", "Stock"]);
  assert.equal(rowsOf(html).length, LARGE_INVENTORY_ROWS);
  assert.match(html, /<p data-testid="row-count">2000 products<\/p>/);
  assert.match(html, /<p data-testid="sort-status" role="status">Not sorted<\/p>/);
  assert.doesNotMatch(html, /data-testid="empty-inventory"/, "a full table shows no empty state");
  assert.deepEqual(recordsByHeader(html)[0], { product: "Ceramic pour-over set #1", category: "Kitchen", price: "$34.00", stock: "18" });
});

test("the empty-table workflow declares minItems: 0, and its no-rows variant expects an empty list", () => {
  const workflow = resolveScenarioWorkflow(manifest, { workflowId: "empty-table" });
  const step = workflow.recordingScript.find(({ operation }) => operation === "extract");
  assert.deepEqual(step, { id: "extract-any-inventory", operation: "extract", target: "testid:inventory-row", fields: byHeader, minItems: 0 });
  assert.deepEqual(workflow.expected.extracted, [{ step: "extract-any-inventory", count: 12, records: everyRow }]);

  const empty = resolveScenarioWorkflow(manifest, { workflowId: "empty-table", variantId: "no-rows" });
  assert.deepEqual(empty.variant?.arm, { operation: "clear-inventory" });
  assert.deepEqual(empty.expected.extracted, [{ step: "extract-any-inventory", count: 0, records: [] }]);
  assert.deepEqual(empty.expected.finalState?.map(({ subject, value }) => [subject, value]), [["row-count", "0 products"], ["empty-inventory", "No products are listed."]]);
  // D4's rule is what makes the empty expectation reachable, so pin it here too.
  assert.equal(step?.minItems, 0, "an extract step fails on an empty list unless it declares minItems: 0");
});

test("clear-inventory empties the table but keeps the headers a column field resolves through", () => {
  const cleared = apply(seeded(), "clear-inventory");
  assert.deepEqual(cleared.rows, []);
  assert.deepEqual([cleared.lastOperation, cleared.sort], ["inventory-cleared", null]);
  assert.deepEqual(cleared.view, { rowOrder: [], description: "Not sorted" });
  assert.deepEqual(cleared.columnOrder, defaultColumnOrder, "the columns survive the rows");

  const html = dataTableScenario.render(cleared, context);
  assert.deepEqual(headersOf(html), ["Product", "Category", "Price", "Stock"], "headers render with no rows, so column: fields still resolve");
  assert.equal(rowsOf(html).length, 0);
  assert.match(html, /<caption>Current stock by product<\/caption>/);
  assert.match(html, /<p data-testid="row-count">0 products<\/p>/);
  assert.match(html, /<p data-testid="empty-inventory">No products are listed\.<\/p>/);
});

test("clearing and loading drop a sort rather than describing one the table no longer has", () => {
  const sorted = apply(seeded(), "sort", { column: "price" });
  assert.equal(sorted.view.description, "Sorted by Price, ascending");
  for (const operation of ["clear-inventory", "load-large-inventory"]) {
    const next = apply(sorted, operation);
    assert.equal(next.sort, null, operation);
    assert.equal(next.view.description, "Not sorted", operation);
    assert.equal(next.sortCount, sorted.sortCount, `${operation} reports no new sort`);
  }
  const untouched = structuredClone(sorted);
  apply(sorted, "clear-inventory");
  apply(sorted, "load-large-inventory");
  assert.deepEqual(sorted, untouched, "mutate does not modify its input");
});
