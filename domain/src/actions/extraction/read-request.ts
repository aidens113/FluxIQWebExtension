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
// Nothing here coerces, and nothing is dropped quietly. A value of the wrong
// shape is refused, and a property that was **sent but cannot be read** refuses
// the whole request rather than leaving: dropped, the page would read something
// other than what the request names, and report success having done it.
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
import {
  WEB_AUTOMATION_EXTRACT_FIELD_HANDLINGS,
  WEB_AUTOMATION_EXTRACT_FIELD_KINDS,
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
 * A list extraction needs both the item selector and the field map; a
 * `paginate` that is present but malformed refuses the whole request rather
 * than quietly reading one page of a request that asked for several.
 *
 * `maxItems` is held to the domain's record bound, as `maxPages` is to its page
 * bound. `minItems` is refused whole the same way `paginate` is when it is sent
 * but unreadable: dropped, the page would apply its default of 1 to a Flow that
 * asked for 0, and fail a read that was allowed to be empty. A minimum above the
 * maximum -- the one named, or the bound when none is -- is refused whole too,
 * because no page could ever satisfy it.
 */
export function webAutomationExtractListRequestValue(value: unknown): WebAutomationExtractListRequest | undefined {
  const request = jsonObject(value);
  const item = nonEmptyString(request?.item);
  const fields = fieldMapValue(request?.fields);
  if (!request || item === undefined || fields === undefined) return undefined;
  // A request that names a frame is refused whole rather than read without it.
  // Extraction takes its frame from the command, never from the request
  // (`request.ts`), so none of these names is a request property. Dropped, the
  // read would run against the document it was delivered to while its author
  // believed it had named another, and report success having done it -- which
  // is the silent answer every refusal in this file exists to avoid.
  if (FRAME_KEYS.some((key) => request[key] !== undefined)) return undefined;
  // The element the item selector was generalized from. Sent but unreadable, the
  // request is refused whole: dropped, the page would lose the identity it was
  // recorded with and match on the selector alone.
  const itemElement = optionalValue(request.itemElement, fingerprintValue);
  if (itemElement === REFUSED) return undefined;
  const paginate = request.paginate === undefined ? undefined : paginationValue(request.paginate);
  if (request.paginate !== undefined && paginate === undefined) return undefined;
  const namedMaxItems = positiveInteger(request.maxItems);
  const maxItems = namedMaxItems === undefined ? undefined : Math.min(namedMaxItems, WEB_AUTOMATION_EXTRACT_MAX_ITEMS);
  const minItems = nonNegativeInteger(request.minItems);
  if (request.minItems !== undefined && minItems === undefined) return undefined;
  if (minItems !== undefined && minItems > (maxItems ?? WEB_AUTOMATION_EXTRACT_MAX_ITEMS)) return undefined;
  // Sent but unreadable refuses the whole request, as `paginate` does and for
  // the same reason: dropped, the page would read every item of a run the
  // author asked it to narrow, and report success having done it. An empty
  // clause is not unreadable -- it says what no clause says -- and leaves.
  const where = request.where === undefined ? undefined : conditionsValue(request.where, fields);
  if (request.where !== undefined && where === undefined) return undefined;
  const conditions = where === NONE ? undefined : where;
  return {
    item,
    ...(itemElement !== undefined ? { itemElement } : {}),
    fields,
    ...(paginate !== undefined ? { paginate } : {}),
    ...(maxItems !== undefined ? { maxItems } : {}),
    ...(minItems !== undefined ? { minItems } : {}),
    ...(conditions !== undefined ? { where: conditions } : {})
  };
}

/** A `where` that was written and says nothing, as distinct from one that could not be read. */
const NONE = Symbol("no conditions");

/**
 * The conditions an item must satisfy (C5). One condition written on its own is
 * read as a list of one, because a model asked for "the items that are not
 * sponsored" has one thing to say and writing `[{...}]` is a shape to remember
 * rather than a meaning to express.
 *
 * Every condition must name its value once and be able to read it: `field` must
 * name a field of this request that is actually read, since an excluded column
 * is never read from the page (D12) and a condition over it could only ever be
 * false; `read` must be a field the page can honour. A list holding one
 * unreadable condition refuses the whole request.
 *
 * **An empty list is no conditions, not a refusal**, and it used to be the
 * latter. `where: []` says exactly what omitting `where` says -- keep every item
 * -- and where a shape can be read two ways the wider reading wins, because
 * filtering is optional and nothing about it is required to get a plain
 * extraction. `NONE` is how that reaches the caller, which drops `where` from
 * the request rather than sending an empty clause the page would have to
 * interpret.
 */
function conditionsValue(value: unknown, fields: Record<string, WebAutomationExtractField>): WebAutomationExtractItemCondition[] | typeof NONE | undefined {
  const written = Array.isArray(value) ? value : [value];
  if (written.length === 0) return NONE;
  const conditions: WebAutomationExtractItemCondition[] = [];
  for (const entry of written) {
    const condition = conditionValue(entry, fields);
    if (condition === undefined) return undefined;
    conditions.push(condition);
  }
  return conditions;
}

function conditionValue(value: unknown, fields: Record<string, WebAutomationExtractField>): WebAutomationExtractItemCondition | undefined {
  const written = jsonObject(value);
  if (!written) return undefined;
  const field = optionalValue(written.field, (entry) => readableFieldKey(entry, fields));
  const read = optionalValue(written.read, (entry) => readableCondition(entry));
  if (field === REFUSED || read === REFUSED) return undefined;
  // One value, named once. Neither, and there is nothing to test; both, and two
  // readings of the same condition would disagree on which value it is about.
  if ((field === undefined) === (read === undefined)) return undefined;
  // What the condition says about that value is one grammar, read in one place,
  // so the page runs exactly what the plan resolver accepted
  // (`./condition-grammar.ts`). A key it cannot place refuses the condition,
  // which is what refuses the whole request.
  const says = webAutomationExtractConditionSayingValue(written, CONDITION_NAMING_KEYS);
  if (!says.ok) return undefined;
  return {
    ...(field !== undefined ? { field } : {}),
    ...(read !== undefined ? { read } : {}),
    ...says.says
  };
}

/** A condition's `field`: a key this request reads. A key it excludes is never read, so a condition over it could only be false. */
function readableFieldKey(value: unknown, fields: Record<string, WebAutomationExtractField>): string | undefined {
  const key = nonEmptyString(value);
  if (key === undefined || !Object.hasOwn(fields, key)) return undefined;
  const field = fields[key];
  return field !== undefined && (typeof field === "string" || field.handling === undefined || field.handling === "include") ? key : undefined;
}

/** A condition's `read`: a field the page reads, in either form, and never one whose column handling would stop it being read. */
function readableCondition(value: unknown): WebAutomationExtractField | undefined {
  const field = fieldValue(value);
  if (field === undefined) return undefined;
  return typeof field === "string" || field.handling === undefined || field.handling === "include" ? field : undefined;
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
 * is sent but unreadable refuses the field rather than being dropped, and so
 * does an `attribute` or `header` on a kind that does not read one: dropped,
 * the page would read something other than what the field names.
 */
function fieldValue(value: unknown): WebAutomationExtractField | undefined {
  if (typeof value === "string") return value.length > 0 ? value : undefined;
  const spec = jsonObject(value);
  const kind = memberOf(spec?.kind, WEB_AUTOMATION_EXTRACT_FIELD_KINDS);
  if (!spec || kind === undefined) return undefined;
  const attribute = kind === "attribute" ? nonEmptyString(spec.attribute) : undefined;
  const header = kind === "column" ? nonEmptyString(spec.header) : undefined;
  if (kind === "attribute" ? attribute === undefined : spec.attribute !== undefined) return undefined;
  if (kind === "column" ? header === undefined : spec.header !== undefined) return undefined;
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
