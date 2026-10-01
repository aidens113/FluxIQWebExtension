// The key any result the model read a page through is retained by (t223): its
// location and the one text it printed the page's handles in -- a page's
// `page`, a search's `found` or a description's `element`.
//
// Core hands a result back without saying where it came from: a repair names a
// handle "from" a failure page or an explored one, and the target check is
// given that result as the model saw it. The structured packet behind it was
// retained under this same key when the result was made, so the handle is
// checked against the elements the model was actually shown.

import { webLlmPageRetentionKey } from "./retention-key";

const TEXT_KEYS = ["page", "found", "element"] as const;

/** `location + " " + text` for a result that carries both, else `undefined`. */
export function webLlmResultRetentionKey(result: unknown): string | undefined {
  if (!result || typeof result !== "object" || Array.isArray(result)) return undefined;
  const record = result as Record<string, unknown>;
  if (typeof record.location !== "string") return undefined;
  for (const key of TEXT_KEYS) {
    const text = record[key];
    if (typeof text === "string") return webLlmPageRetentionKey({ location: record.location, page: text });
  }
  return undefined;
}
