import {
  defaultColumnOrder, inventoryColumns, inventoryRows,
  type InventoryColumn, type InventoryColumnDefinition, type InventoryRow,
} from "./inventory.js";

export type SortDirection = "ascending" | "descending";
export type DataTableSort = { column: InventoryColumn; direction: SortDirection };

/** What the page shows for the current sort: row ids top to bottom, and the status line. */
export type DataTableView = { rowOrder: string[]; description: string };

export type DataTableState = {
  seedMarker: string;
  rows: InventoryRow[];
  /** Left-to-right column order; arming `column-reorder` changes it. */
  columnOrder: InventoryColumn[];
  sort: DataTableSort | null;
  sortCount: number;
  lastOperation: "seeded" | "sorted" | "columns-reordered";
  view: DataTableView;
};

/** The `column-reorder` layout. Every column changes position, so reading cells by index yields wrong fields. */
const reorderedColumns: readonly InventoryColumn[] = ["price", "stock", "category", "product"];

/** The catalog is fixed so expectations hold under any lab seed; the seed only names the snapshot. */
export function createDataTableState(seed: number): DataTableState {
  const rows = inventoryRows.map((row) => ({ ...row }));
  return {
    seedMarker: `data-table-seed-${seed}`,
    rows,
    columnOrder: [...defaultColumnOrder],
    sort: null,
    sortCount: 0,
    lastOperation: "seeded",
    view: sortView(rows, null),
  };
}

/**
 * `sort` with `{ column }` sorts that column ascending, or flips it to
 * descending when it is already sorted ascending. `reorder-columns` arms the
 * `column-reorder` variant. Any other operation or payload changes nothing.
 */
export function mutateDataTableState(state: DataTableState, operation: string, payload: unknown): DataTableState {
  if (operation === "reorder-columns") return { ...state, columnOrder: [...reorderedColumns], lastOperation: "columns-reordered" };
  if (operation !== "sort") return state;
  const column = columnOf(payload);
  if (!column) return state;
  const direction: SortDirection = state.sort?.column === column && state.sort.direction === "ascending" ? "descending" : "ascending";
  const sort: DataTableSort = { column, direction };
  return { ...state, sort, sortCount: state.sortCount + 1, lastOperation: "sorted", view: sortView(state.rows, sort) };
}

/**
 * Orders rows by the displayed text of one column: amounts as numbers, text
 * case-insensitively, ties by product name. Descending is the exact reverse.
 */
export function sortView(rows: readonly InventoryRow[], sort: DataTableSort | null): DataTableView {
  if (!sort) return { rowOrder: rows.map((row) => row.id), description: "Not sorted" };
  const { column, direction } = sort;
  const { header, sortAs } = inventoryColumns[column];
  const ascending = [...rows].sort((left, right) => compareCells(left[column], right[column], sortAs) || compareCells(left.product, right.product, "text"));
  const ordered = direction === "ascending" ? ascending : ascending.reverse();
  return { rowOrder: ordered.map((row) => row.id), description: `Sorted by ${header}, ${direction}` };
}

function compareCells(left: string, right: string, sortAs: InventoryColumnDefinition["sortAs"]): number {
  if (sortAs === "number") return amountOf(left) - amountOf(right);
  const a = left.toLowerCase();
  const b = right.toLowerCase();
  return a < b ? -1 : a > b ? 1 : 0;
}

/** "$1,299.00" reads as 1299: the displayed text is the only sort key, as on a real page. */
function amountOf(text: string): number {
  return Number(text.replace(/[^0-9.]/g, ""));
}

function columnOf(payload: unknown): InventoryColumn | undefined {
  if (typeof payload !== "object" || payload === null || !("column" in payload)) return undefined;
  const { column } = payload;
  return defaultColumnOrder.find((candidate) => candidate === column);
}
