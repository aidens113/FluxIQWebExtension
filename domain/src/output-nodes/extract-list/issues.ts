// Why an `extractList` value would be refused, said before the Flow runs.
//
// The dispatch reader (`webAutomationExtractListRequestWhole`) answers with a
// request or with nothing, which is right for dispatch and useless to an author:
// a model that wrote a malformed extraction learns only that it failed, at run
// time. This names the part that is wrong, so a plan can be refused when it is
// validated and repaired from the code.
//
// **The reader stays the judge.** Each part is checked by handing the reader a
// request that is well formed except for that part, so a code here means the
// reader refuses or drops that part, and the rules are written once. A value the
// reader refuses always has at least one code: if no part explains the refusal,
// `web.extract_list.unreadable` does.
//
// **This file is where the strictness went.** The reader used to refuse a whole
// request over one unreadable `paginate`, `minItems`, `itemElement` or
// condition, and on 2026-09-26 it stopped: at dispatch there is nobody left to
// repair the request, and a refusal there is an extraction that returns no rows
// at all, which is the failure that dominated the everything-store rung. The
// fault is still named here, at the moment an author can act on it, by asking
// for the request **whole or not at all** (`webAutomationExtractListRequestWhole`)
// rather than for whatever survived. So the codes are exactly what they were, one
// rule still written once, and the tolerance applies only where a name would
// reach no one.
//
// A `field` the reader resolved to a near-miss column is deliberately **not** an
// issue. It is an assumption rather than a fault, and refusing the plan for it
// would undo the resolution it exists to make.
//
// **It is stricter than the reader in three ways, all on purpose.** A key the
// request schema does not declare is refused, where the reader ignores it: a
// `pagination` meant as `paginate` would otherwise read one page and report
// success. A `maxItems` that is not a positive integer is refused, where the
// reader drops it and reads up to its bound. And a `minItems` above the maximum
// is refused, where the reader drops it and applies the default of 1 -- which
// every maximum admits, since a maximum is a positive integer. The allowed keys
// come from the schema (`actions/extraction/schema.ts`), so they cannot drift
// from it; a frame key is one of the undeclared ones, since the frame is the
// command's.

import type { JsonObject, JsonValue } from "fluxiq/core";
import {
  isWebAutomationExtractFieldKey,
  webAutomationExtractListRequestWhole,
  webAutomationExtractListSchema
} from "../../actions/extraction";

export type WebAutomationExtractListIssueCode =
  | "web.extract_list.not_object"
  | "web.extract_list.unknown_key"
  | "web.extract_list.invalid_item"
  | "web.extract_list.invalid_item_element"
  | "web.extract_list.invalid_fields"
  | "web.extract_list.no_fields"
  | "web.extract_list.invalid_field_key"
  | "web.extract_list.invalid_field"
  | "web.extract_list.unknown_field_key"
  | "web.extract_list.all_fields_excluded"
  | "web.extract_list.invalid_paginate"
  | "web.extract_list.unknown_paginate_key"
  | "web.extract_list.invalid_where"
  | "web.extract_list.invalid_dedupe"
  | "web.extract_list.invalid_sort"
  | "web.extract_list.invalid_max_items"
  | "web.extract_list.invalid_min_items"
  | "web.extract_list.min_items_exceed_max"
  | "web.extract_list.unreadable";

type IssueSet = Set<WebAutomationExtractListIssueCode>;

/** A request the reader accepts, which each check overrides in one part. */
const PROBE_REQUEST = { item: "*", fields: { probe: "*" } } as const;

/** The issue codes for `value` as an `extractList`, each once, or none when it is a request the page can run. */
export function webAutomationExtractListIssues(value: unknown): WebAutomationExtractListIssueCode[] {
  if (!isPlainObject(value)) return ["web.extract_list.not_object"];
  const keys = declaredKeys();
  const issues: IssueSet = new Set();
  if (Object.keys(value).some((key) => !keys.request.has(key))) issues.add("web.extract_list.unknown_key");
  if (!readable({ item: value.item ?? null })) issues.add("web.extract_list.invalid_item");
  if (value.itemElement !== undefined && !readable({ itemElement: value.itemElement })) issues.add("web.extract_list.invalid_item_element");
  addFieldIssues(value.fields, keys.fieldSpec, issues);
  addPaginateIssues(value.paginate, keys.paginate, issues);
  // One code, not two: the reader refuses a condition carrying a key it does
  // not know, so an unknown key is already an unreadable `where`.
  //
  // The probe keeps the request's own `fields`, because a condition naming one
  // of them by `field` is read against them and cannot be read against the
  // probe's. Without them, every literal `where: [{field: "price", lessThan:
  // 50}]` -- the shape a model writes when the instruction says "under $50" --
  // was refused `invalid_where` for naming a column the probe does not have,
  // while the page would have run the request as written. A `fields` the
  // reader refuses carries its own code already, so the probe keeps its own
  // rather than reporting one fault twice.
  if (value.where !== undefined && !readable({ ...conditionFields(value.fields), where: value.where })) issues.add("web.extract_list.invalid_where");
  // `dedupe` and `sort` are read against the request's own fields for the same
  // reason, since each names its columns by key.
  if (value.dedupe !== undefined && !readable({ ...conditionFields(value.fields), dedupe: value.dedupe })) issues.add("web.extract_list.invalid_dedupe");
  if (value.sort !== undefined && !readable({ ...conditionFields(value.fields), sort: value.sort })) issues.add("web.extract_list.invalid_sort");
  addItemBoundIssues(value, issues);
  if (issues.size === 0 && webAutomationExtractListRequestWhole(value) === undefined) issues.add("web.extract_list.unreadable");
  return [...issues];
}

function addFieldIssues(fields: JsonValue | undefined, specKeys: ReadonlySet<string>, issues: IssueSet): void {
  if (!isPlainObject(fields)) {
    issues.add("web.extract_list.invalid_fields");
    return;
  }
  const entries = Object.entries(fields);
  if (entries.length === 0) {
    issues.add("web.extract_list.no_fields");
    return;
  }
  let fieldRefused = false;
  for (const [key, field] of entries) {
    if (isPlainObject(field) && Object.keys(field).some((specKey) => !specKeys.has(specKey))) issues.add("web.extract_list.unknown_field_key");
    if (!isWebAutomationExtractFieldKey(key)) {
      issues.add("web.extract_list.invalid_field_key");
      fieldRefused = true;
    // A readable companion field keeps an excluded field from being refused as
    // the only one, so only the field itself is judged.
    } else if (!readable({ fields: { [key]: field, [key === "probe" ? "probe_2" : "probe"]: "*" } })) {
      issues.add("web.extract_list.invalid_field");
      fieldRefused = true;
    }
  }
  // Every field reads on its own, so the map is refused as a whole only because
  // it keeps no column.
  if (!fieldRefused && !readable({ fields })) issues.add("web.extract_list.all_fields_excluded");
}

function addPaginateIssues(paginate: JsonValue | undefined, paginateKeys: ReadonlySet<string>, issues: IssueSet): void {
  if (paginate === undefined) return;
  if (isPlainObject(paginate) && Object.keys(paginate).some((key) => !paginateKeys.has(key))) issues.add("web.extract_list.unknown_paginate_key");
  if (!readable({ paginate })) issues.add("web.extract_list.invalid_paginate");
}

function addItemBoundIssues(value: JsonObject, issues: IssueSet): void {
  const { maxItems, minItems } = value;
  const maxItemsReadable = maxItems === undefined || isPositiveInteger(maxItems);
  if (!maxItemsReadable) issues.add("web.extract_list.invalid_max_items");
  if (minItems === undefined) return;
  if (!isNonNegativeInteger(minItems)) {
    issues.add("web.extract_list.invalid_min_items");
    return;
  }
  // The reader holds the minimum to the maximum named, or to its bound.
  if (!readable(maxItemsReadable && maxItems !== undefined ? { minItems, maxItems } : { minItems })) issues.add("web.extract_list.min_items_exceed_max");
}

/**
 * Whether the reader reads the probe **without dropping any of it**. A dropped
 * part is a fault an author can still repair, so it is a code here even though
 * the reader would run the request without it; a part the reader *resolved* --
 * a condition's near-miss column -- leaves `dropped` empty and is no code at all.
 */
function readable(overrides: JsonObject): boolean {
  return webAutomationExtractListRequestWhole({ ...PROBE_REQUEST, ...overrides }) !== undefined;
}

/** The request's own fields for a `where` probe to read `field` conditions against, or none when the reader refuses them. */
function conditionFields(fields: JsonValue | undefined): JsonObject {
  return fields !== undefined && readable({ fields }) ? { fields } : {};
}

type DeclaredKeys = { request: ReadonlySet<string>; paginate: ReadonlySet<string>; fieldSpec: ReadonlySet<string> };

let declared: DeclaredKeys | undefined;

/** The keys the request schema declares, read once and on first use rather than while modules load. */
function declaredKeys(): DeclaredKeys {
  if (declared) return declared;
  const schema = webAutomationExtractListSchema({});
  const properties = child(schema, "properties");
  declared = {
    request: propertyNames(schema),
    paginate: propertyNames(child(properties, "paginate")),
    fieldSpec: propertyNames(child(child(child(properties, "fields"), "metadata"), "fieldSpec"))
  };
  return declared;
}

function propertyNames(schema: JsonObject | undefined): ReadonlySet<string> {
  return new Set(Object.keys(child(schema, "properties") ?? {}));
}

function child(value: JsonObject | undefined, key: string): JsonObject | undefined {
  const next = value?.[key];
  return isPlainObject(next) ? next : undefined;
}

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: JsonValue): boolean {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isNonNegativeInteger(value: JsonValue): boolean {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
