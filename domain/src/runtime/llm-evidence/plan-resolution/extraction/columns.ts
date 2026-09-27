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
// **A name nothing answers to is resolved to the nearest column rather than
// refused** (`./column-match.ts` says why, and with what signals). What is still
// refused is a selector, a kind that reads something else, a column two answer
// to *exactly*, and a name with no plausible candidate at all -- with the
// position it was refused at.
//
// ## Every strict reading is taken before any guess
//
// A guess must never take a reading away from a name that was written exactly,
// so the whole of `fields` is read twice: once refusing a guess, then once
// allowing one for the entries that found nothing. Two readings depend on it.
//
// The map written the other way round -- `{ "product-price": "price" }` -- is
// recognised only because the value names no column; a guess at `price` would
// answer first and invert what the plan meant. **That reading stays strict even
// in the second pass**, and deliberately: it is unambiguous only because the key
// names a column exactly, and a *guessed* key is no evidence of an inversion at
// all. Read the other way, `{ name: "banana" }` would keep the name column under
// the key `banana`, which is the opposite of the one thing the plan did say.
//
// And a guess that landed on a column another entry named exactly would either
// collide with it (`web.handle.malformed`, a refusal caused by a spelling) or
// read the same column twice under two keys. So the second pass looks only among
// the columns the first pass did not take.

import type { AutomationStudioNameValueShape } from "fluxiq/automation-studio/nodes";
import {
  isWebAutomationExtractFieldKey,
  type WebAutomationExtractField,
  type WebAutomationExtractFieldSpec
} from "../../../../actions/extraction";
import { present } from "../../present";
import { isJsonRecord } from "../../untrusted-json";
import { webExtractionMatchedColumn, type WebExtractionColumnAssumption } from "./column-match";
import type { WebPlanValuePath } from "../handle-tokens";

export type WebExtractionColumnIssue = "web.handle.malformed" | "web.handle.ambiguous" | "web.handle.unknown_field";

export type WebExtractionColumns =
  | { ok: true; fields: Record<string, WebAutomationExtractField>; assumed: WebExtractionColumnAssumption[] }
  | { ok: false; issue: WebExtractionColumnIssue; path: WebPlanValuePath };

type Detected = Record<string, WebAutomationExtractField>;

/** One detected column a plan named, with the detected key it was found under, what the name assumed to get there, or why it named none. */
export type WebExtractionColumn =
  | { ok: true; key: string; field: WebAutomationExtractField; assumed: WebExtractionColumnAssumption | undefined }
  | { ok: false; issue: WebExtractionColumnIssue; path: WebPlanValuePath };

type Column = WebExtractionColumn;

/**
 * How hard to look for the column a name names.
 *
 * `guess` off is the strict reading -- the key verbatim, the key in another
 * casing or with other separators, or a table header -- and is what every
 * caller tries first. `wanted` is the shape the comparison the name was written
 * for needs, where the caller knows it. `among` names the vocabulary being
 * searched, for the assumption's record.
 */
export type WebExtractionColumnLook = {
  guess: boolean;
  wanted?: AutomationStudioNameValueShape | undefined;
  among: "detected" | "kept";
};

/** The keys a column object may carry beside the ones that name its column. */
const COLUMN_OBJECT_KEYS: ReadonlySet<string> = new Set(["handle", "location", "key", "field", "column", "header", "attribute", "required", "kind"]);
const COLUMN_NAME_KEYS = ["key", "field", "column"] as const;
/** An HTML attribute name, as a plan may name one after `@`. */
const ATTRIBUTE_NAME = /^[A-Za-z_][A-Za-z0-9_.:-]{0,99}$/u;
const HEADER_PREFIX = "column:";

/** Reading `fields` names no comparison, so no shape is known; the columns a plan keeps are always named among the detected ones. */
const STRICT: WebExtractionColumnLook = { guess: false, among: "detected" };
const GUESSING: WebExtractionColumnLook = { guess: true, among: "detected" };

/** One entry of `fields`, as far as it has been read. */
type Entry = { at: WebPlanValuePath; entry: unknown; ownKey: string | undefined; column: Column | undefined; written: string };

/** The columns `fields` keeps, every detected one when it is absent. `path` is where `fields` itself is. */
export function keptWebExtractionColumns(fields: unknown, detected: Detected, path: WebPlanValuePath): WebExtractionColumns {
  if (fields === undefined) return { ok: true, fields: structuredClone(detected), assumed: [] };
  const entries = writtenEntries(fields, path);
  if (!Array.isArray(entries)) return entries;

  // Pass one: every strict reading, in both directions, taking no guess.
  for (const written of entries) {
    written.column = readColumn(written.entry, written.ownKey, detected, written.at, STRICT);
    if (unknownField(written.column) && written.ownKey !== undefined && typeof written.entry === "string" && isWebAutomationExtractFieldKey(written.entry)) {
      // Written the other way round: the key is the column, the value the name to keep it under.
      const reversed = readColumn(written.ownKey, undefined, detected, written.at, STRICT);
      if (reversed.ok) [written.column, written.written] = [reversed, written.entry];
    }
    if (!written.column.ok && !unknownField(written.column)) return written.column;
  }

  // Pass two: the nearest column, among the ones no strict reading took.
  const taken = new Set(entries.flatMap((written) => (written.column?.ok === true ? [written.column.key] : [])));
  const remaining: Detected = Object.fromEntries(Object.entries(detected).filter(([key]) => !taken.has(key)));
  for (const written of entries) {
    if (written.column?.ok === true) continue;
    const guessed = readColumn(written.entry, written.ownKey, remaining, written.at, GUESSING);
    if (!guessed.ok) return guessed;
    written.column = guessed;
    taken.add(guessed.key);
    delete remaining[guessed.key];
  }

  const kept: Record<string, WebAutomationExtractField> = {};
  const assumed: WebExtractionColumnAssumption[] = [];
  for (const written of entries) {
    // Every entry is resolved by now -- pass two returns on the first that is
    // not -- so the branch below is the type's breadth rather than a case.
    const column = written.column;
    if (column === undefined || !column.ok) return column ?? { ok: false, issue: "web.handle.malformed", path };
    // An array keeps each column under the detected key it was found under; a
    // map keeps it under the plan's own key, or the value when the plan wrote
    // the map the other way round.
    const under = written.ownKey === undefined ? column.key : written.written;
    if (!isWebAutomationExtractFieldKey(under)) return { ok: false, issue: "web.handle.malformed", path: written.at };
    if (Object.hasOwn(kept, under)) return { ok: false, issue: "web.handle.malformed", path: written.at };
    kept[under] = column.field;
    if (column.assumed !== undefined) assumed.push(column.assumed);
  }
  return { ok: true, fields: kept, assumed };
}

/** Whether a read failed only because nothing answered to the name, which is the one failure another reading may still answer. */
function unknownField(column: Column): boolean {
  return !column.ok && column.issue === "web.handle.unknown_field";
}

/** `fields` split into the entries to read, in the order they were written, or why it is not a field map at all. */
function writtenEntries(fields: unknown, path: WebPlanValuePath): Entry[] | Extract<WebExtractionColumns, { ok: false }> {
  if (Array.isArray(fields)) {
    if (fields.length === 0) return { ok: false, issue: "web.handle.malformed", path };
    // An array keeps each column under the detected key it is found under, which
    // is not known until it is found, so `written` stays empty and the assembly
    // below takes the key from the column instead.
    return fields.map((entry, index) => ({ at: [...path, index], entry, ownKey: undefined, column: undefined, written: "" }));
  }
  if (!isJsonRecord(fields) || Object.keys(fields).length === 0) return { ok: false, issue: "web.handle.malformed", path };
  return Object.entries(fields).map(([key, entry]) => ({ at: [...path, key], entry, ownKey: key, column: undefined, written: key }));
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
export function webExtractionNamedColumn(name: string, detected: Detected, path: WebPlanValuePath, look: WebExtractionColumnLook): WebExtractionColumn {
  return namedColumn(name, undefined, detected, path, look);
}

/** One column a field names, with the detected key it was found under. `ownKey` is the field's key, which a bare handle reference names its column by. */
function readColumn(entry: unknown, ownKey: string | undefined, detected: Detected, path: WebPlanValuePath, look: WebExtractionColumnLook): Column {
  if (typeof entry === "string") return namedColumn(entry, undefined, detected, path, look);
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
  const column = namedColumn(named, entry.attribute as string | undefined, detected, path, look);
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
    }),
    assumed: column.assumed
  };
}

/** The detected column `name` names -- `key`, `key@attr`, `column:Header` or a header -- read as that column or as its element's attribute. */
function namedColumn(name: string, attributeGiven: string | undefined, detected: Detected, path: WebPlanValuePath, look: WebExtractionColumnLook): Column {
  const at = name.indexOf("@");
  if (at >= 0 && attributeGiven !== undefined) return { ok: false, issue: "web.handle.malformed", path };
  const base = at < 0 ? name : name.slice(0, at);
  const attribute = at < 0 ? attributeGiven : name.slice(at + 1);
  const found = detectedKey(base, detected, look);
  if (found !== undefined && "issue" in found) return { ok: false, issue: found.issue, path };
  if (found === undefined) return { ok: false, issue: "web.handle.unknown_field", path };
  const assumed: WebExtractionColumnAssumption | undefined = found.how === "exact"
    ? undefined
    : { path, written: base, field: found.key, how: found.how, score: found.score, among: look.among };
  const spec = detected[found.key]!;
  if (attribute === undefined) return { ok: true, key: found.key, field: structuredClone(spec), assumed };
  // A column read by its table header, or kept in the string grammar, has no one element whose attribute could be read.
  if (!ATTRIBUTE_NAME.test(attribute) || typeof spec === "string" || spec.kind === "column") return { ok: false, issue: "web.handle.malformed", path };
  return {
    ok: true,
    key: found.key,
    field: present<WebAutomationExtractFieldSpec>({
      kind: "attribute",
      selector: spec.selector,
      attribute,
      header: undefined,
      required: spec.required,
      handling: undefined,
      element: undefined
    }),
    assumed
  };
}

/** The detected column a written name found, and how much of that was a guess. */
type Found = { key: string; how: "exact" | "normalized" | "nearest"; score: number };

/**
 * The detected key a name answers to: exactly, in another case, as a table
 * column's header, or -- when the caller allows a guess -- as the nearest column
 * of all. Two answers to the *same* name are ambiguous, because that is two
 * readings rather than a spelling.
 */
function detectedKey(name: string, detected: Detected, look: WebExtractionColumnLook): Found | { issue: WebExtractionColumnIssue } | undefined {
  if (Object.hasOwn(detected, name)) return { key: name, how: "exact", score: 1 };
  const headerOnly = name.startsWith(HEADER_PREFIX);
  const header = headerOnly ? name.slice(HEADER_PREFIX.length) : name;
  const folded = (text: string) => text.trim().replace(/\s+/gu, " ").toLowerCase();
  const matches = Object.entries(detected)
    .filter(([key, spec]) => (!headerOnly && key.toLowerCase() === name.toLowerCase())
      || (typeof spec !== "string" && spec.kind === "column" && spec.header !== undefined && folded(spec.header) === folded(header)))
    .map(([key]) => key);
  const unique = [...new Set(matches)];
  if (unique.length > 1) return { issue: "web.handle.ambiguous" };
  const only = unique[0];
  if (only !== undefined) return { key: only, how: "normalized", score: 1 };
  const near = webExtractionMatchedColumn(header, detected, { headerOnly, wanted: look.wanted });
  if (near === undefined || (near.how === "nearest" && !look.guess)) return undefined;
  return near;
}

function optional(value: unknown, type: "string" | "boolean"): boolean {
  return value === undefined || typeof value === type;
}
