// A node call's handles in the shape the plan resolver reads: a handle written
// bare -- `selector: t3`, the shape the Flow script writes and a model reaches
// for -- is put into `{handle}` before anything else reads the call
// (`../run.ts`). Its own module so the run reads as the steps of a call.

import type { JsonObject, JsonValue } from "fluxiq/core";
import { canonicalWebLlmTargetHandle } from "../../handle-spelling";
import { WEB_LLM_EXTRACTION_HANDLE_PATTERN } from "../../structure";

const EXTRACTION_HANDLE = new RegExp(WEB_LLM_EXTRACTION_HANDLE_PATTERN, "u");
/**
 * The slots a handle may be written in, the one it is kept in, and the shape a
 * refusal names.
 *
 * It is kept in `target` rather than `selector` for a reason that is not
 * cosmetic: `selector` is a key this domain *denies*, so a call written with
 * one cannot be shown back to the model in the draft without Core refusing the
 * whole request. `target` is the slot the Flow script's own examples use, the
 * resolver reads a handle in either, and a resolved `target` handle writes the
 * selector and the element identity anyway.
 */
const ELEMENT_SLOTS = ["selector", "target", "element"];
const KEPT_ELEMENT_SLOT = "target";
const EXTRACTION_SLOT = "extractList";

/**
 * The call's parameters with every bare handle put into the shape the resolver
 * reads.
 *
 * Only in the slots a handle belongs in, and only for a token this domain
 * actually mints. Everything else is left exactly as written, because guessing
 * that some other string was meant to be a handle is the kind of inference this
 * whole design removes.
 */
export function webNodeWithHandleShape(parameters: JsonObject): JsonObject {
  const out: JsonObject = { ...parameters };
  const extraction = out[EXTRACTION_SLOT];
  if (typeof extraction === "string" && EXTRACTION_HANDLE.test(extraction)) out[EXTRACTION_SLOT] = { handle: extraction };
  for (const slot of ELEMENT_SLOTS) {
    const handle = elementHandle(out[slot]);
    if (handle === undefined) continue;
    delete out[slot];
    out[KEPT_ELEMENT_SLOT] = { handle };
    break;
  }
  return out;
}

/**
 * The target handle a value names, written bare or in the resolver's shape, in
 * the one spelling the domain issues: `target.N` is kept as `tN`, so the draft
 * shows the model the spelling every packet does.
 */
function elementHandle(value: JsonValue | undefined): string | undefined {
  if (typeof value === "string") return canonicalWebLlmTargetHandle(value);
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return canonicalWebLlmTargetHandle((value as JsonObject).handle);
}
