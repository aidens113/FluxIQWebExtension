// The extraction node's `extractList`, written as the list a detection found.
//
// The detection tool shows the model a list as an opaque `extraction.N`, each
// column's `key`, and how the list continues (`structure/packet.ts`). The model
// is never shown a selector, so what it may say about the list is which
// detected columns to keep and under which of its own keys
// (`./columns.ts`), which of the list's items are records at all
// (`./conditions.ts`), whether to read past the page shown, and how
// many items to expect. The request it gets is the one the detection kept
// (`structure/handles.ts`), cut to that.
//
// The list is named by its handle in each place a model was seen or is told to
// name it, as `{ "handle": "extraction.N" }`, optionally with the `location`
// its evidence reported (Core tells the model to add one after exploring):
//
// - as the whole value, beside `fields` (or `columns`), `paginate`, `minItems`
//   and `maxItems`;
// - as the `item`, the literal request's name for which elements are the list;
// - on a field, as `./columns.ts` reads it.
//
// `where` says which items are records, in the same column vocabulary
// (`./conditions.ts`): a detected run holds a page's advertisements
// as well as its results, because a results page renders both from one
// template, and without it a read of "every product, leaving out sponsored
// placements" returns every advertisement too.
//
// `paginate: false` reads only the page shown. Absent or `true`, the detected
// pagination is read. A pagination the model wrote itself names controls it
// was never shown, so it can only mean "keep reading": the detected one is read,
// with the model's own `maxPages` or `maxScrolls` when its mode is the detected
// one; with nothing detected it is refused. A literal `item` beside a handle is
// replaced by the detected one for the same reason.
//
// Anything that does not name one detected list is refused with the code that
// says why and the position it was refused at. Nothing is guessed.

import type { JsonObject, JsonValue } from "fluxiq/core";
import {
  WEB_AUTOMATION_EXTRACT_MAX_PAGES,
  webAutomationExtractListRequestValue,
  type WebAutomationExtractListPagination
} from "../../../../actions/extraction";
import type { WebLlmExtractionBinding, WebLlmExtractionHandles, WebLlmExtractionHandleScope } from "../../structure";
import { isJsonRecord } from "../../untrusted-json";
import { keptWebExtractionColumns, type WebExtractionColumnIssue } from "./columns";
import { keptWebExtractionConditions } from "./conditions";
import { webPlanHandleKind, webPlanHandlesIn, type WebPlanValuePath } from "../handle-tokens";

/** Why an `extractList` names no one detected list. Each is a plan resolver issue code. */
export type WebExtractionSlotIssue = WebExtractionColumnIssue | "web.handle.misplaced" | "web.handle.unknown" | "web.handle.stale";

export type WebExtractionSlotResolution =
  /** The value names no list by handle and holds no handle: a literal request, or not a request at all. */
  | { status: "literal" }
  | { status: "resolved"; request: JsonObject; frameId: number | undefined }
  /** `path` is where inside the value it was refused. */
  | { status: "refused"; issue: WebExtractionSlotIssue; path: WebPlanValuePath };

const LIST_KEYS: ReadonlySet<string> = new Set(["handle", "location", "item", "fields", "columns", "where", "paginate", "minItems", "maxItems"]);
const REFERENCE_KEYS: ReadonlySet<string> = new Set(["handle", "location"]);

type Reference = { handle: unknown; location: unknown; path: WebPlanValuePath };
type Refused = Extract<WebExtractionSlotResolution, { status: "refused" }>;

export function resolveWebExtractionSlot(value: unknown, scope: WebLlmExtractionHandleScope, extractions: WebLlmExtractionHandles): WebExtractionSlotResolution {
  const handles = webPlanHandlesIn(value);
  if (!isJsonRecord(value)) return handles[0] ? refused("web.handle.misplaced", handles[0].path) : { status: "literal" };
  const references = referencesIn(value);
  if (references.length === 0) return handles[0] ? refused("web.handle.misplaced", handles[0].path) : { status: "literal" };
  const stray = handles.find((found) => !references.some((reference) => samePath(reference.path, found.path)));
  if (stray) return refused("web.handle.misplaced", stray.path);
  const unknownKey = Object.keys(value).find((key) => !LIST_KEYS.has(key));
  if (unknownKey !== undefined) return refused("web.handle.malformed", [unknownKey]);
  if (value.location !== undefined && !Object.hasOwn(value, "handle")) return refused("web.handle.malformed", ["location"]);
  if (value.fields !== undefined && value.columns !== undefined) return refused("web.handle.malformed", ["columns"]);
  const item = value.item;
  if (item !== undefined && typeof item !== "string" && !(isJsonRecord(item) && Object.hasOwn(item, "handle"))) return refused("web.handle.malformed", ["item"]);
  if (isJsonRecord(item) && Object.keys(item).some((key) => !REFERENCE_KEYS.has(key))) return refused("web.handle.malformed", ["item"]);

  const named = namedHandle(references);
  if ("issue" in named) return named;
  const resolution = extractions.resolve(scope, named.handle);
  if (!resolution.ok) return refused(resolution.code === "stale_handle" ? "web.handle.stale" : "web.handle.unknown", named.path);
  const binding = resolution.binding;
  const elsewhere = references.find((reference) => reference.location !== undefined && reference.location !== binding.location);
  if (elsewhere) return refused("web.handle.unknown", [...elsewhere.path, "location"]);

  const fieldsKey = value.columns !== undefined ? "columns" : "fields";
  const columns = keptWebExtractionColumns(value[fieldsKey], binding.extractList.fields, [fieldsKey]);
  if (!columns.ok) return refused(columns.issue, columns.path);
  // Conditions are read against the columns the *detection* found, because the
  // mark that tells a sponsored card from an organic one is exactly the column
  // a table of products does not want -- and against the columns this plan
  // keeps, because a plan that renames a detected column to `rating` then says
  // `{field: "rating", atLeast: 4}` in the words it has itself just written.
  const where = value.where === undefined
    ? undefined
    : keptWebExtractionConditions(value.where, { detected: binding.extractList.fields, kept: columns.fields }, ["where"]);
  if (where !== undefined && !where.ok) return refused(where.issue, where.path);
  const paginate = keptPagination(value.paginate, binding);
  if (paginate === "malformed") return refused("web.handle.malformed", ["paginate"]);

  const request: JsonObject = { item: binding.extractList.item, fields: columns.fields as unknown as JsonObject };
  if (where !== undefined) request.where = where.where as unknown as JsonValue;
  if (paginate !== undefined) request.paginate = paginate as unknown as JsonObject;
  if (value.minItems !== undefined) request.minItems = value.minItems as JsonValue;
  if (value.maxItems !== undefined) request.maxItems = value.maxItems as JsonValue;
  // The request is held to the reader a dispatch is refused by, so a handle
  // never resolves into one the page would not run, clamp or read otherwise.
  const checked = webAutomationExtractListRequestValue(request);
  if (checked === undefined) return refused("web.handle.malformed", []);
  if (checked.minItems !== request.minItems) return refused("web.handle.malformed", ["minItems"]);
  if (checked.maxItems !== request.maxItems) return refused("web.handle.malformed", ["maxItems"]);
  return { status: "resolved", request, frameId: binding.frameId };
}

/** Every place the value names its list by reference: its own `handle`, its `item`, and each field that carries one. */
function referencesIn(value: Record<string, unknown>): Reference[] {
  const references: Reference[] = [];
  if (Object.hasOwn(value, "handle")) references.push({ handle: value.handle, location: value.location, path: [] });
  if (isJsonRecord(value.item) && Object.hasOwn(value.item, "handle")) references.push({ handle: value.item.handle, location: value.item.location, path: ["item"] });
  for (const fieldsKey of ["fields", "columns"]) {
    const fields = value[fieldsKey];
    const entries: Array<[string | number, unknown]> = Array.isArray(fields) ? [...fields.entries()] : isJsonRecord(fields) ? Object.entries(fields) : [];
    for (const [key, field] of entries) {
      if (isJsonRecord(field) && Object.hasOwn(field, "handle")) references.push({ handle: field.handle, location: field.location, path: [fieldsKey, key] });
    }
  }
  return references;
}

/** The one extraction handle every reference names, or why there is not one. */
function namedHandle(references: Reference[]): { handle: string; path: WebPlanValuePath } | Refused {
  let named: { handle: string; path: WebPlanValuePath } | undefined;
  for (const reference of references) {
    const kind = webPlanHandleKind(reference.handle);
    if (kind === "target") return refused("web.handle.misplaced", reference.path);
    if (kind !== "extraction" || typeof reference.handle !== "string") return refused("web.handle.malformed", [...reference.path, "handle"]);
    if (reference.location !== undefined && (typeof reference.location !== "string" || reference.location === "")) return refused("web.handle.malformed", [...reference.path, "location"]);
    if (named !== undefined && named.handle !== reference.handle) return refused("web.handle.ambiguous", reference.path);
    named ??= { handle: reference.handle, path: reference.path };
  }
  return named ?? refused("web.handle.malformed", []);
}

/** The pagination the plan reads with: the detected one, bounded as the plan says; none; or `malformed`. */
function keptPagination(paginate: unknown, binding: WebLlmExtractionBinding): WebAutomationExtractListPagination | undefined | "malformed" {
  const detected = binding.extractList.paginate;
  if (paginate === false) return undefined;
  if (paginate === undefined || paginate === true) return detected;
  if (!isJsonRecord(paginate) || detected === undefined) return "malformed";
  const bounded = structuredClone(detected);
  const sameMode = paginate.mode === undefined || paginate.mode === (detected.mode ?? "next");
  if (!sameMode) return bounded;
  const bound = bounded.mode === "scroll" ? paginate.maxScrolls : paginate.maxPages;
  if (bound === undefined) return bounded;
  if (typeof bound !== "number" || !Number.isSafeInteger(bound) || bound < 1 || bound > WEB_AUTOMATION_EXTRACT_MAX_PAGES) return "malformed";
  if (bounded.mode === "scroll") bounded.maxScrolls = bound;
  else bounded.maxPages = bound;
  return bounded;
}

function samePath(left: WebPlanValuePath, right: WebPlanValuePath): boolean {
  return left.length === right.length && left.every((step, index) => String(step) === String(right[index]));
}

function refused(issue: WebExtractionSlotIssue, path: WebPlanValuePath): Refused {
  return { status: "refused", issue, path };
}
