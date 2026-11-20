// The read a list extraction dispatches when its author declared the table's
// columns: the same items, the same conditions, the declared columns shown, the
// columns a condition or an ordering reads stored and hidden, and nothing else
// kept as a column.
//
// **Why this exists.** Live runs 11 and 12 of 2026-09-30 built a Flow for "the
// Plus earbuds under $50" whose read kept six fields -- name, price, rating and
// url, which the instruction asked for, and `plus` and `ad`, which it kept only
// to filter by (`where plus present`, `where ad absent`). The model's own
// `recordOutput.schema` named the four. The answer showed all six, because the
// field map declares the columns (`./reconciled-record-output.ts`), so every row
// had two columns the instruction never asked for and the Lab paired none of
// them (`debugs/run-muq66ff9-cb3767a1.md` cause 8). Telling the model to keep
// only the asked-for columns (F30) did not change what it wrote.
//
// **So a declared schema decides what is shown, and nothing about what is
// read.** Every item the read would have tested is tested the same way, and
// nothing the model chose is refused.
//
// **A column a condition reads is stored, hidden (t975, F3).** Until t975 a
// helper read only by the read's own `where` left the read: the condition was
// rewritten to read the column through its own spec, and the column was never
// stored. The page kept the right rows, but the rows the saved Flow stored --
// and so the rows its judge saw on every replay -- no longer carried the value
// the rows were kept for. Run `run-mwounh32-24f9bc6b` (delete-stranger-requests,
// run 22) asked for the requests with zero mutual friends, and its attempt-2
// judges could not verify the condition from the saved read's rows. Since t970
// the answer shows exactly `process.columns` while Core keeps every stored
// column, and a judge reads the stored rows
// (`fluxiq` `runtime/result-verification/result-evidence/`). So a helper a
// condition reads stays in the read under its key, stored, and the answer
// leaves it out; its condition keeps naming it by key.
//
// **A helper an ordering or the authored `process` names is stored too.**
// `sort` and `dedupe` order and fold the rows a run collects, after they are
// stored (`./record-output-process.ts`, read-list redesign C3), and so do the
// authored `process`'s `where`, `anyOf`, `compare` and the sources of its
// `derive` (t510, t970), so each column they name is a stored column. A dedupe
// over every column the read reads -- "list each once" -- names no column in
// particular: it is the whole row, Core's default over whatever is stored, so it
// pins no helper and keeps its meaning over the narrowed read by naming every
// column left. A schema field marked `handling: "exclude"` over a column the
// read reads is a helper, not a declared column.
//
// **Stored is not shown (t510).** When any helper is stored and the author wrote
// no `process.columns`, the declared columns are written there (`shown`). Which
// stored columns are hidden is read from `process.columns` when it is written,
// so the record output this builds, dispatched again with the read it came from,
// builds the same value.
//
// **A hidden column never fails a row.** A hidden column is read as optional
// (`required: false`), so the schema does not require it: a row the conditions
// keep is stored whether or not the page had the helper's value -- `where ad
// absent` keeps exactly the rows that lack it -- as it was while the helper was
// read only by its condition. A string field is optional already (`field-spec.ts`).
//
// **Only a schema that is a subset of the field map narrows anything.** A
// schema naming a column the field map does not read says the author's names
// and the read's disagree, and which of the read's columns are helpers is then
// a guess -- a wrong one would drop a column the instruction asked for, which
// is worse than keeping one it did not. Such a schema, a schema naming no
// column, and no schema at all leave the read exactly as written. So does a
// recording's own record output, which declares every field.
//
// A column the field map excludes (D12) is not a helper: it is never read, and
// the schema keeps declaring it so the user's exclusion is remembered.
//
// **A column dropped that nothing uses is named (t877).** Run
// `run-mw49972k-cebf67e5` read title and price under a schema of title alone:
// Core's build had declared the instruction's column list, which its reader cut
// short at "title" ("columns title and price exactly as the shop shows them").
// Price left the read, and the answer lost it with `ok: true` and no word
// anywhere. A helper no condition, ordering or `process` reads still leaves the
// read -- a read of a detected list carries every column the detector found,
// and storing them all would fill the dataset and the judge's evidence with
// columns nothing asked for -- and each is handed back as `dropped`, so the
// caller can say so.

import type { JsonObject, JsonValue } from "fluxiq/core";
import {
  webAutomationExtractListRequestValue,
  type WebAutomationExtractField,
  type WebAutomationExtractListRequest
} from "../../actions/extraction";
import { webAutomationRecordOutputProcessOfRead } from "./record-output-process";

/** A read narrowed to its author's declared columns and the helpers something reads, and those columns. */
export type WebAutomationDeclaredColumnsRead = {
  /** The request the page runs: the declared columns, the helpers something reads (each hidden one optional), and every condition. */
  request: WebAutomationExtractListRequest;
  /** The kept columns stored: the field keys the author's schema declares, and the helpers a condition, an ordering or the authored `process` names. */
  columns: ReadonlySet<string>;
  /** The answer's columns, for `process.columns`, when a helper is stored and the author wrote no `process.columns`: the declared columns (header). */
  shown?: string[];
  /** The stored columns the answer does not show, in field-map order (header, t975). */
  hidden: string[];
  /** The read's columns this narrowing drops, none of which anything reads, in field-map order (header, t877). */
  dropped: string[];
};

/**
 * The read narrowed to the columns the authored record output declares and the
 * helpers something reads, or `undefined` when nothing changes: no schema, a
 * schema that is not a subset of the field map, or a read with no column to
 * drop or hide.
 */
export function webAutomationDeclaredColumnsRead(authored: JsonValue | undefined, request: WebAutomationExtractListRequest): WebAutomationDeclaredColumnsRead | undefined {
  const declared = declaredColumns(authored, request);
  if (declared === undefined) return undefined;
  const wholeRow = webAutomationRecordOutputProcessOfRead(request).wholeRowDedupe;
  const process = authoredProcess(authored);
  const used = new Set([
    ...(request.sort ?? []).map((key) => key.field),
    ...(wholeRow ? [] : request.dedupe?.by ?? []),
    ...(request.where ?? []).flatMap((condition) => condition.field === undefined ? [] : [condition.field]),
    ...process.names
  ]);
  const helpers = Object.entries(request.fields).filter(([key, field]) => !declared.has(key) && isReadAsColumn(field)).map(([key]) => key);
  const removed = new Set(helpers.filter((key) => !used.has(key)));
  const stored = new Set([...declared, ...helpers.filter((key) => !removed.has(key))]);
  // The answer's columns: the author's, or the declared columns this writes for them.
  const answer = new Set(process.columns ?? declared);
  const hidden = Object.keys(request.fields).filter((key) => stored.has(key) && !answer.has(key) && isReadAsColumn(request.fields[key]!));
  if (removed.size === 0 && hidden.length === 0) return undefined;
  const optional = new Set(hidden);
  const narrowed: WebAutomationExtractListRequest = {
    ...request,
    fields: Object.fromEntries(Object.entries(request.fields)
      .filter(([key]) => !removed.has(key))
      .map(([key, field]) => [key, optional.has(key) ? readAsOptional(field) : field])),
    ...(wholeRow && request.dedupe !== undefined ? { dedupe: { by: request.dedupe.by.filter((key) => !removed.has(key)) } } : {})
  };
  // Read back as the dispatch's own reader would, so what is sent is a request
  // the page runs. A narrowing it could not run -- every column left excluded --
  // narrows nothing.
  const sent = webAutomationExtractListRequestValue(narrowed);
  if (sent === undefined) return undefined;
  const dropped = [...removed];
  const writesColumns = process.columns === undefined && process.columnsUnwritten && stored.size > declared.size;
  return { request: sent, columns: stored, ...(writesColumns ? { shown: [...declared] } : {}), hidden, dropped };
}

/**
 * The keys the authored schema declares, in its order, when every one is a key
 * of the field map. A field it marks `handling: "exclude"` over a column the
 * read reads is not declared: it is a helper (header). A schema that declares
 * no column narrows nothing.
 */
function declaredColumns(authored: JsonValue | undefined, request: WebAutomationExtractListRequest): ReadonlySet<string> | undefined {
  const schema = isJsonObject(authored) && isJsonObject(authored.schema) ? authored.schema : undefined;
  const fields = Array.isArray(schema?.fields) ? schema.fields : [];
  if (fields.length === 0) return undefined;
  const columns = new Set<string>();
  for (const field of fields) {
    const id = isJsonObject(field) && typeof field.id === "string" ? field.id : undefined;
    if (id === undefined || !Object.hasOwn(request.fields, id)) return undefined;
    if (isJsonObject(field) && field.handling === "exclude" && isReadAsColumn(request.fields[id]!)) continue;
    columns.add(id);
  }
  return columns.size > 0 ? columns : undefined;
}

/**
 * What the authored `process` says about columns: every field it names, which
 * it runs over the stored rows -- its sort's, dedupe's, `where`'s, `anyOf`'s,
 * `compare`'s (both sides) and the sources of its `derive` (t970) -- its
 * `columns` when it wrote them, and whether it left `columns` for this read to
 * write. A `process` that is not an object is Core's parser's to refuse, and
 * nothing is written into it.
 */
function authoredProcess(authored: JsonValue | undefined): { names: string[]; columns?: string[]; columnsUnwritten: boolean } {
  const process = isJsonObject(authored) ? authored.process : undefined;
  if (process === undefined) return { names: [], columnsUnwritten: true };
  if (!isJsonObject(process)) return { names: [], columnsUnwritten: false };
  const fieldOf = (entry: JsonValue) => isJsonObject(entry) && typeof entry.field === "string" ? [entry.field] : [];
  const filtered = listed(process.where).flatMap(fieldOf);
  const grouped = listed(process.anyOf).flatMap((group) => listed(group).flatMap(fieldOf));
  const compared = listed(process.compare).flatMap((entry) => isJsonObject(entry) ? [...fieldOf(entry), ...COMPARISONS.flatMap((key) => typeof entry[key] === "string" ? [entry[key] as string] : [])] : []);
  const derivedFrom = listed(process.derive).flatMap((entry) => isJsonObject(entry) && typeof entry.from === "string" ? [entry.from] : []);
  const sorted = listed(process.sort).flatMap(fieldOf);
  const deduped = isJsonObject(process.dedupe) ? strings(process.dedupe.by) : [];
  const columns = Array.isArray(process.columns) ? strings(process.columns) : undefined;
  return {
    names: [...sorted, ...deduped, ...filtered, ...grouped, ...compared, ...derivedFrom, ...(columns ?? [])],
    ...(columns === undefined ? {} : { columns }),
    columnsUnwritten: !Object.hasOwn(process, "columns")
  };
}

/** The keys a Core `compare` names its other column under (t970). */
const COMPARISONS = ["atLeast", "atMost", "lessThan", "greaterThan", "equals"] as const;

function listed(value: JsonValue | undefined): JsonValue[] {
  return Array.isArray(value) ? value : [];
}

function strings(value: JsonValue | undefined): string[] {
  return listed(value).filter((entry): entry is string => typeof entry === "string");
}

/** A field the page reads into every row: not excluded, and not asking for a handling it cannot honour. */
function isReadAsColumn(field: WebAutomationExtractField): boolean {
  return typeof field === "string" || field.handling === undefined || field.handling === "include";
}

/** A hidden column as the page reads it: optional, so a row never fails for lacking it (header). A string field already is. */
function readAsOptional(field: WebAutomationExtractField): WebAutomationExtractField {
  return typeof field === "string" || field.required === false ? field : { ...field, required: false };
}

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
