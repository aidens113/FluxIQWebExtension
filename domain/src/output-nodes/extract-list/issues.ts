// Why an `extractList` value would be refused, said before the Flow runs.
//
// The dispatch reader (`webAutomationExtractListRequestValue`) answers with a
// request or with nothing, which is right for dispatch and useless to an author:
// a model that wrote a malformed extraction learns only that it failed, at run
// time. This names the part that is wrong, so a plan can be refused when it is
// validated and repaired from the code.
//
// **The reader stays the judge.** Each part is checked by handing the reader a
// request that is well formed except for that part, so a code here means the
// reader refuses that part, and the rules are written once. A value the reader
// refuses always has at least one code: if no part explains the refusal,
// `web.extract_list.unreadable` does.
//
// **It is stricter than the reader in two ways, both on purpose.** A key the
// request schema does not declare is refused, where the reader ignores it: a
// `pagination` meant as `paginate` would otherwise read one page and report
// success. And a `maxItems` that is not a positive integer is refused, where the
// reader drops it and reads up to its bound. The allowed keys come from the
// schema (`actions/extraction/schema.ts`), so they cannot drift from it; a
// frame key is one of the undeclared ones, since the frame is the command's.

import type { JsonObject, JsonValue } from "fluxiq/core";
import {
  isWebAutomationExtractFieldKey,
  webAutomationExtractListRequestValue,
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
  if (value.where !== undefined && !readable({ where: value.where })) issues.add("web.extract_list.invalid_where");
  addItemBoundIssues(value, issues);
  if (issues.size === 0 && webAutomationExtractListRequestValue(value) === undefined) issues.add("web.extract_list.unreadable");
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

function readable(overrides: JsonObject): boolean {
  return webAutomationExtractListRequestValue({ ...PROBE_REQUEST, ...overrides }) !== undefined;
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
