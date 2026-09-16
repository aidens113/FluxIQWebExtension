import { createScenarioManifest, defineScenario } from "../../types.js";
import { inventoryRows } from "./inventory.js";
import { renderDataTablePage } from "./table-page.js";
import { createDataTableState, mutateDataTableState, type DataTableState } from "./table-state.js";

/** Every field reads the cell under its header, so extraction survives the `column-reorder` variant. */
const byHeader = { product: "column:Product", category: "column:Category", price: "column:Price", stock: "column:Stock" };

/** W08's expected records: every row, unsorted, as displayed. */
const everyRow = inventoryRows.map(({ product, category, price, stock }) => ({ product, category, price, stock }));

/**
 * Corpus rows W08 (primary: extract every row by header, with the
 * `column-reorder` variant) and W09 (`sort-by-price`: sort by the Price
 * header, then extract the first row).
 */
export const dataTableScenario = defineScenario<DataTableState>({
  id: "data-table",
  title: "Data table",
  startPath: "/scenarios/data-table/",
  seed: 115,
  manifest: createScenarioManifest({
    id: "data-table",
    title: "Data table",
    tags: ["extraction", "table", "sorting", "column-drift"],
    seed: 115,
    startPath: "/scenarios/data-table/",
    capabilities: ["mutation"],
    recordingScript: [
      { id: "extract-inventory", operation: "extract", target: "testid:inventory-row", fields: { ...byHeader } },
    ],
    expected: {
      extracted: [{ step: "extract-inventory", count: 12, records: everyRow }],
      finalState: [
        { id: "inventory-listed", subject: "row-count", predicate: "text", value: "12 products" },
        { id: "inventory-unsorted", subject: "sort-status", predicate: "text", value: "Not sorted" },
      ],
    },
    variants: [{
      id: "column-reorder",
      description: "The table renders its columns as Price, Stock, Category, Product; extraction by header must still yield the identical records.",
      arm: { operation: "reorder-columns" },
      expected: { extracted: [{ step: "extract-inventory", count: 12, records: everyRow }] },
    }, {
      id: "large-table",
      // 1,000 is the domain's WEB_AUTOMATION_EXTRACT_MAX_ITEMS, restated as a
      // literal because scenario-lab depends only on test-contracts and cannot
      // import the domain. `records` is deliberately absent: what the cap keeps
      // is a count and a flag, and listing 1,000 rows here would assert the
      // cap's cut-off point rather than that it reported itself.
      description: "The catalog grows to 2,000 rows, past the 1,000-record extraction cap: the read returns 1,000 records and reports itself truncated rather than passing a partial table off as the whole one.",
      arm: { operation: "load-large-inventory" },
      expected: {
        extracted: [{ step: "extract-inventory", count: 1000, truncated: true }],
        finalState: [
          { id: "large-inventory-listed", subject: "row-count", predicate: "text", value: "2000 products" },
          { id: "large-inventory-unsorted", subject: "sort-status", predicate: "text", value: "Not sorted" },
        ],
      },
    }],
    workflows: [{
      id: "empty-table",
      description: "Extract the inventory where an empty table is a valid answer: the step declares minItems: 0, so the no-rows variant succeeds with no records instead of failing as output_not_observed (D4).",
      recordingScript: [
        // minItems: 0 is what lets the no-rows variant expect an empty list; an
        // extract step fails on one by default (D4).
        { id: "extract-any-inventory", operation: "extract", target: "testid:inventory-row", fields: { ...byHeader }, minItems: 0 },
        { id: "inventory-read", operation: "checkpoint" },
      ],
      expected: {
        extracted: [{ step: "extract-any-inventory", count: 12, records: everyRow }],
        finalState: [{ id: "inventory-listed", subject: "row-count", predicate: "text", value: "12 products" }],
      },
      variants: [{
        id: "no-rows",
        description: "Every product is delisted. The table keeps its caption and its four headers and shows no rows, so `column:` fields still resolve and the read succeeds with no records.",
        arm: { operation: "clear-inventory" },
        expected: {
          extracted: [{ step: "extract-any-inventory", count: 0, records: [] }],
          finalState: [
            { id: "no-products-listed", subject: "row-count", predicate: "text", value: "0 products" },
            { id: "empty-inventory-shown", subject: "empty-inventory", predicate: "text", value: "No products are listed." },
          ],
        },
      }],
    }, {
      id: "sort-by-price",
      description: "Click the Price header to sort by amount, ascending, then extract the first row: the cheapest product.",
      recordingScript: [
        { id: "sort-price", operation: "click", target: "testid:sort-price" },
        { id: "extract-cheapest", operation: "extract", target: "[data-testid=\"inventory-row\"]:first-child", fields: { ...byHeader } },
      ],
      expected: {
        recordingEvents: [{ type: "web.element.clicked", count: 1 }],
        actions: [{ action: "web.dom.click", outcome: "succeeded" }],
        extracted: [{
          step: "extract-cheapest",
          count: 1,
          records: [{ product: "Recycled notebook set", category: "Office", price: "$9.50", stock: "120" }],
        }],
        finalState: [{ id: "sorted-by-price", subject: "sort-status", predicate: "text", value: "Sorted by Price, ascending" }],
      },
    }],
  }),
  createState: createDataTableState,
  mutate: mutateDataTableState,
  render: renderDataTablePage,
});
