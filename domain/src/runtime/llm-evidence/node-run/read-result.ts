// What a node that reads gives back to the model, whole but for its secrets.
//
// A node that acts is judged by the page it produced, which the packet already
// carries. A node that reads is judged by what it read -- and that is the whole
// point of running it while exploring: an extraction the model can see the rows
// of is an extraction it can tell is wrong before the Flow ships with it.
//
// So a read's payload comes back whole (t200): every row, every field, every
// string. Until 2026-09-30 strings were cut to 200 characters, lists to eight
// items, objects to 24 keys, depth to six, and the whole to a quarter of the
// call's byte budget, so a model checking an extraction of fifty rows saw
// three. What still never travels is a key this domain denies (`tools.ts`,
// `deniedEvidenceKeys`) -- a field the model itself named `selector` would
// otherwise put one on the wire and Core would refuse the whole packet -- and a
// string shaped like a credential, which becomes the marker (`../withheld.ts`).

import type { JsonObject, JsonValue } from "fluxiq/core";
import { webLlmEvidenceKeyIsDenied } from "../denied-keys";
import { screenedText } from "../withheld";

/** One read's payload, screened, or nothing when there is nothing to show. */
export function webNodeReadResult(payload: JsonValue | undefined): JsonValue | undefined {
  if (payload === undefined || payload === null) return undefined;
  return screened(payload);
}

function screened(value: JsonValue): JsonValue {
  if (typeof value === "string") return screenedText(value);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) return value.map(screened);
  const out: JsonObject = {};
  for (const [key, entry] of Object.entries(value)) {
    // Core refuses the whole decision request for one denied key anywhere in
    // the evidence, so a read is held to the declaration before it is
    // returned rather than after (`../denied-keys.ts`).
    if (webLlmEvidenceKeyIsDenied(key) || entry === undefined) continue;
    // Core's credential check reads keys as well as values.
    out[screenedText(key)] = screened(entry as JsonValue);
  }
  return out;
}
