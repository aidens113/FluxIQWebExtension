// Which of this domain's handles a plan value names, and where.
//
// A model is shown two kinds of opaque handle: `target.N` for an element an
// evidence packet described, and `extraction.N` for a list the detection tool
// found (`structure/handles.ts`). The plan resolver accepts each only in the
// places it knows how to make real, and refuses one written anywhere else as
// misplaced, saying where it was. Both need the same test for "is this one of
// ours", so it is here once.

import { WEB_LLM_EXTRACTION_HANDLE_PATTERN } from "../structure";
import { isJsonRecord } from "../untrusted-json";

export type WebPlanHandleKind = "target" | "extraction";

/** Keys and array indexes from a value down to something inside it. */
export type WebPlanValuePath = Array<string | number>;

const TARGET_HANDLE = /^target\.[1-9][0-9]?$/u;
const EXTRACTION_HANDLE = new RegExp(WEB_LLM_EXTRACTION_HANDLE_PATTERN, "u");
/** How deep a parameter is searched for a handle written somewhere no handle belongs. */
const MAX_SEARCH_DEPTH = 8;

/** The kind of handle a token is, or `undefined` when it is not one this domain issues. */
export function webPlanHandleKind(token: unknown): WebPlanHandleKind | undefined {
  if (typeof token !== "string") return undefined;
  if (TARGET_HANDLE.test(token)) return "target";
  return EXTRACTION_HANDLE.test(token) ? "extraction" : undefined;
}

/** Every handle a value names in an object's `handle`, at any depth, with where it is, in document order. */
export function webPlanHandlesIn(value: unknown, path: WebPlanValuePath = []): Array<{ kind: WebPlanHandleKind; path: WebPlanValuePath }> {
  if (path.length > MAX_SEARCH_DEPTH) return [];
  const found: Array<{ kind: WebPlanHandleKind; path: WebPlanValuePath }> = [];
  if (Array.isArray(value)) {
    value.forEach((entry, index) => found.push(...webPlanHandlesIn(entry, [...path, index])));
    return found;
  }
  if (!isJsonRecord(value)) return found;
  const own = webPlanHandleKind(value.handle);
  if (own) found.push({ kind: own, path });
  for (const [key, entry] of Object.entries(value)) found.push(...webPlanHandlesIn(entry, [...path, key]));
  return found;
}
