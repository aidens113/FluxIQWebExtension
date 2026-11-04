import type { ChatJsonObject, ChatTaskResultRows } from "@fluxiq/ui-components";
import { columnLabel } from "./column-label";

/** How many rows the chat keeps inline; the rest stay in the run's dataset. */
const PREVIEW_ROWS = 50;

const FIELD_ID = /^[A-Za-z0-9_-]{1,100}$/u;
const RESERVED = new Set(["__proto__", "constructor", "prototype"]);
const MAX_COLUMNS = 200;

/** What a JSON export held: the rows that read, how many there were, and whether the file was cut. */
export type DatasetRows = Pick<ChatTaskResultRows, "columns" | "previewRows" | "truncated"> & { rowCount: number };

/**
 * Reads a JSON export (an array of row objects) into the chat's preview. Columns
 * are the field ids the kept rows carry, labelled in plain words; a key that
 * could not be a column is left out of every row. A body that is not an array of
 * row objects throws, never reads as invented rows.
 */
export function datasetRows(body: string): DatasetRows {
  const parsed: unknown = JSON.parse(body);
  if (!Array.isArray(parsed)) {
    throw new Error("The export is not a list of rows.");
  }
  const kept = parsed.slice(0, PREVIEW_ROWS);
  const ids: string[] = [];
  for (const row of kept) {
    if (row === null || typeof row !== "object" || Array.isArray(row)) {
      throw new Error("The export holds a row that is not an object.");
    }
    for (const key of Object.keys(row)) {
      if (FIELD_ID.test(key) && !RESERVED.has(key) && !ids.includes(key) && ids.length < MAX_COLUMNS) {
        ids.push(key);
      }
    }
  }
  const previewRows = kept.map((row) => {
    const source = row as Record<string, unknown>;
    const shown: ChatJsonObject = {};
    for (const id of ids) {
      if (Object.hasOwn(source, id) && source[id] !== undefined) {
        shown[id] = source[id] as ChatJsonObject[string];
      }
    }
    return shown;
  });
  return { columns: ids.map((id) => ({ id, label: columnLabel(id) })), previewRows, truncated: false, rowCount: parsed.length };
}
