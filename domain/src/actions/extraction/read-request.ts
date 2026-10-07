// Reading an extraction request off an untrusted value: the field map, the
// pagination, the conditions that say which items are records, and the
// single-value read.
//
// These readers were the extraction half of `client/gateway-action-parameters.ts`,
// where they served the parameter lift alone. They live here because two callers
// now need them and the other one cannot reach `client/`:
// `io/input-model.ts` decides whether a recorded `extract_list` is executable by
// asking whether this reader reads its request, and `client/gateway-mapping.ts`
// already imports `io/input-model`, so importing `client` from `io` would make a
// cycle. The request contract owns them instead, beside the types they build.
//
// Nothing here coerces, and nothing is dropped quietly. What "not quietly"
// means changed on 2026-09-26, and the change is the whole of why this file has
// two entry points.
//
// ## One bad part no longer costs every row
//
// Until then, a property that was **sent but cannot be read** refused the whole
// request: dropped, the page would read something other than what the request
// names and report success having done it. The reasoning was sound about a
// *silent* drop and wrong about the cost. A refused request is not a narrower
// answer -- it is an extraction node that cannot run at all, and a Flow that
// returns nothing. Of the ten Flows the everything-store rung built, **six
// stored zero records and two returned every row of the page**; the read is
// bimodal, and nothing is the failure that dominates. Run
// `run-muhubegx-9469de5e` authored `paginate: { next: null, maxPages: 5 }` --
// plainly "keep reading, five pages, I was never shown the control" -- and the
// old rule's answer to that was no rows at all.
//
// So the parts a read can do without are **dropped and named** instead:
// `itemElement`, `paginate`, `minItems`, one condition of `where`, `dedupe`,
// one key of `sort`, and `answer`. Each
// drop can only widen the answer -- a read of the page shown, a default
// minimum, an unnarrowed row set -- and widening is visible to the loop's own
// judgement while emptiness is not (`content/extraction/filtered-answer.ts`
// argues the same asymmetry one layer down). `item` and `fields` still refuse
// the request whole, because a read with no rows to find or no column to keep
// is not a wider answer but a different one, and because each has a named,
// repairable code of its own already (`output-nodes/extract-list/issues.ts`).
//
// **Named is the other half, and it is not optional.**
// `webAutomationExtractListRequestRead` returns what it dropped, so the author's
// side of the seam still refuses the plan by name before it ever runs: the
// tolerance is what a dispatch does when there is nobody left to repair it, not
// a licence to accept a malformed request quietly.
//
// ## A column named nearly right is the column
//
// A condition naming a field key this request does not have used to refuse the
// request. It now resolves to the nearest key the request actually reads and says
// that it assumed; which key that is, and why, is `./field-match.ts`.
//
// `elementFingerprint` is imported from the `output-nodes/targets` directory's
// own barrel rather than the `output-nodes` barrel on purpose. The latter
// reaches `output-nodes/definitions`, which imports `actions/schemas`, which
// imports this directory's barrel -- a runtime cycle. The `targets` barrel
// exports only that module, which imports nothing from `actions/` but types, so
// this import is a leaf. That directory exists for this import: a specifier
// naming a directory goes through its index, while one naming a file inside
// another directory is a `structure-audit` [imports] failure.

import type { JsonObject } from "fluxiq/core";
import { elementFingerprint } from "../../output-nodes/targets";
import type { WebAutomationElementFingerprint } from "../types";
import { webAutomationExtractConditionSayingValue } from "./condition-grammar";
import { isWebAutomationExtractFieldKey } from "./field-key";
import { isWebAutomationExtractFieldRead, webAutomationExtractFieldMatch } from "./field-match";
import { webAutomationExtractListDedupeValue, webAutomationExtractListSortValue } from "./order-request";
import {
  WEB_AUTOMATION_EXTRACT_FIELD_HANDLINGS,
  WEB_AUTOMATION_EXTRACT_FIELD_KINDS,
  WEB_AUTOMATION_EXTRACT_LIST_ANSWER_KEPT,
  WEB_AUTOMATION_EXTRACT_MAX_ITEMS,
  WEB_AUTOMATION_EXTRACT_MAX_PAGES,
  WEB_AUTOMATION_EXTRACT_PAGINATION_MODES,
  WEB_AUTOMATION_EXTRACT_READ_MODES,
  type WebAutomationExtractField,
  type WebAutomationExtractFieldSpec,
  type WebAutomationExtractItemCondition,
  type WebAutomationExtractListPagination,
  type WebAutomationExtractListRequest,
  type WebAutomationExtractRead
} from "./request";

/**
 * The request the page would run, or `undefined` for a value that names no read
 * at all. Every caller that only dispatches asks this; a caller that has to
 * name what was wrong with it asks `webAutomationExtractListRequestRead`.
 */
export function webAutomationExtractListRequestValue(value: unknown): WebAutomationExtractListRequest | undefined {
  return webAutomationExtractListRequestRead(value).request;
}

/**
 * The request only when **every part of it** was readable, and `undefined` when
 * any part had to be dropped.
 *
 * It is the rule a wire copy of a *producer's* value keeps, and the tolerance
 * above is deliberately not for those. A model's malformed `paginate` is a slip
 * nobody downstream can repair, so the read goes on without it; a detector's
 * malformed pagination (`extraction/structure-detection.ts`) or a recorded
 * definition's (`./recorded-definition.ts`) is a producer saying something this
 * contract cannot read back, and arriving as a proposal that claims no
 * pagination would be a misstatement no author asked for and none can see. The
 * author-facing issue codes ask the same question
 * (`output-nodes/extract-list/issues.ts`).
 */
export function webAutomationExtractListRequestWhole(value: unknown): WebAutomationExtractListRequest | undefined {
  const read = webAutomationExtractListRequestRead(value);
  return read.dropped.length === 0 ? read.request : undefined;
}

/**
 * One part of a request that was sent and could not be read, named as the key it
 * was written under. A condition carries its index in the `where` the author
 * wrote, so a caller can name the clause rather than the clause count.
 */
export type WebAutomationExtractListDroppedPart = "itemElement" | "paginate" | "minItems" | `where.${number}` | "dedupe" | `sort.${number}` | "answer";

/**
 * A condition whose column was resolved rather than named: what was written,
 * what it was read as, and how much of that was a guess.
 *
 * `normalized` is the same key in another casing or with other separators,
 * which is a spelling variant; `nearest` is a scored guess and is the one worth
 * a person's attention. `score` is name similarity in 0..1 before any
 * shape tie-break, exactly as Core's matcher reports it.
 */
export type WebAutomationExtractListFieldAssumption = {
  index: number;
  written: string;
  field: string;
  how: "normalized" | "nearest";
  score: number;
};

/** The request, the parts that were dropped to get it, and the columns it assumed. */
export type WebAutomationExtractListRequestRead = {
  request?: WebAutomationExtractListRequest | undefined;
  dropped: WebAutomationExtractListDroppedPart[];
  assumed: WebAutomationExtractListFieldAssumption[];
};

/**
 * A list extraction needs both the item selector and the field map, and nothing
 * else: `itemElement`, `paginate`, `minItems`, any one condition of `where`
 * and `answer` are dropped when they cannot be read, and named in `dropped`.
 *
 * `maxItems` is held to the domain's record bound, as `maxPages` is to its page
 * bound; one that is not a positive integer has always been dropped rather than
 * refused, and `issues.ts` names it for an author. `minItems` above the maximum
 * -- the one named, or the bound when none is -- is dropped with it, since no
 * page could satisfy it and the default of 1 always can.
 */
export function webAutomationExtractListRequestRead(value: unknown): WebAutomationExtractListRequestRead {
  const dropped: WebAutomationExtractListDroppedPart[] = [];
  const assumed: WebAutomationExtractListFieldAssumption[] = [];
  const request = jsonObject(value);
  const item = nonEmptyString(request?.item);
  const fields = fieldMapValue(request?.fields);
  if (!request || item === undefined || fields === undefined) return { dropped, assumed };
  // A request that names a frame is refused whole rather than read without it.
  // Extraction takes its frame from the command, never from the request
  // (`request.ts`), so none of these names is a request property. Dropped, the
  // read would run against the document it was delivered to while its author
  // believed it had named another -- a different answer rather than a wider one,
  // which is why this one is not among the parts a read does without.
  if (FRAME_KEYS.some((key) => request[key] !== undefined)) return { dropped, assumed };
  // The element the item selector was generalized from. Sent but unreadable, it
  // leaves: the page then matches on the selector alone, which is what every
  // model-authored request does anyway, and refusing the read over a malformed
  // identity hint is the worst trade in the file.
  const readElement = optionalValue(request.itemElement, fingerprintValue);
  if (readElement === REFUSED) dropped.push("itemElement");
  const itemElement = readElement === REFUSED ? undefined : readElement;
  const paginate = request.paginate === undefined ? undefined : paginationValue(request.paginate);
  if (request.paginate !== undefined && paginate === undefined) dropped.push("paginate");
  const namedMaxItems = positiveInteger(request.maxItems);
  const maxItems = namedMaxItems === undefined ? undefined : Math.min(namedMaxItems, WEB_AUTOMATION_EXTRACT_MAX_ITEMS);
  const readMinItems = nonNegativeInteger(request.minItems);
  const minItems = readMinItems !== undefined && readMinItems <= (maxItems ?? WEB_AUTOMATION_EXTRACT_MAX_ITEMS) ? readMinItems : undefined;
  if (request.minItems !== undefined && minItems === undefined) dropped.push("minItems");
  // A condition that cannot be read leaves on its own, and the rest of the
  // clause still runs. An empty clause, and a clause every condition left, both
  // say what no clause says: keep every item.
  const conditions = request.where === undefined ? [] : conditionsValue(request.where, fields, dropped, assumed);
  // Which rows are the same row, and the order the rows are answered in
  // (`./order-request.ts`). Each is dropped and named when it cannot be read, as
  // a condition is: without them the read answers with the same rows, in page
  // order and with repeats, which is wider rather than wrong.
  const dedupe = request.dedupe === undefined ? undefined : webAutomationExtractListDedupeValue(request.dedupe, fields);
  if (dedupe?.refused) dropped.push("dedupe");
  const sort = request.sort === undefined ? undefined : webAutomationExtractListSortValue(request.sort, fields);
  for (const index of sort?.refused ?? []) dropped.push(`sort.${index}`);
  // Which rows the page answers (`./request.ts`). `kept` is the only value; any
  // other is dropped and named, and the read then answers as it always has,
  // which can only add the rows it rejected -- wider, never narrower.
  const answer = request.answer === WEB_AUTOMATION_EXTRACT_LIST_ANSWER_KEPT ? WEB_AUTOMATION_EXTRACT_LIST_ANSWER_KEPT : undefined;
  if (request.answer !== undefined && answer === undefined) dropped.push("answer");
  return {
    request: {
      item,
      ...(itemElement !== undefined ? { itemElement } : {}),
      fields,
      ...(paginate !== undefined ? { paginate } : {}),
      ...(maxItems !== undefined ? { maxItems } : {}),
      ...(minItems !== undefined ? { minItems } : {}),
      ...(conditions.length > 0 ? { where: conditions } : {}),
      ...(dedupe?.dedupe !== undefined ? { dedupe: dedupe.dedupe } : {}),
      ...(sort !== undefined && sort.sort.length > 0 ? { sort: sort.sort } : {}),
      ...(answer !== undefined ? { answer } : {})
    },
    dropped,
    assumed
  };
}

/**
 * The conditions an item must satisfy (C5). One condition written on its own is
 * read as a list of one, because a model asked for "the items that are not
 * sponsored" has one thing to say and writing `[{...}]` is a shape to remember
 * rather than a meaning to express.
 *
 * Every condition must name its value once and be able to read it: `field` names
 * a field of this request that is actually read -- exactly, or the nearest one
 * (`./field-match.ts`) -- since an excluded column is never read from the page
 * (D12) and a condition over it could only ever be false; `read` must be a field
 * the page can honour. **A condition that cannot be read leaves on its own**, is
 * named in `dropped`, and the conditions beside it still run: one clause the
 * model wrote badly must not cost the rows the others would have kept.
 *
 * **An empty list is no conditions, not a refusal.** `where: []` says exactly
 * what omitting `where` says -- keep every item -- and where a shape can be read
 * two ways the wider reading wins, because filtering is optional and nothing
 * about it is required to get a plain extraction. A clause every condition left
 * says the same thing, which is also what a condition naming nothing and
 * comparing nothing says: the caller sends no `where` at all rather than an
 * empty clause the page would have to interpret.
 */
function conditionsValue(
  value: unknown,
  fields: Record<string, WebAutomationExtractField>,
  dropped: WebAutomationExtractListDroppedPart[],
  assumed: WebAutomationExtractListFieldAssumption[]
): WebAutomationExtractItemCondition[] {
  const written = Array.isArray(value) ? value : [value];
  const conditions: WebAutomationExtractItemCondition[] = [];
  for (const [index, entry] of written.entries()) {
    const condition = conditionValue(entry, fields, index, assumed);
    if (condition === undefined) dropped.push(`where.${index}`);
    else conditions.push(condition);
  }
  return conditions;
}

function conditionValue(
  value: unknown,
  fields: Record<string, WebAutomationExtractField>,
  index: number,
  assumed: WebAutomationExtractListFieldAssumption[]
): WebAutomationExtractItemCondition | undefined {
  const written = jsonObject(value);
  if (!written) return undefined;
  const named = optionalValue(written.field, nonEmptyString);
  const read = optionalValue(written.read, (entry) => readableCondition(entry));
  if (named === REFUSED || read === REFUSED) return undefined;
  // One value, named once. Neither, and there is nothing to test; both, and two
  // readings of the same condition would disagree on which value it is about.
  if ((named === undefined) === (read === undefined)) return undefined;
  // What the condition says about that value is one grammar, read in one place,
  // so the page runs exactly what the plan resolver accepted
  // (`./condition-grammar.ts`). A key it cannot place drops the condition.
  const says = webAutomationExtractConditionSayingValue(written, CONDITION_NAMING_KEYS);
  if (!says.ok) return undefined;
  if (read !== undefined) return { read, ...says.says };
  const match = webAutomationExtractFieldMatch(named as string, fields, says.says);
  if (match === undefined) return undefined;
  if (match.how !== "exact") assumed.push({ index, written: named as string, field: match.field, how: match.how, score: match.score });
  return { field: match.field, ...says.says };
}

/** A condition's `read`: a field the page reads, in either form, and never one whose column handling would stop it being read. */
function readableCondition(value: unknown): WebAutomationExtractField | undefined {
  const field = fieldValue(value);
  return field !== undefined && isWebAutomationExtractFieldRead(field) ? field : undefined;
}

/** The keys that name a condition's value, which this file reads and the condition grammar leaves alone. */
const CONDITION_NAMING_KEYS: readonly string[] = ["field", "read"];

/**
 * `web.dom.extract`'s structured read (C3), copied field by field.
 *
 * `attribute` is required by the `attribute` mode and refused on every other,
 * exactly as a field spec's is: dropped, the read would return the element's
 * text where the node asked for an attribute.
 */
export function webAutomationExtractReadValue(value: unknown): WebAutomationExtractRead | undefined {
  const read = jsonObject(value);
  const mode = memberOf(read?.mode, WEB_AUTOMATION_EXTRACT_READ_MODES);
  if (!read || mode === undefined) return undefined;
  const attribute = mode === "attribute" ? nonEmptyString(read.attribute) : undefined;
  if (mode === "attribute" ? attribute === undefined : read.attribute !== undefined) return undefined;
  return { mode, ...(attribute !== undefined ? { attribute } : {}) };
}

/**
 * Every entry must be readable and keyed by a well-formed record field key
 * (D16): a map with one unusable entry would extract a column of nothing, and
 * Core refuses a dataset over one bad key. A map whose every field is excluded
 * (D12) reads nothing at all, so it is refused whole too.
 */
function fieldMapValue(value: unknown): Record<string, WebAutomationExtractField> | undefined {
  const fields = jsonObject(value);
  if (!fields) return undefined;
  const read: [string, WebAutomationExtractField][] = [];
  for (const [key, entry] of Object.entries(fields)) {
    const field = isWebAutomationExtractFieldKey(key) ? fieldValue(entry) : undefined;
    if (field === undefined) return undefined;
    read.push([key, field]);
  }
  if (read.length === 0 || read.every(([, field]) => typeof field !== "string" && field.handling === "exclude")) return undefined;
  return Object.fromEntries(read);
}

/**
 * Today's string grammar, or a spec copied field by field. A spec property that
 * is sent but unreadable refuses the field rather than being dropped.
 *
 * **The field is read by its kind, and a member its kind does not take is left
 * behind** -- an `attribute` on anything but an `attribute` field, a `header` on
 * anything but a `column` field. Until 2026-10-01 such a member refused the
 * field, and with it the whole request. The case that mattered was not a slip
 * the model made but one the rerun made for it: Core's rerun merge patches a
 * changed kind over the old spec, and a `column` field's member is `header`, not
 * `column`, so `{kind: "text"}` over `{kind: "column", header}` arrived as a
 * `text` field still carrying `header` (t194-w42, cause 6a). The kind is what
 * the model chose; a member that kind never reads changes nothing the page
 * would do, so refusing the field over it refused a read the model asked for.
 * The member is absent from the request this returns, and so from every copy
 * built from it -- the command the gateway lifts among them. A kind that
 * *needs* its member and lacks it -- an `attribute` field naming no attribute,
 * a `column` field naming no header -- still cannot execute and is still
 * refused. The same holds for a condition's `read`, which is read here too.
 */
function fieldValue(value: unknown): WebAutomationExtractField | undefined {
  if (typeof value === "string") return value.length > 0 ? value : undefined;
  const spec = jsonObject(value);
  const kind = memberOf(spec?.kind, WEB_AUTOMATION_EXTRACT_FIELD_KINDS);
  if (!spec || kind === undefined) return undefined;
  const attribute = kind === "attribute" ? nonEmptyString(spec.attribute) : undefined;
  const header = kind === "column" ? nonEmptyString(spec.header) : undefined;
  if (kind === "attribute" && attribute === undefined) return undefined;
  if (kind === "column" && header === undefined) return undefined;
  const selector = optionalValue(spec.selector, nonEmptyString);
  const required = optionalValue(spec.required, booleanValue);
  const handling = optionalValue(spec.handling, (entry) => memberOf(entry, WEB_AUTOMATION_EXTRACT_FIELD_HANDLINGS));
  const element = optionalValue(spec.element, fingerprintValue);
  if (selector === REFUSED || required === REFUSED || handling === REFUSED || element === REFUSED) return undefined;
  const field: WebAutomationExtractFieldSpec = {
    kind,
    ...(selector !== undefined ? { selector } : {}),
    ...(attribute !== undefined ? { attribute } : {}),
    ...(header !== undefined ? { header } : {}),
    ...(required !== undefined ? { required } : {}),
    ...(handling !== undefined ? { handling } : {}),
    ...(element !== undefined ? { element } : {})
  };
  return field;
}

/**
 * Read by `mode`, and an absent mode is `next`, which leaves in today's shape.
 * A mode missing its own control or bound, or carrying another mode's key, is
 * refused. Every bound is held to the domain's page bound, the one the scenario
 * contract and the page-side reader also apply, so no Flow pages forever.
 */
function paginationValue(value: unknown): WebAutomationExtractListPagination | undefined {
  const paginate = jsonObject(value);
  if (!paginate) return undefined;
  const mode = paginate.mode === undefined ? "next" : memberOf(paginate.mode, WEB_AUTOMATION_EXTRACT_PAGINATION_MODES);
  if (mode === undefined) return undefined;
  const ownKeys = PAGINATION_KEYS[mode];
  if (Object.values(PAGINATION_KEYS).flat().some((key) => !(ownKeys as readonly string[]).includes(key) && paginate[key] !== undefined)) return undefined;
  if (mode === "scroll") {
    const maxScrolls = positiveInteger(paginate.maxScrolls);
    return maxScrolls === undefined ? undefined : { mode, maxScrolls: Math.min(maxScrolls, WEB_AUTOMATION_EXTRACT_MAX_PAGES) };
  }
  const requestedPages = positiveInteger(paginate.maxPages);
  if (requestedPages === undefined) return undefined;
  const maxPages = Math.min(requestedPages, WEB_AUTOMATION_EXTRACT_MAX_PAGES);
  if (mode === "next") {
    const next = nonEmptyString(paginate.next);
    return next === undefined ? undefined : { next, maxPages };
  }
  if (mode === "loadMore") {
    const control = nonEmptyString(paginate.control);
    return control === undefined ? undefined : { mode, control, maxPages };
  }
  const pages = nonEmptyString(paginate.pages);
  return pages === undefined ? undefined : { mode, pages, maxPages };
}

/**
 * The names a caller reaches for when it means to aim an extraction at a frame.
 * Every one of them is foreign to a request, because the frame is the
 * command's (`request.ts`); a request carrying one is refused whole.
 */
const FRAME_KEYS = ["frame", "frameId", "frameSelector", "frameUrlPath"] as const;

/** Each pagination mode's own keys. A key listed only under another mode is foreign to this one. */
const PAGINATION_KEYS = {
  next: ["next", "maxPages"],
  loadMore: ["control", "maxPages"],
  scroll: ["maxScrolls"],
  numbered: ["pages", "maxPages"]
} as const satisfies Record<(typeof WEB_AUTOMATION_EXTRACT_PAGINATION_MODES)[number], readonly string[]>;

/**
 * A recorded element, normalized by the one fingerprint normalizer that put it
 * on the wire. An object with no signal it recognizes is not an identity.
 */
function fingerprintValue(value: unknown): WebAutomationElementFingerprint | undefined {
  const fingerprint = elementFingerprint(value);
  return fingerprint !== undefined && Object.keys(fingerprint).length > 0 ? fingerprint : undefined;
}

/** Marks an optional value that was sent but could not be read, as distinct from one never sent. */
const REFUSED = Symbol("refused");

function optionalValue<T>(value: unknown, read: (entry: unknown) => T | undefined): T | undefined | typeof REFUSED {
  if (value === undefined) return undefined;
  const readable = read(value);
  return readable === undefined ? REFUSED : readable;
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function nonNegativeInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function positiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function memberOf<T extends string>(value: unknown, members: readonly T[]): T | undefined {
  return typeof value === "string" && (members as readonly string[]).includes(value) ? value as T : undefined;
}

function jsonObject(value: unknown): JsonObject | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : undefined;
}
