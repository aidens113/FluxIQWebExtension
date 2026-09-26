import { RUN_EXTRACTION_LIST_PRESENCE, RUN_EXTRACTION_READ_BOUNDS, type RunExtractionConditionReport, type RunExtractionRead } from "./read.js";
import { add, array, enumeration, finite, keys, object, result, uniqueStrings, type JsonObject } from "../runtime-validation.js";
import type { ValidationIssue, ValidationResult } from "../validation.js";

const readKeys = ["recordCount", "pagesRead", "truncated", "fieldNames", "missingFields", "listPresence", "conditions"] as const satisfies readonly (keyof RunExtractionRead)[];
const conditionKeys = ["applied", "kept", "rejected", "unfiltered"] as const satisfies readonly (keyof RunExtractionConditionReport)[];

/**
 * Whether `input` is a record field key this contract will publish: Core's own
 * field-id shape, which admits letters, digits, `_` and `-` and so cannot hold
 * a space — and therefore cannot hold page text, a selector, a URL or a
 * sentence. Exported so a reader can decide **before** building a record
 * whether a key may travel, rather than only finding out when the whole record
 * is refused.
 */
export function isRunExtractionFieldKey(input: unknown): input is string {
  const reserved: readonly string[] = RUN_EXTRACTION_READ_BOUNDS.reservedFieldKeys;
  return typeof input === "string" && RUN_EXTRACTION_READ_BOUNDS.fieldKeyPattern.test(input) && !reserved.includes(input);
}

/**
 * Validates a `RunExtractionRead` — one list read's account of itself, as the
 * Flow lane publishes it on an extract attempt and beside a judged step's
 * comparison.
 *
 * Every member is a count, a boolean, a closed word or a field key, and the
 * field key is the only one with any room in it, so its shape is the whole
 * boundary: it refuses a space, which is what keeps a selector, a page value or
 * a model's sentence out of the bundle.
 *
 * Three relations are checked beyond the shapes, each because the record is
 * unreadable without it. `missingFields` must name the read's own fields, or it
 * is naming something the request never asked for. `kept` cannot exceed
 * `applied`, because a read cannot have kept more items than it looked at. And
 * a condition report may not sit on a read that declares no conditions in it —
 * `rejected` is positional, so an empty list means a report of nothing.
 */
export function validateRunExtractionRead(input: unknown): ValidationResult<RunExtractionRead> {
  const issues: ValidationIssue[] = []; const value = object(input, "$", issues);
  if (value) {
    keys(value, readKeys, "$", issues);
    finite(value.recordCount, "$.recordCount", issues, 0, Number.MAX_SAFE_INTEGER, true);
    finite(value.pagesRead, "$.pagesRead", issues, 0, Number.MAX_SAFE_INTEGER, true);
    if (typeof value.truncated !== "boolean") add(issues, "$.truncated", "must be a boolean");
    checkFieldKeys(value.fieldNames, "$.fieldNames", issues);
    checkFieldKeys(value.missingFields, "$.missingFields", issues);
    if (Array.isArray(value.fieldNames) && Array.isArray(value.missingFields)) {
      const declared = new Set(value.fieldNames);
      const undeclared = value.missingFields.filter((key) => !declared.has(key));
      if (undeclared.length > 0) add(issues, "$.missingFields", "must name only fields the read declared in fieldNames");
    }
    // Absent for a read that waited for no list of its own; one of two words
    // otherwise. A word this contract does not know is a producer saying
    // something about the read that nothing downstream can act on.
    if (value.listPresence !== undefined) enumeration(value.listPresence, RUN_EXTRACTION_LIST_PRESENCE, "$.listPresence", issues);
    if (value.conditions !== undefined) checkConditions(value.conditions, "$.conditions", issues);
  }
  return result<RunExtractionRead>(input, issues);
}

function checkFieldKeys(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!Array.isArray(value)) { add(issues, path, "must be an array"); return; }
  if (value.length > RUN_EXTRACTION_READ_BOUNDS.maxFields) add(issues, path, `must hold at most ${RUN_EXTRACTION_READ_BOUNDS.maxFields} field keys`);
  array(value, path, issues, (entry, at, found) => {
    if (!isRunExtractionFieldKey(entry)) add(found, at, "must be a record field key of letters, digits, _ and -");
  });
  uniqueStrings(value, path, issues, "field keys");
}

function checkConditions(value: unknown, path: string, issues: ValidationIssue[]): void {
  const report = object(value, path, issues) as JsonObject | undefined;
  if (!report) return;
  keys(report, conditionKeys, path, issues);
  finite(report.applied, `${path}.applied`, issues, 0, Number.MAX_SAFE_INTEGER, true);
  finite(report.kept, `${path}.kept`, issues, 0, Number.MAX_SAFE_INTEGER, true);
  if (typeof report.unfiltered !== "boolean") add(issues, `${path}.unfiltered`, "must be a boolean");
  if (typeof report.applied === "number" && typeof report.kept === "number" && report.kept > report.applied) {
    add(issues, `${path}.kept`, "must not exceed the items the conditions were applied to");
  }
  if (!Array.isArray(report.rejected)) { add(issues, `${path}.rejected`, "must be an array"); return; }
  if (report.rejected.length === 0) add(issues, `${path}.rejected`, "must hold one rejection count per condition, so a report of no conditions is no report");
  if (report.rejected.length > RUN_EXTRACTION_READ_BOUNDS.maxConditions) add(issues, `${path}.rejected`, `must hold at most ${RUN_EXTRACTION_READ_BOUNDS.maxConditions} rejection counts`);
  array(report.rejected, `${path}.rejected`, issues, (entry, at, found) => finite(entry, at, found, 0, Number.MAX_SAFE_INTEGER, true));
}
