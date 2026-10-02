// The read a list extraction dispatches when its author declared the table's
// columns: the same items, the same conditions, and only the declared columns
// kept as columns.
//
// **Why this exists.** Live runs 11 and 12 of 2026-09-30 built a Flow for "the
// Plus earbuds under $50" whose read kept six fields -- name, price, rating and
// url, which the instruction asked for, and `plus` and `ad`, which it kept only
// to filter by (`where plus present`, `where ad absent`). The model's own
// `recordOutput.schema` named the four. The answer stored all six, because the
// field map declares the columns (`./reconciled-record-output.ts`), so every row
// had two columns the instruction never asked for and the Lab paired none of
// them (`debugs/run-muq66ff9-cb3767a1.md` cause 8). Telling the model to keep
// only the asked-for columns (F30) did not change what it wrote.
//
// **So a declared schema decides what is stored, and nothing about what is
// read.** Every item the read would have tested is tested the same way: a
// condition over a helper column is rewritten to carry that column's own spec
// (`read`), which is the form a condition over a column the table does not keep
// already takes (`runtime/llm-evidence/plan-resolution/extraction/conditions.ts`),
// and the page reads it for the condition exactly as it read it for the field
// (`content/extraction/item-filter.ts`). Nothing the model chose is refused.
//
// **Why the read, and not only the schema.** Core's record capture copies each
// row by the schema, so a schema of four columns alone would have stored four --
// in the dataset and in the node's `result.extracted`, which capture replaces
// with the stored rows (`runtime/executor/record-capture.ts`). But the page's own
// account of the read, `extraction.fieldNames`, and the rejected rows it samples,
// are built from the request's field map by the page, and would go on naming
// `plus` and `ad`. Taking the helper out of the field map makes the page, the
// stored rows, the preview and the account say the same thing from the source.
//
// **A helper an ordering names stays in the read.** `sort` and `dedupe` order
// and fold rows by the columns the read keeps (`content/extraction/order-rows.ts`),
// so a read sorted by a helper would silently stop being sorted without it.
// Such a column is still read and is left out of the schema alone, so Core
// drops it from what is stored; the page's account then still names it.
//
// **Only a schema that is a subset of the field map narrows anything.** A
// schema naming a column the field map does not read says the author's names
// and the read's disagree, and which of the read's columns are helpers is then
// a guess -- a wrong one would drop a column the instruction asked for, which
// is worse than keeping one it did not. Such a schema, a schema naming no
// column, and no schema at all leave the read exactly as written. So does a
// recording's own record output, which declares every field.
//
// An excluded column (D12) is not a helper: it is never read, and the schema
// keeps declaring it so the user's exclusion is remembered.

import type { JsonObject, JsonValue } from "fluxiq/core";
import {
  webAutomationExtractListRequestValue,
  type WebAutomationExtractField,
  type WebAutomationExtractItemCondition,
  type WebAutomationExtractListRequest
} from "../../actions/extraction";

/** A read narrowed to its author's declared columns, and those columns. */
export type WebAutomationDeclaredColumnsRead = {
  /** The request the page runs: the declared columns, the helpers an ordering names, and every condition. */
  request: WebAutomationExtractListRequest;
  /** The field keys the author's schema names, which are the only kept columns stored. */
  columns: ReadonlySet<string>;
};

/**
 * The read narrowed to the columns the authored record output declares, or
 * `undefined` when nothing is to be narrowed: no schema, a schema that is not a
 * subset of the field map, or a field map with no column outside it.
 */
export function webAutomationDeclaredColumnsRead(authored: JsonValue | undefined, request: WebAutomationExtractListRequest): WebAutomationDeclaredColumnsRead | undefined {
  const columns = declaredColumns(authored, request);
  if (columns === undefined) return undefined;
  const ordering = new Set([...(request.sort ?? []).map((key) => key.field), ...(request.dedupe?.by ?? [])]);
  const helpers = Object.entries(request.fields).filter(([key, field]) => !columns.has(key) && isReadAsColumn(field));
  if (helpers.length === 0) return undefined;
  const removed = new Map(helpers.filter(([key]) => !ordering.has(key)));
  const narrowed: WebAutomationExtractListRequest = {
    ...request,
    fields: Object.fromEntries(Object.entries(request.fields).filter(([key]) => !removed.has(key))),
    ...(request.where !== undefined ? { where: request.where.map((condition) => readingItsOwnColumn(condition, removed)) } : {})
  };
  // Read back as the dispatch's own reader would, so what is sent is a request
  // the page runs. A narrowing it could not run -- every column left excluded --
  // narrows nothing.
  const sent = webAutomationExtractListRequestValue(narrowed);
  return sent === undefined ? undefined : { request: sent, columns };
}

/** The keys the authored schema names, when every one is a key of the field map. */
function declaredColumns(authored: JsonValue | undefined, request: WebAutomationExtractListRequest): ReadonlySet<string> | undefined {
  const schema = isJsonObject(authored) && isJsonObject(authored.schema) ? authored.schema : undefined;
  const fields = Array.isArray(schema?.fields) ? schema.fields : [];
  if (fields.length === 0) return undefined;
  const columns = new Set<string>();
  for (const field of fields) {
    const id = isJsonObject(field) && typeof field.id === "string" ? field.id : undefined;
    if (id === undefined || !Object.hasOwn(request.fields, id)) return undefined;
    columns.add(id);
  }
  return columns;
}

/** A field the page reads into every row: not excluded, and not asking for a handling it cannot honour. */
function isReadAsColumn(field: WebAutomationExtractField): boolean {
  return typeof field === "string" || field.handling === undefined || field.handling === "include";
}

/** The condition reading its column through that column's own spec, when the column leaves the field map. */
function readingItsOwnColumn(condition: WebAutomationExtractItemCondition, removed: ReadonlyMap<string, WebAutomationExtractField>): WebAutomationExtractItemCondition {
  const column = condition.field === undefined ? undefined : removed.get(condition.field);
  if (column === undefined) return condition;
  const { field: _field, ...says } = condition;
  return { read: conditionRead(column), ...says };
}

/**
 * The column's spec as a condition reads it. `required` says whether a row may
 * lack the column, which a condition does not ask: the page reads a condition's
 * value for itself and tests whether it is there (`item-filter.ts`).
 */
function conditionRead(column: WebAutomationExtractField): WebAutomationExtractField {
  if (typeof column === "string") return column;
  const { required: _required, ...read } = column;
  return read;
}

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
