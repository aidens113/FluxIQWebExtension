// The confirmation preview: a few rows of what the extraction would record.
//
// Every cell holds text read off the page, so every cell is written with
// `textContent`. Nothing here decides *which* columns may be shown -- that is
// `extractionPreviewColumns` in `preview.ts`, and the rows this is handed have
// already had every other key dropped from them (D12). The separation matters:
// a renderer that filtered as it drew would leave the excluded values sitting in
// the object behind it, one careless `JSON.stringify` from being written down.

import type { ExtractionPreviewRow } from "./messages";
import type { ExtractionFieldRow } from "./view-model";

/** How many rows are drawn. The session holds at most 20; a panel this narrow shows a sample, not a table. */
const VISIBLE_ROWS = 5;

/** Draws `rows` under `columns` and answers how many rows were drawn. */
export function renderExtractionPreview(
  head: HTMLTableRowElement,
  body: HTMLElement,
  columns: readonly ExtractionFieldRow[],
  rows: readonly ExtractionPreviewRow[]
): number {
  head.replaceChildren(...columns.map((column) => headerCell(column.label)));
  const drawn = rows.slice(0, VISIBLE_ROWS);
  body.replaceChildren(...drawn.map((row) => bodyRow(columns, row)));
  return drawn.length;
}

function headerCell(label: string): HTMLTableCellElement {
  const cell = document.createElement("th");
  cell.scope = "col";
  cell.textContent = label;
  return cell;
}

function bodyRow(columns: readonly ExtractionFieldRow[], row: ExtractionPreviewRow): HTMLTableRowElement {
  const line = document.createElement("tr");
  for (const column of columns) {
    const cell = document.createElement("td");
    const value = row[column.sourceKey] ?? null;
    if (value === null || value === "") {
      cell.classList.add("extraction-preview-empty");
      cell.textContent = "--";
    } else {
      cell.textContent = value;
    }
    line.append(cell);
  }
  return line;
}
