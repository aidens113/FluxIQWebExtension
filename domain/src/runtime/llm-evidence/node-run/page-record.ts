// What of a node's payload is the page's own record rather than the node's
// answer, kept out of what the model is shown.
//
// Every command the extension runs answers in one shape
// (`client/gateway-mapping.ts`, `webAutomationActionResultPayload`), and that
// shape carries, beside what the node did or read, the extension's own record
// of the page:
//
// - `snapshot`: the page before any of this domain's sanitizing -- every
//   interactive element with its selector, xpath, class names and attributes.
//   The extension attaches one to every press, type and navigation while
//   snapshot capture is on, which it is by default.
// - `element`: the control the node acted on, with its xpath and class names.
// - `visualTarget` and `resolution`: how that control was located on the page.
// - `structure`: what a look's structure detection found, selectors included.
//
// Until 2026-09-30 a node's read was cut to eight items six levels deep, so a
// press handed the model a few of these elements. Once reads came back whole
// (t200) a press handed it the whole raw page beside the sanitized packet:
// `run-mup2i28c-6c7fc209`'s `dismiss.privacy` press returned 316 sanitized
// elements and the same 316 raw, 199,305 bytes of them, and every later
// decision carried both. That was the one path by which a page's own markup
// reached a decision.
//
// **Only the page's record goes.** These keys are removed whole wherever a
// node returns them; everything else the node answered -- an extraction's rows
// and account, a read value, a dialog, a cleared wait, the validation's
// wording, the address the page ended on -- is left exactly as it came, so a
// read is still shown whole. The packet beside the read is the page, sanitized,
// with handles the model can act on. What is recorded for the replay is not
// touched (`./replay.ts`).
//
// **A cleared layer's way out is the page's record too** (lane 2,
// `run-mvcxf4uz-64cd322c`). Each `clearedLayers` entry may carry `wayOut`: the
// page's address and the pressed control's descriptor, xpath included. Its rule
// is that it stops at this domain's server half (`../../../actions/cleared-layers.ts`):
// the dispatcher hands Core only an opaque reference. A press made while
// exploring answered the model with it whole, which was rare while every
// covered press was refused, and is not once the runtime clears a dismissible
// cover first (`./layer/runtime-clears.ts`). So it is removed here; the layer's
// kind, the allow-list word and the two names stay.

import type { JsonObject, JsonValue } from "fluxiq/core";

/** The payload keys that hold the extension's record of the page rather than the node's answer. */
const PAGE_RECORD_KEYS: ReadonlySet<string> = new Set(["snapshot", "element", "visualTarget", "resolution", "structure"]);

/** The payload key listing what the runtime cleared, and the member of each entry that is the page's record. */
const CLEARED_LAYERS_KEY = "clearedLayers";
const WAY_OUT_KEY = "wayOut";

/**
 * A node's payload without the page's own record, or nothing when that record
 * was all it held. Anything that is not an object is returned as it came.
 */
export function webNodeWithoutPageRecord(payload: JsonValue | undefined): JsonValue | undefined {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return payload;
  const kept: JsonObject = {};
  let removed = false;
  for (const [key, value] of Object.entries(payload)) {
    if (PAGE_RECORD_KEYS.has(key)) {
      removed = true;
      continue;
    }
    if (key === CLEARED_LAYERS_KEY && Array.isArray(value) && value.some(holdsWayOut)) {
      removed = true;
      kept[key] = value.map(withoutWayOut);
      continue;
    }
    kept[key] = value;
  }
  if (!removed) return payload;
  return Object.keys(kept).length === 0 ? undefined : kept;
}

function holdsWayOut(entry: JsonValue): boolean {
  return typeof entry === "object" && entry !== null && !Array.isArray(entry) && WAY_OUT_KEY in entry;
}

/** A cleared layer as the model reads it: everything but its way out. */
function withoutWayOut(entry: JsonValue): JsonValue {
  if (!holdsWayOut(entry)) return entry;
  const { [WAY_OUT_KEY]: _wayOut, ...rest } = entry as JsonObject;
  return rest;
}
