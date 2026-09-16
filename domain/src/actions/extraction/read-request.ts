// Reading an extraction request off an untrusted value: the field map, the
// pagination, and the single-value read.
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
  return {
    item,
    ...(itemElement !== undefined ? { itemElement } : {}),
    fields,
    ...(paginate !== undefined ? { paginate } : {}),
    ...(maxItems !== undefined ? { maxItems } : {}),
    ...(minItems !== undefined ? { minItems } : {})
  };
}

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
