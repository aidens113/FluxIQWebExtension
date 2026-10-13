// What each of Core's refusals of a record output is about: the field it
// refused, and the names the record output can use instead (t510, F4 and F5).
//
// Core's record-output parser returns codes only, and the dispatch used to pass
// them on as `{code}` (`./dispatch.ts`). Breadth wave 1's auction run
// (`run-mv6qrbgx-06151cdb`) was refused `record_output.process_invalid_sort`
// for writing `direction` where a sort key takes `order`, and nothing said which
// key or what it takes. t489 gave a column the read does not read the shape
// `{code, field, valid}` (`./stored-columns.ts`), which Core's trial feedback and
// the resolver's submit refusal both read; every code here that is about a
// field or a sort key now carries it too, read from the value the parser
// refused -- the record output the dispatch built, so the names are the ones
// that would have run:
//
// - `process_unknown_field` and `process_excluded_field`: each field `process`
//   names that the schema does not have, or excludes, and the ids it stores;
// - `process_where_column_dropped`: each `where` field `columns` leaves out, and
//   the columns kept;
// - `process_invalid_sort`: the key of a sort key that is wrong -- a key a sort
//   key does not take, with the ones it does (`field`, `order`, `as`); an order
//   or comparison it does not take, with the values it does; a missing field,
//   with the stored ids.
//
// Any other code, or one whose field the value does not show, stays `{code}`.
// Only names the record output itself wrote and the vocabulary's own words:
// never a cell value or page text.

import type { JsonObject, JsonValue } from "fluxiq/core";
import { WEB_AUTOMATION_EXTRACT_SORT_ORDERS, WEB_AUTOMATION_EXTRACT_SORT_TYPES } from "../../actions/extraction";
import type { WebAutomationRecordOutputIssue } from "./stored-columns";

const PROCESS_UNKNOWN_FIELD = "record_output.process_unknown_field";
const PROCESS_EXCLUDED_FIELD = "record_output.process_excluded_field";
const PROCESS_WHERE_COLUMN_DROPPED = "record_output.process_where_column_dropped";
const PROCESS_INVALID_SORT = "record_output.process_invalid_sort";

/** The keys a sort key takes (Core's `parse-processing.ts`). */
const SORT_KEY_KEYS = ["field", "order", "as"] as const;

/** Each of `codes` as the issues it says about `output`, in the order given (header). */
export function webAutomationRecordOutputIssues(codes: readonly string[], output: JsonValue): WebAutomationRecordOutputIssue[] {
  const issues: WebAutomationRecordOutputIssue[] = [];
  for (const code of codes) {
    const said = isJsonObject(output) && isJsonObject(output.process) ? fieldIssues(code, output, output.process) : [];
    issues.push(...(said.length > 0 ? said : [{ code }]));
  }
  return issues;
}

function fieldIssues(code: string, output: JsonObject, process: JsonObject): WebAutomationRecordOutputIssue[] {
  const fields = isJsonObject(output.schema) ? listed(output.schema.fields).filter(isJsonObject) : [];
  const ids = new Set(fields.flatMap((field) => typeof field.id === "string" ? [field.id] : []));
  const excluded = new Set(fields.flatMap((field) => typeof field.id === "string" && field.handling === "exclude" ? [field.id] : []));
  const stored = [...ids].filter((id) => !excluded.has(id));
  const each = (names: readonly string[], valid: readonly string[]) => [...new Set(names)].map((field) => ({ code, field, valid: [...valid] }));
  if (code === PROCESS_UNKNOWN_FIELD) return each(processNames(process).filter((name) => !ids.has(name)), stored);
  if (code === PROCESS_EXCLUDED_FIELD) return each(processNames(process).filter((name) => excluded.has(name)), stored);
  if (code === PROCESS_WHERE_COLUMN_DROPPED) {
    const columns = strings(process.columns);
    return each(listed(process.where).flatMap(fieldOf).filter((name) => ids.has(name) && !columns.includes(name)), columns);
  }
  if (code === PROCESS_INVALID_SORT) return sortIssues(process.sort, stored);
  return [];
}

/** The wrong key of each sort key, and what it takes instead (header). */
function sortIssues(sort: JsonValue | undefined, stored: readonly string[]): WebAutomationRecordOutputIssue[] {
  const code = PROCESS_INVALID_SORT;
  if (!Array.isArray(sort)) return [{ code, valid: [...SORT_KEY_KEYS] }];
  const issues: WebAutomationRecordOutputIssue[] = [];
  for (const key of sort) {
    if (!isJsonObject(key)) {
      issues.push({ code, valid: [...SORT_KEY_KEYS] });
      continue;
    }
    for (const name of Object.keys(key)) if (!(SORT_KEY_KEYS as readonly string[]).includes(name)) issues.push({ code, field: name, valid: [...SORT_KEY_KEYS] });
    if (typeof key.field !== "string") issues.push({ code, field: "field", valid: [...stored] });
    if (key.order === undefined || !(WEB_AUTOMATION_EXTRACT_SORT_ORDERS as readonly JsonValue[]).includes(key.order)) issues.push({ code, field: "order", valid: [...WEB_AUTOMATION_EXTRACT_SORT_ORDERS] });
    if (key.as !== undefined && !(WEB_AUTOMATION_EXTRACT_SORT_TYPES as readonly JsonValue[]).includes(key.as)) issues.push({ code, field: "as", valid: [...WEB_AUTOMATION_EXTRACT_SORT_TYPES] });
  }
  return issues;
}

/** Every field `process` names, as Core's parser checks them: dedupe, where, sort, then columns. */
function processNames(process: JsonObject): string[] {
  const deduped = isJsonObject(process.dedupe) ? strings(process.dedupe.by) : [];
  return [...deduped, ...listed(process.where).flatMap(fieldOf), ...listed(process.sort).flatMap(fieldOf), ...strings(process.columns)];
}

function fieldOf(entry: JsonValue): string[] {
  return isJsonObject(entry) && typeof entry.field === "string" ? [entry.field] : [];
}

function listed(value: JsonValue | undefined): JsonValue[] {
  return Array.isArray(value) ? value : [];
}

function strings(value: JsonValue | undefined): string[] {
  return listed(value).filter((entry): entry is string => typeof entry === "string");
}

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
