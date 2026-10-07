// The code a list read sends Core as its draft statement's `reads`: which list
// on which page it read, opaque, so Core can tell a second read of a list the
// Flow already reads from a read of another one.
//
// Core compares codes for equality and nothing else
// (`AS/runtime/flow-draft/second-copy.ts`): a read joining the Flow with the
// code of a kept read, with no kept step changing anything between them, is
// not added. Live run `run-muq4oaof-464f5bce` (cause 3) kept two reads of one
// list. Core withholds a code that is not `/^[a-z0-9_.:-]{1,100}$/i`, so this
// one is `list:` and a hex digest.
//
// **What it is made of decides what counts as "the same list".**
//
// - The page's origin and path, never its query or hash: page 1 and page 5 of
//   one search are one page with one list, and a reload keeps both.
// - The list as the read *ran* with it: the resolved item selector the
//   resolver wrote into `extractList.item` (`../../plan-resolution/extraction/`).
//   Never the model's `extraction.N` handle, which a detection after a reload
//   numbers afresh, and never `fields`, `where`, `sort` or `paginate`, which
//   say how the list was read rather than which list it is -- a second read of
//   one list with other columns or conditions is still the same list.
//
// A read whose list or page cannot be named this way sends no code, which
// Core reads as "not known to be a copy". Every other node sends none.

import { createHash } from "node:crypto";
import type { JsonObject } from "fluxiq/core";
import { isJsonRecord } from "../../untrusted-json";

/** The node that reads a list (`../call-words.ts` names it the same way). */
const LIST_NODE = "web.output.dom-extract_list";
/** The parameter a list read names its list in. */
const EXTRACTION_SLOT = "extractList";
/** Hex digits of the digest kept: 64 bits, far past any build's count of lists. */
const DIGEST_LENGTH = 16;

/**
 * The code of the list a read of `nodeId` read on the page at `location`, with
 * the parameters it ran with (`ran`, resolved); `undefined` for any other node,
 * and for a read whose page or list identity cannot be found.
 */
export function webListReadCode(nodeId: string, location: string | undefined, ran: JsonObject): string | undefined {
  if (nodeId !== LIST_NODE || location === undefined) return undefined;
  const list = ran[EXTRACTION_SLOT];
  const item = isJsonRecord(list) ? list.item : undefined;
  if (typeof item !== "string" || item.trim() === "") return undefined;
  // A location that is no address, or one with no origin (`about:blank`, `data:`), names no page.
  if (!URL.canParse(location)) return undefined;
  const url = new URL(location);
  if (url.origin === "null") return undefined;
  return `list:${createHash("sha256").update(`${url.origin}${url.pathname}\0${item.trim()}`).digest("hex").slice(0, DIGEST_LENGTH)}`;
}
