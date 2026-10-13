// Which of a list read's columns a record output stores, under which names:
// one answer, read by the plan resolver at submit and by this node's dispatch
// at run time (t489).
//
// **Why this exists.** Lane D round 13 (`run-mv66sc3c-c47e74b8`) read the
// friend requests as `extractList: extraction.4`, a detected list whose columns
// are the detector's keys (`div_x0531l50_..._a_x0ybvghy_...`), and named its
// own columns in the record output: schema ids `name` and `mutualFriends`, and
// a `process` over them. Submit checked the record output as written and passed
// it. The dispatch then put the field map's schema in place of the author's
// (`./reconciled-record-output.ts`), so the stored ids were the detector's keys,
// the `process` named fields nothing stored, and Core refused it
// (`record_output.process_unknown_field`, not retryable) on the last step of
// every trial. When the model wrote the detector's keys instead, submit refused
// those. Two readers of one value disagreed, and the model was caught between
// them until the build gave up.
//
// **So a name the record output gives a column the read reads becomes that
// column.** Every name it writes -- a schema field's `id`, and each field a
// `process` names in `columns`, `where`, `sort` and `dedupe.by` -- is looked up
// among the read's own columns:
//
// - a key of the read's field map is that column, as it always was;
// - any other name is matched by the extraction node's column matcher
//   (`./column-match.ts`), every strict reading (the key in another casing, a
//   table header) before any guess, and a guess only among the columns no
//   strict reading took -- the order the resolver reads `fields` in, for the
//   same reason: a guess must never take a column from a name written exactly.
//   The column is then **renamed** in the read to the author's name -- in its
//   field map and in every `where`, `sort` and `dedupe` of the read that names
//   it -- which is exactly what `fields: {name: "<key>"}` would have said;
// - a name no column answers to is refused, naming it and listing the read's
//   columns, so the model can correct it in one step.
//
// The resolver calls this at submit and writes the renamed read into the Flow,
// so the read a Flow saves already holds the author's names and the dispatch's
// call finds every name exact. The dispatch calls it again for a Flow saved
// before t489, a literal read and a recording -- whose schema ids are its field
// keys, so nothing changes for one. Because both read through this one
// function, a name submit accepts is a name the dispatch stores, and one submit
// refuses the dispatch refuses too.
//
// **One issue shape on both sides.** A name the read does not read is said as
// `{code: "record_output.column_not_read", field, valid}` -- the name the
// record output wrote, and the read's column keys it can use instead
// (`webAutomationStoredColumnIssues`). The dispatch puts exactly these in its
// `outputs.error.issues`, which Core's trial feedback reads
// (`service/candidate-trial/step-issues.ts`), and the resolver derives its
// submit refusal from the same entries. Only names and keys: never a cell
// value or any page text.
//
// A renamed read keeps its author's name only where the name could be a field
// key at all (`isWebAutomationExtractFieldKey`); a name that could not be one is
// refused as unread rather than stored under a key it is not.

import type { JsonObject, JsonValue } from "fluxiq/core";
import {
  isWebAutomationExtractFieldKey,
  type WebAutomationExtractField,
  type WebAutomationExtractListRequest
} from "../../actions/extraction";
import { webExtractionMatchedColumn } from "./column-match";

/** A position inside the record output, key by key and index by index. */
export type WebAutomationStoredColumnPath = Array<string | number>;

/** One name the record output writes for a column, and the first place it is written. */
export type WebAutomationStoredColumnName = { written: string; path: WebAutomationStoredColumnPath };

/** A name that found its column by something other than the key verbatim, as `./column-match.ts` found it. */
export type WebAutomationStoredColumnGuess = WebAutomationStoredColumnName & { field: string; how: "normalized" | "nearest"; score: number };

/** One issue a record output's node gives, in the shape Core's trial feedback reads: a code, the field it refused, and the names it can use instead. */
export type WebAutomationRecordOutputIssue = { code: string; field?: string; valid?: string[] };

/** The issue a record output naming a column its read does not read carries. */
const COLUMN_NOT_READ = "record_output.column_not_read";
/** Core's issue for a `process` naming a field the stored schema does not hold. */
const PROCESS_UNKNOWN_FIELD = "record_output.process_unknown_field";

export type WebAutomationStoredColumns =
  /** `request` is the read with each matched column under the author's name; `renamed` says whether any was. */
  | { ok: true; request: WebAutomationExtractListRequest; renamed: boolean; assumed: WebAutomationStoredColumnGuess[] }
  /** `unread` names no column of the read; `columns` are the read's own, in its order. */
  | { ok: false; unread: WebAutomationStoredColumnName[]; columns: string[] };

/**
 * The read `request` with every column the record output names under the
 * author's name, or the names it reads no column for (header). A record output
 * that is absent, or names nothing, leaves the read as it is.
 */
export function webAutomationStoredColumns(recordOutput: JsonValue | undefined, request: WebAutomationExtractListRequest): WebAutomationStoredColumns {
  const names = recordOutputNames(recordOutput);
  const pending = names.filter((name) => !Object.hasOwn(request.fields, name.written));
  if (pending.length === 0) return { ok: true, request, renamed: false, assumed: [] };
  const taken = new Set(names.filter((name) => Object.hasOwn(request.fields, name.written)).map((name) => name.written));
  const found = new Map<string, WebAutomationStoredColumnGuess>();
  // Every strict reading first, then the guesses, each among the columns left.
  for (const guess of [false, true]) {
    for (const name of pending) {
      if (found.has(name.written) || !isWebAutomationExtractFieldKey(name.written)) continue;
      const left = Object.fromEntries(Object.entries(request.fields).filter(([key]) => !taken.has(key)));
      const match = webExtractionMatchedColumn(name.written, left, { headerOnly: false, wanted: undefined });
      if (match === undefined || (match.how === "nearest" && !guess)) continue;
      taken.add(match.key);
      // A name equal to a table header is that column by name, which is a spelling of it rather than a guess.
      found.set(name.written, { written: name.written, path: name.path, field: match.key, how: match.how === "exact" ? "normalized" : match.how, score: match.score });
    }
  }
  const unread = pending.filter((name) => !found.has(name.written));
  if (unread.length > 0) return { ok: false, unread, columns: Object.keys(request.fields) };
  const assumed = [...found.values()];
  return { ok: true, request: renamed(request, new Map(assumed.map((entry) => [entry.field, entry.written]))), renamed: true, assumed };
}

/**
 * The issues a refusal of `unread` says (header): each name as
 * `record_output.column_not_read` with the read's column keys as `valid`, and a
 * name a `process` wrote also as Core's own `record_output.process_unknown_field`,
 * with the same keys (t510: every record-output refusal carries `valid`).
 */
export function webAutomationStoredColumnIssues(unread: readonly WebAutomationStoredColumnName[], columns: readonly string[]): WebAutomationRecordOutputIssue[] {
  const issues: WebAutomationRecordOutputIssue[] = unread.map((name) => ({ code: COLUMN_NOT_READ, field: name.written, valid: [...columns] }));
  for (const name of unread) if (name.path[0] === "process") issues.push({ code: PROCESS_UNKNOWN_FIELD, field: name.written, valid: [...columns] });
  return issues;
}

/** Every distinct name the record output writes for a column, in the order it is written: the schema first, then `process`. */
function recordOutputNames(recordOutput: JsonValue | undefined): WebAutomationStoredColumnName[] {
  if (!isJsonObject(recordOutput)) return [];
  const names = new Map<string, WebAutomationStoredColumnName>();
  const add = (written: JsonValue | undefined, path: WebAutomationStoredColumnPath) => {
    if (typeof written === "string" && written.trim() !== "" && !names.has(written)) names.set(written, { written, path });
  };
  const schema = recordOutput.schema;
  if (isJsonObject(schema) && Array.isArray(schema.fields)) {
    for (const [index, field] of schema.fields.entries()) if (isJsonObject(field)) add(field.id, ["schema", "fields", index, "id"]);
  }
  const process = recordOutput.process;
  if (!isJsonObject(process)) return [...names.values()];
  for (const [index, column] of listed(process.columns)) add(column, ["process", "columns", index]);
  for (const [index, condition] of listed(process.where)) if (isJsonObject(condition)) add(condition.field, ["process", "where", index, "field"]);
  for (const [index, key] of listed(process.sort)) if (isJsonObject(key)) add(key.field, ["process", "sort", index, "field"]);
  if (isJsonObject(process.dedupe)) for (const [index, by] of listed(process.dedupe.by)) add(by, ["process", "dedupe", "by", index]);
  return [...names.values()];
}

/** The read with each column of `names` (field key to author's name) under its new name, everywhere the read names it. */
function renamed(request: WebAutomationExtractListRequest, names: ReadonlyMap<string, string>): WebAutomationExtractListRequest {
  const name = (key: string) => names.get(key) ?? key;
  const fields: Record<string, WebAutomationExtractField> = {};
  for (const [key, field] of Object.entries(request.fields)) fields[name(key)] = field;
  const read: WebAutomationExtractListRequest = { ...request, fields };
  if (request.where !== undefined) read.where = request.where.map((condition) => condition.field === undefined ? condition : { ...condition, field: name(condition.field) });
  if (request.sort !== undefined) read.sort = request.sort.map((key) => ({ ...key, field: name(key.field) }));
  if (request.dedupe !== undefined) read.dedupe = { by: request.dedupe.by.map(name) };
  return read;
}

function listed(value: JsonValue | undefined): Array<[number, JsonValue]> {
  return Array.isArray(value) ? [...value.entries()] : [];
}

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
