// What a node that reads gives back to the model, bounded and stripped.
//
// A node that acts is judged by the page it produced, which the packet already
// carries. A node that reads is judged by what it read -- and that is the whole
// point of running it while exploring: an extraction the model can see the rows
// of is an extraction it can tell is wrong before the Flow ships with it.
//
// So a read's payload comes back, and it comes back through the same discipline
// every other piece of page data goes through. Keys this domain denies never
// travel (`tools.ts`, `deniedEvidenceKeys`) -- a field the model itself named
// `selector` would otherwise put one on the wire and Core would refuse the
// whole packet. Strings are cut, lists are cut and counted, depth is bounded,
// and the whole thing is held to a byte budget with what was left out said
// plainly rather than silently absent.

import type { JsonObject, JsonValue } from "fluxiq/core";
import { webLlmEvidenceKeyIsDenied } from "../denied-keys";
import { serializedBytes } from "../limits";

const MAX_DEPTH = 6;
const MAX_STRING = 200;
const MAX_ITEMS = 8;
const MAX_KEYS = 24;

/**
 * One read's payload, bounded to `maxBytes`, or nothing when there is nothing
 * to show or no room to show it.
 *
 * Shrinks by showing fewer list items rather than by cutting the JSON, so what
 * arrives is always well formed and always says how much of the list it is.
 */
export function webNodeReadResult(payload: JsonValue | undefined, maxBytes: number): JsonValue | undefined {
  if (payload === undefined || payload === null) return undefined;
  for (const items of [MAX_ITEMS, 4, 2, 1, 0]) {
    const bounded = bound(payload, 0, items);
    if (bounded === undefined) return undefined;
    if (serializedBytes(bounded) <= maxBytes) return bounded;
  }
  return undefined;
}

function bound(value: JsonValue, depth: number, items: number): JsonValue | undefined {
  if (depth > MAX_DEPTH) return undefined;
  if (typeof value === "string") return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}...` : value;
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) {
    const shown = value.slice(0, items).flatMap((entry) => {
      const kept = bound(entry, depth + 1, items);
      return kept === undefined ? [] : [kept];
    });
    // The count is the fact that matters about a list: an extraction that read
    // three rows where fifty were wanted is wrong, and only the count says so.
    return value.length > shown.length ? { count: value.length, shown } : shown;
  }
  if (typeof value !== "object") return undefined;
  const out: JsonObject = {};
  let keys = 0;
  for (const [key, entry] of Object.entries(value)) {
    // Core refuses the whole decision request for one denied key anywhere in
    // the evidence, so a read is held to the declaration before it is
    // returned rather than after (`../denied-keys.ts`).
    if (webLlmEvidenceKeyIsDenied(key)) continue;
    if (keys >= MAX_KEYS) break;
    const kept = bound(entry as JsonValue, depth + 1, items);
    if (kept === undefined) continue;
    out[key] = kept;
    keys += 1;
  }
  return out;
}
