// Which detected columns a plan keeps from a detected list, and under which key.
//
// The detection showed the model each column's `key` (and, for a table, its
// header as the label), never a selector. So a field of a handle-named list can
// only name a detected column, and every way of naming one that has a single
// reading is taken (`./slot.ts` says where the list itself is named):
//
// - `fields` as `{ yourKey: column }`, the documented direction; an entry whose
//   value names no column but whose key does, and whose value is a key, is the
//   same map written the other way round and is read so;
// - `fields` as an array of columns, kept under their detected keys, and
//   `columns` as another name for `fields`;
// - a column as `"detectedKey"`, the key in another case when only one key
//   matches, `"column:Header"` or a bare header for one table column, and any of
//   those with `@attr` to read that column element's attribute as the page
//   writes it;
// - a column as an object naming it by `key`, `field` or `column`, or a table
//   column by `header`, with optional `attribute`, `required`, the list's handle
//   reference, and a `kind` only when it is the kind that will be read.
//
// Anything else -- a selector, a kind that reads something else, a column the
// detection did not show or that two columns answer to -- is refused, with the
// position it was refused at.

import {
  isWebAutomationExtractFieldKey,
  type WebAutomationExtractField,
  type WebAutomationExtractFieldSpec
} from "../../../../actions/extraction";
import { present } from "../../present";
import { isJsonRecord } from "../../untrusted-json";
import type { WebPlanValuePath } from "../handle-tokens";

export type WebExtractionColumnIssue = "web.handle.malformed" | "web.handle.ambiguous" | "web.handle.unknown_field";

export type WebExtractionColumns =
  | { ok: true; fields: Record<string, WebAutomationExtractField> }
  | { ok: false; issue: WebExtractionColumnIssue; path: WebPlanValuePath };

type Detected = Record<string, WebAutomationExtractField>;

/** One detected column a plan named, with the detected key it was found under, or why it named none. */
export type WebExtractionColumn = { ok: true; key: string; field: WebAutomationExtractField } | { ok: false; issue: WebExtractionColumnIssue; path: WebPlanValuePath };

type Column = WebExtractionColumn;

/** The keys a column object may carry beside the ones that name its column. */
const COLUMN_OBJECT_KEYS: ReadonlySet<string> = new Set(["handle", "location", "key", "field", "column", "header", "attribute", "required", "kind"]);
const COLUMN_NAME_KEYS = ["key", "field", "column"] as const;
/** An HTML attribute name, as a plan may name one after `@`. */
const ATTRIBUTE_NAME = /^[A-Za-z_][A-Za-z0-9_.:-]{0,99}$/u;
const HEADER_PREFIX = "column:";

/** The columns `fields` keeps, every detected one when it is absent. `path` is where `fields` itself is. */
export function keptWebExtractionColumns(fields: unknown, detected: Detected, path: WebPlanValuePath): WebExtractionColumns {
  if (fields === undefined) return { ok: true, fields: structuredClone(detected) };
  const kept: Record<string, WebAutomationExtractField> = {};
  const keep = (key: string, field: WebAutomationExtractField, at: WebPlanValuePath): WebExtractionColumns | undefined => {
    if (Object.hasOwn(kept, key)) return { ok: false, issue: "web.handle.malformed", path: at };
    kept[key] = field;
    return undefined;
  };
  if (Array.isArray(fields)) {
    if (fields.length === 0) return { ok: false, issue: "web.handle.malformed", path };
    for (const [index, entry] of fields.entries()) {
      const column = readColumn(entry, undefined, detected, [...path, index]);
      if (!column.ok) return column;
      const refused = keep(column.key, column.field, [...path, index]);
      if (refused) return refused;
    }
    return { ok: true, fields: kept };
  }
  if (!isJsonRecord(fields) || Object.keys(fields).length === 0) return { ok: false, issue: "web.handle.malformed", path };
  for (const [key, entry] of Object.entries(fields)) {
    const at = [...path, key];
    let column = readColumn(entry, key, detected, at);
    let written = key;
    // Written the other way round: the key is the column, the value the name to keep it under.
    if (!column.ok && column.issue === "web.handle.unknown_field" && typeof entry === "string" && isWebAutomationExtractFieldKey(entry)) {
      const reversed = readColumn(key, undefined, detected, at);
      if (reversed.ok) [column, written] = [reversed, entry];
    }
    if (!column.ok) return column;
    if (!isWebAutomationExtractFieldKey(written)) return { ok: false, issue: "web.handle.malformed", path: at };
    const refused = keep(written, column.field, at);
    if (refused) return refused;
  }
  return { ok: true, fields: kept };
}

/**
 * The detected column a name names, read for a caller outside this module.
 *
 * `./conditions.ts` needs it because a condition says which *items* a
 * read wants in the same vocabulary a field says which columns it keeps (C5):
 * the model was shown detected keys and labels and nothing else, so the column
 * a condition tests has to be named the same ways, and be refused the same
 * ways, as the column a field keeps.
 */
export function webExtractionNamedColumn(name: string, detected: Detected, path: WebPlanValuePath): WebExtractionColumn {
  return namedColumn(name, undefined, detected, path);
}

/** One column a field names, with the detected key it was found under. `ownKey` is the field's key, which a bare handle reference names its column by. */
function readColumn(entry: unknown, ownKey: string | undefined, detected: Detected, path: WebPlanValuePath): Column {
  if (typeof entry === "string") return namedColumn(entry, undefined, detected, path);
  if (!isJsonRecord(entry)) return { ok: false, issue: "web.handle.malformed", path };
  const stray = Object.keys(entry).find((key) => !COLUMN_OBJECT_KEYS.has(key));
  if (stray !== undefined) return { ok: false, issue: "web.handle.malformed", path: [...path, stray] };
  const names = [...new Set(COLUMN_NAME_KEYS.flatMap((key) => entry[key] === undefined ? [] : [entry[key]]))];
  if (names.length > 1 || names.some((name) => typeof name !== "string") || !optional(entry.attribute, "string") || !optional(entry.required, "boolean") || !optional(entry.header, "string")) {
    return { ok: false, issue: "web.handle.malformed", path };
  }
  const header = entry.header as string | undefined;
  const named = names[0] as string | undefined
    ?? (header !== undefined ? `${HEADER_PREFIX}${header}` : Object.hasOwn(entry, "handle") ? ownKey : undefined);
  if (named === undefined) return { ok: false, issue: "web.handle.malformed", path };
  const column = namedColumn(named, entry.attribute as string | undefined, detected, path);
  if (!column.ok) return column;
  if (entry.kind !== undefined && (typeof column.field === "string" || entry.kind !== column.field.kind)) return { ok: false, issue: "web.handle.malformed", path: [...path, "kind"] };
  const spec = column.field;
  if (entry.required === undefined || typeof spec === "string") return column;
  return {
    ok: true,
    key: column.key,
    field: present<WebAutomationExtractFieldSpec>({
      kind: spec.kind,
      selector: spec.selector,
      attribute: spec.attribute,
      header: spec.header,
      required: entry.required as boolean,
      handling: spec.handling,
      element: spec.element
    })
  };
}

/** The detected column `name` names -- `key`, `key@attr`, `column:Header` or a header -- read as that column or as its element's attribute. */
function namedColumn(name: string, attributeGiven: string | undefined, detected: Detected, path: WebPlanValuePath): Column {
  const at = name.indexOf("@");
  if (at >= 0 && attributeGiven !== undefined) return { ok: false, issue: "web.handle.malformed", path };
  const base = at < 0 ? name : name.slice(0, at);
  const attribute = at < 0 ? attributeGiven : name.slice(at + 1);
  const found = detectedKey(base, detected);
  if (found !== undefined && typeof found !== "string") return { ok: false, issue: found.issue, path };
  if (found === undefined) return { ok: false, issue: "web.handle.unknown_field", path };
  const spec = detected[found]!;
  if (attribute === undefined) return { ok: true, key: found, field: structuredClone(spec) };
  // A column read by its table header, or kept in the string grammar, has no one element whose attribute could be read.
  if (!ATTRIBUTE_NAME.test(attribute) || typeof spec === "string" || spec.kind === "column") return { ok: false, issue: "web.handle.malformed", path };
  return {
    ok: true,
    key: found,
    field: present<WebAutomationExtractFieldSpec>({
      kind: "attribute",
      selector: spec.selector,
      attribute,
      header: undefined,
      required: spec.required,
      handling: undefined,
      element: undefined
    })
  };
}

/** The detected key a name answers to: exactly, in another case, or as a table column's header. Two answers are ambiguous. */
function detectedKey(name: string, detected: Detected): string | { issue: WebExtractionColumnIssue } | undefined {
  if (Object.hasOwn(detected, name)) return name;
  const header = name.startsWith(HEADER_PREFIX) ? name.slice(HEADER_PREFIX.length) : name;
  const folded = (text: string) => text.trim().replace(/\s+/gu, " ").toLowerCase();
  const matches = Object.entries(detected)
    .filter(([key, spec]) => (!name.startsWith(HEADER_PREFIX) && key.toLowerCase() === name.toLowerCase())
      || (typeof spec !== "string" && spec.kind === "column" && spec.header !== undefined && folded(spec.header) === folded(header)))
    .map(([key]) => key);
  const unique = [...new Set(matches)];
  if (unique.length > 1) return { issue: "web.handle.ambiguous" };
  return unique[0];
}

function optional(value: unknown, type: "string" | "boolean"): boolean {
  return value === undefined || typeof value === type;
}
