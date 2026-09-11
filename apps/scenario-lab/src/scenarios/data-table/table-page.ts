import { escapeHtml, fixtureClient, page } from "../../html.js";
import type { RenderContext } from "../../types.js";
import { defaultColumnOrder, inventoryColumns, type InventoryColumn, type InventoryRow } from "./inventory.js";
import { sortView, type DataTableSort, type DataTableState, type DataTableView } from "./table-state.js";

const directions = ["ascending", "descending"] as const;

// The sort arrow is CSS generated content with empty alternative text, so a
// header's text and accessible name stay exactly its column name.
const styles = `<style>
  table { border-collapse: collapse; width: 100%; }
  caption { text-align: left; font-weight: 600; padding-bottom: .5rem; }
  th, td { text-align: left; padding: .4rem .6rem; border-bottom: 1px solid #d0d7de; }
  th button { font: inherit; font-weight: 600; background: none; border: 0; padding: 0; cursor: pointer; }
  th[aria-sort="ascending"]::after { content: " \\25B2" / ""; }
  th[aria-sort="descending"]::after { content: " \\25BC" / ""; }
</style>`;

/**
 * Server-renders the table from state. Sorting then happens in place: the
 * click handler moves the existing rows into the precomputed order for the
 * new sort before recording it through `mutate`, so the table is already
 * sorted when the click returns, and a reload shows the same order.
 */
export function renderDataTablePage(state: DataTableState, context: RenderContext): string {
  const rows = state.view.rowOrder.flatMap((id) => state.rows.filter((row) => row.id === id));
  const body = `${styles}<main>
    <h1>Inventory</h1>
    <p>Stock levels for every catalog product. Select a column heading to sort the table.</p>
    <p data-testid="row-count">${state.rows.length} products</p>
    <p data-testid="sort-status" role="status">${escapeHtml(state.view.description)}</p>
    <table data-testid="inventory-table">
      <caption>Current stock by product</caption>
      <thead><tr>${state.columnOrder.map((column) => headerCell(column, state.sort)).join("")}</tr></thead>
      <tbody data-testid="inventory-body">${rows.map((row) => bodyRow(row, state.columnOrder)).join("")}</tbody>
    </table>
    <footer><small data-testid="seed-marker">Snapshot ${escapeHtml(state.seedMarker)}</small></footer>
  </main>`;
  return page("Inventory", body, clientScript(state, context));
}

function headerCell(column: InventoryColumn, sort: DataTableSort | null): string {
  const ariaSort = sort?.column === column ? ` aria-sort="${sort.direction}"` : "";
  return `<th scope="col"${ariaSort}><button type="button" data-testid="sort-${column}">${escapeHtml(inventoryColumns[column].header)}</button></th>`;
}

/** Data cells carry no attributes: the header row is the only column mapping, as on real sites. */
function bodyRow(row: InventoryRow, columnOrder: readonly InventoryColumn[]): string {
  const cells = columnOrder.map((column) => `<td>${escapeHtml(row[column])}</td>`).join("");
  return `<tr data-testid="inventory-row" data-row-id="${escapeHtml(row.id)}">${cells}</tr>`;
}

function clientScript(state: DataTableState, context: RenderContext): string {
  const views = Object.fromEntries(defaultColumnOrder.flatMap((column) => directions.map(
    (direction): [string, DataTableView] => [`${column}:${direction}`, sortView(state.rows, { column, direction })],
  )));
  return `${fixtureClient(context.runToken, "data-table")}
const views = ${json(views)};
let sort = ${json(state.sort)};
let latest = 0;
const body = document.querySelector('[data-testid="inventory-body"]');
const status = document.querySelector('[data-testid="sort-status"]');
const buttons = Array.from(document.querySelectorAll('thead button[data-testid^="sort-"]'));
function show(next) {
  const view = views[next.column + ':' + next.direction];
  if (!view) return;
  sort = next;
  const rows = new Map(Array.from(body.rows, (row) => [row.dataset.rowId, row]));
  for (const id of view.rowOrder) { const row = rows.get(id); if (row) body.append(row); }
  for (const button of buttons) {
    const header = button.closest('th');
    if (button.dataset.testid === 'sort-' + next.column) header.setAttribute('aria-sort', next.direction);
    else header.removeAttribute('aria-sort');
  }
  status.textContent = view.description;
}
for (const button of buttons) button.addEventListener('click', async () => {
  const column = button.dataset.testid.slice('sort-'.length);
  show({ column, direction: sort && sort.column === column && sort.direction === 'ascending' ? 'descending' : 'ascending' });
  const request = ++latest;
  const snapshot = await mutate('sort', { column });
  if (request === latest && snapshot.state.sort) show(snapshot.state.sort);
});`;
}

function json(value: unknown): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}
