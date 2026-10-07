// Reading `web.dom.next_page`'s request off an untrusted value: the node's
// parameter, which a model's plan or an author wrote, and the gateway
// command's, which the extension runs.
//
// Nothing is coerced and nothing is dropped. A request is refused whole for an
// unknown key, an empty selector, an unknown mode, a mode carrying another
// mode's control, and above all for a bound of any kind: `maxPages` or
// `maxScrolls` here means a read's pagination was copied onto a step that moves
// one page, and moving one page while the author believed it would read three
// is a wrong answer nothing would report. The resolver that writes this request
// from a detected list drops the bound itself (contract C2).
//
// `elementFingerprint` comes from the `output-nodes/targets` leaf, for the
// reason `../extraction/read-request.ts` gives: any wider import would close a
// runtime cycle through `actions/schemas.ts`.

import type { JsonObject } from "fluxiq/core";
import { elementFingerprint } from "../../output-nodes/targets";
import type { WebAutomationElementFingerprint } from "../types";
import type { WebAutomationNextPageRequest, WebAutomationNextPageWay } from "./request";
import { WEB_AUTOMATION_NEXT_PAGE_WORDS } from "./words";

/** The request the page would run, or `undefined` for a value that is not one. */
export function webAutomationNextPageRequestValue(value: unknown): WebAutomationNextPageRequest | undefined {
  const request = jsonObject(value);
  if (!request || !onlyKeys(request, REQUEST_KEYS)) return undefined;
  const item = selectorValue(request.item);
  if (item === undefined) return undefined;
  const itemElement = request.itemElement === undefined ? undefined : fingerprintValue(request.itemElement);
  if (request.itemElement !== undefined && itemElement === undefined) return undefined;
  const pagination = request.pagination === undefined ? undefined : wayValue(request.pagination);
  if (request.pagination !== undefined && pagination === undefined) return undefined;
  return {
    item,
    ...(itemElement !== undefined ? { itemElement } : {}),
    ...(pagination !== undefined ? { pagination } : {})
  };
}

const REQUEST_KEYS: readonly string[] = ["item", "itemElement", "pagination"];

/** Each mode's own keys beside `mode`. Anything else -- another mode's control, a bound -- refuses the way. */
const WAY_KEYS = {
  next: ["next"],
  loadMore: ["control"],
  scroll: [],
  numbered: ["pages"]
} as const satisfies Record<(typeof WEB_AUTOMATION_NEXT_PAGE_WORDS.modes)[number], readonly string[]>;

function wayValue(value: unknown): WebAutomationNextPageWay | undefined {
  const way = jsonObject(value);
  if (!way) return undefined;
  const mode = way.mode === undefined ? "next" : memberOf(way.mode, WEB_AUTOMATION_NEXT_PAGE_WORDS.modes);
  if (mode === undefined || !onlyKeys(way, ["mode", ...WAY_KEYS[mode]])) return undefined;
  if (mode === "scroll") return { mode };
  if (mode === "next") {
    const next = selectorValue(way.next);
    // An absent mode stays absent, so the request reads back as it was written.
    return next === undefined ? undefined : way.mode === undefined ? { next } : { mode, next };
  }
  if (mode === "loadMore") {
    const control = selectorValue(way.control);
    return control === undefined ? undefined : { mode, control };
  }
  const pages = selectorValue(way.pages);
  return pages === undefined ? undefined : { mode, pages };
}

/** A recorded element, normalized by the one fingerprint normalizer; an object with no signal it recognizes is not an identity. */
function fingerprintValue(value: unknown): WebAutomationElementFingerprint | undefined {
  const fingerprint = elementFingerprint(value);
  return fingerprint !== undefined && Object.keys(fingerprint).length > 0 ? fingerprint : undefined;
}

function onlyKeys(value: JsonObject, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

/** A selector names something only when it holds more than white space. */
function selectorValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function memberOf<T extends string>(value: unknown, members: readonly T[]): T | undefined {
  return typeof value === "string" && (members as readonly string[]).includes(value) ? value as T : undefined;
}

function jsonObject(value: unknown): JsonObject | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : undefined;
}
