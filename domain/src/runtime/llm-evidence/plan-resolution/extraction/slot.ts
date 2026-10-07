// The extraction node's `extractList`, written as the list a detection found.
//
// The detection tool shows the model a list as an opaque `extraction.N`, each
// column's `key`, and how the list continues (`structure/packet.ts`). The model
// is never shown a selector, so what it may say about the list is which
// detected columns to keep and under which of its own keys
// (`./columns.ts`), which of the list's items are records at all
// (`./conditions.ts`), and how many items to expect. The request it gets is
// the one the detection kept (`structure/handles.ts`), cut to that.
//
// The list is named by its handle in each place a model was seen or is told to
// name it, as `{ "handle": "extraction.N" }`, optionally with the `location`
// its evidence reported (Core tells the model to add one after exploring):
//
// - as the whole value, beside `fields` (or `columns`), `where`, `dedupe`,
//   `sort`, `minItems` and `maxItems`;
// - as the `item`, the literal request's name for which elements are the list;
// - on a field, as `./columns.ts` reads it.
//
// `where` says which items are records, in the same column vocabulary
// (`./conditions.ts`): a detected run holds a page's advertisements
// as well as its results, because a results page renders both from one
// template, and without it a read of "every product, leaving out sponsored
// placements" returns every advertisement too.
//
// `dedupe` and `sort` say which rows are one row and the order they are
// answered in, naming columns by the plan's own keys, exactly as a literal
// request does (`actions/extraction/order-request.ts`). They live inside
// `extractList` and nowhere else (decided 2026-09-28), so the handle form takes
// them too: live run `run-mulwm2dc-0bd95f22` asked for roles "deduplicated,
// newest first" over a detected list and had nowhere to write either. Each
// resolves to its canonical form, and one the reader would drop is refused at
// its position rather than dropped, since a model is still there to repair it.
//
// **The read reads the page shown** (S4 of the read-list redesign,
// `read-list-collect-design.md` 6.1). Every page of a list is a Flow loop: the
// read, a Next page step naming the same handle (`../next-page/`), and a repeat
// on the read through it. So the resolved request never carries `paginate`,
// though the detected pagination stays in the handle's binding for Next page
// to read, and a plan that writes `paginate`, `maxPages` or `maxScrolls` is
// refused at that key with the hint that names the loop
// (`web.handle.expected.extract_list.next_page`). It is never dropped: a read
// that quietly took one page where the model asked for every page would be a
// short answer nothing reports. Until 2026-10-06 the read paged by itself, and
// this file resolved those keys against the detected pager (`keptPagination`,
// `everyPage`, `liftedBounds`, run `run-mustvzvg-99695308`). A literal `item`
// beside a handle is replaced by the detected one, since the model was never
// shown a selector.
//
// Anything that does not name one detected list is refused with the code that
// says why and the position it was refused at. **The list itself is never
// guessed** -- a handle addresses one detection or none. A *column* name is,
// because a column is a name the model has to retype and a detection often
// names them after the page's own markup (`./column-match.ts`); every such
// guess is reported in the resolution's `assumed` rather than made silently.

import type { JsonObject, JsonValue } from "fluxiq/core";
import { webAutomationExtractListRequestRead, webAutomationExtractListRequestValue } from "../../../../actions/extraction";
import type { WebLlmExtractionHandles, WebLlmExtractionHandleScope } from "../../structure";
import { isJsonRecord } from "../../untrusted-json";
import type { WebExtractionColumnAssumption } from "./column-match";
import { keptWebExtractionColumns, type WebExtractionColumnIssue } from "./columns";
import { keptWebExtractionConditions } from "./conditions";
import { webPlanHandleKind, webPlanHandlesIn, type WebPlanValuePath } from "../handle-tokens";

/** Why an `extractList` names no one detected list. Each is a plan resolver issue code. */
export type WebExtractionSlotIssue = WebExtractionColumnIssue | "web.handle.misplaced" | "web.handle.unknown" | "web.handle.stale";

export type WebExtractionSlotResolution =
  /** The value names no list by handle and holds no handle: a literal request, or not a request at all. */
  | { status: "literal" }
  /**
   * `assumed` is every column name that found its column by something other
   * than the detected key verbatim: what was written, what it was read as, how,
   * and with what score (`./column-match.ts`).
   *
   * It is what makes a wrong answer traceable to an assumed column rather than
   * guessed at, and it is the resolver's counterpart to the dispatch reader's
   * `assumed` (`actions/extraction/read-request.ts`). **No run artifact carries
   * it yet**, and that hop is not this directory's: `../resolve-plan-node.ts`
   * would have to put it on its resolved outcome, and FluxIQ Core would have to
   * project it beside the authored node, as it already projects a corrected
   * *parameter* name (`flow-bootstrap/plan/name-correction-assumption.ts`). An
   * assumption is not a fault, so nothing here turns it into a refusal.
   */
  | {
    status: "resolved";
    request: JsonObject;
    frameId: number | undefined;
    /** The path of the child frame's document the list was detected in, which finds that frame again after a reload; absent for the top frame. */
    frameUrlPath: string | undefined;
    assumed: WebExtractionColumnAssumption[];
  }
  /**
   * `path` is where inside the value it was refused, and `expected` the shape
   * the refused key belongs in when it has one.
   */
  | { status: "refused"; issue: WebExtractionSlotIssue; path: WebPlanValuePath; expected?: WebExtractionSlotHint };

/**
 * Said beside a `paginate`, `maxPages` or `maxScrolls` the read no longer
 * takes: the pages of a list are a Next page step naming the same handle,
 * after the read, and a repeat on the read through that step while it
 * succeeds (`../next-page/`). Declared with the resolver's other codes
 * (`../resolve-plan-node.ts`, `WEB_PLAN_HANDLE_ISSUE_CODES`).
 */
const NEXT_PAGE_INSTEAD = "web.handle.expected.extract_list.next_page";

/** The shape hints a slot refusal may carry beside its reason. */
type WebExtractionSlotHint = typeof NEXT_PAGE_INSTEAD;

const LIST_KEYS: ReadonlySet<string> = new Set(["handle", "location", "item", "fields", "columns", "where", "dedupe", "sort", "minItems", "maxItems"]);
const REFERENCE_KEYS: ReadonlySet<string> = new Set(["handle", "location"]);
/** The keys a read that paged by itself took, each refused where it is written (`NEXT_PAGE_INSTEAD`). */
const RETIRED_PAGING_KEYS: ReadonlySet<string> = new Set(["paginate", "maxPages", "maxScrolls"]);

type Reference = { handle: unknown; location: unknown; path: WebPlanValuePath };
type Refused = Extract<WebExtractionSlotResolution, { status: "refused" }>;

export function resolveWebExtractionSlot(value: unknown, scope: WebLlmExtractionHandleScope, extractions: WebLlmExtractionHandles): WebExtractionSlotResolution {
  const handles = webPlanHandlesIn(value);
  if (!isJsonRecord(value)) return handles[0] ? refused("web.handle.misplaced", handles[0].path) : { status: "literal" };
  const references = referencesIn(value);
  if (references.length === 0) return handles[0] ? refused("web.handle.misplaced", handles[0].path) : { status: "literal" };
  const stray = handles.find((found) => !references.some((reference) => samePath(reference.path, found.path)));
  if (stray) return refused("web.handle.misplaced", stray.path);
  const retired = Object.keys(value).find((key) => RETIRED_PAGING_KEYS.has(key));
  if (retired !== undefined) return { status: "refused", issue: "web.handle.malformed", path: [retired], expected: NEXT_PAGE_INSTEAD };
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

  const request: JsonObject = { item: binding.extractList.item, fields: columns.fields as unknown as JsonObject };
  // An empty clause resolves to no conditions, and the request carries no
  // `where` at all rather than an empty one the dispatch would have to read.
  // No `paginate`, whatever the detection found: the read reads the page shown.
  if (where !== undefined && where.ok && where.where.length > 0) request.where = where.where as unknown as JsonValue;
  if (value.minItems !== undefined) request.minItems = value.minItems as JsonValue;
  if (value.maxItems !== undefined) request.maxItems = value.maxItems as JsonValue;
  // A handle that names one record reads one row, whatever the plan wrote: two
  // rows from what the model chose as one record would be a wrong table
  // (`../../structure/handles.ts`, `oneRecord`).
  if (binding.oneRecord === true) request.maxItems = 1;
  // The request is held to the reader a dispatch is refused by, so a handle
  // never resolves into one the page would not run, clamp or read otherwise.
  const checked = webAutomationExtractListRequestValue(request);
  if (checked === undefined) return refused("web.handle.malformed", []);
  if (checked.minItems !== request.minItems) return refused("web.handle.malformed", ["minItems"]);
  if (checked.maxItems !== request.maxItems) return refused("web.handle.malformed", ["maxItems"]);
  const order = keptOrder(value, request);
  if ("issue" in order) return order;
  const assumed = [...columns.assumed, ...(where !== undefined && where.ok ? where.assumed : [])];
  return { status: "resolved", request, frameId: binding.frameId, frameUrlPath: binding.frameUrlPath, assumed };
}

/**
 * `dedupe` and `sort` as the reader reads them against the columns the plan
 * keeps, written onto the request in canonical form: a column resolved from the
 * plan's key, and every forgiving spelling read as the one it means. An off
 * dedupe and an empty sort leave the request without either. A part the reader
 * would drop is refused at its position -- `dedupe`, or `sort.N` for the key it
 * could not read -- because dropped here it would sort or dedupe nothing while
 * the model believed it had asked.
 */
function keptOrder(value: Record<string, unknown>, request: JsonObject): { ok: true } | Refused {
  if (value.dedupe === undefined && value.sort === undefined) return { ok: true };
  const probe: JsonObject = { ...request };
  if (value.dedupe !== undefined) probe.dedupe = value.dedupe as JsonValue;
  if (value.sort !== undefined) probe.sort = value.sort as JsonValue;
  const read = webAutomationExtractListRequestRead(probe);
  if (read.dropped.includes("dedupe")) return refused("web.handle.malformed", ["dedupe"]);
  const sortKey = read.dropped.find((part) => part.startsWith("sort."));
  if (sortKey !== undefined) {
    // The reader's position counts keys after splitting `"a desc, b"`, which is
    // the written array's position only when no entry held two keys.
    const index = Number(sortKey.slice(5));
    const oneKeyEach = Array.isArray(value.sort) && value.sort.every((entry) => typeof entry !== "string" || !/[,;]|\sthen\s/u.test(entry));
    return refused("web.handle.malformed", oneKeyEach ? ["sort", index] : ["sort"]);
  }
  if (read.request?.dedupe !== undefined) request.dedupe = read.request.dedupe as unknown as JsonObject;
  if (read.request?.sort !== undefined) request.sort = read.request.sort as unknown as JsonValue;
  return { ok: true };
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

function samePath(left: WebPlanValuePath, right: WebPlanValuePath): boolean {
  return left.length === right.length && left.every((step, index) => String(step) === String(right[index]));
}

function refused(issue: WebExtractionSlotIssue, path: WebPlanValuePath): Refused {
  return { status: "refused", issue, path };
}
