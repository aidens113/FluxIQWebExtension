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
    }],
    workflows: [{
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
