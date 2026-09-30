// A literal `extractList` that is the Flow's own detected list, written down
// resolved, rather than a guess.
//
// Once a Flow's exploration has been shown a detected list, the resolver
// refuses a literal extraction as `extraction_required`: a model shown only a
// handle that writes selectors can only have guessed them
// (`./resolve-plan-node.ts`). But a Flow keeps the *resolved* request, not the
// handle, and a Flow read back as a draft (the re-author's,
// `AS/runtime/llm/node-tools/draft-from-flow.ts`) hands that literal back. On
// `run-munnhi5q-4867dabe`, 2026-09-29, every rerun of the refuted Flow's own
// extraction step was refused that way, as it stood and amended, and the
// re-author never saw one record its step read.
//
// So a literal whose `item` is the item selector of a list this project and
// Flow detected, in the same frame, names that list: it is not refused. The
// model was shown the step with every `selector` withheld
// (`AS/runtime/llm/harness/draft-screen.ts`), so a field it rewrote comes back
// without one, and a field spec without a selector reads the item itself. Each
// such field gets back exactly the selector its key already had -- the key the
// detection gave the column, or a key a plan of this Flow wrote it under --
// when the kind, and the attribute where the field names one, are the same.
// Nothing is guessed: a key no column answers to, or a kind the column is not,
// is left exactly as written.

import type { JsonObject, JsonValue } from "fluxiq/core";
import type { WebLlmExtractionHandles, WebLlmExtractionHandleScope } from "../structure";
import { isJsonRecord } from "../untrusted-json";

/**
 * `undefined` when `value` does not name a list this project and Flow
 * detected; otherwise the value to run, which is `value` itself when nothing
 * was withheld from it.
 */
export function webPlanOwnExtractionList(
  value: unknown,
  frameId: number | undefined,
  scope: WebLlmExtractionHandleScope,
  extractions: WebLlmExtractionHandles
): JsonValue | undefined {
  if (!isJsonRecord(value) || typeof value.item !== "string") return undefined;
  const known = extractions.ownList(scope, value.item, frameId);
  if (known === undefined) return undefined;
  const fields = value.fields;
  if (!isJsonRecord(fields)) return value as JsonObject;
  const restored: JsonObject = {};
  let changed = false;
  for (const [key, spec] of Object.entries(fields)) {
    const selector = withheldSelector(spec, known[key]);
    if (selector === undefined) {
      restored[key] = spec as JsonValue;
      continue;
    }
    const field = structuredClone(spec) as JsonObject;
    field.selector = selector;
    restored[key] = field;
    changed = true;
  }
  if (!changed) return value as JsonObject;
  const written = structuredClone(value) as JsonObject;
  written.fields = restored;
  return written;
}

/** The selector a field was shown without, when its key's column has exactly one to give back. */
function withheldSelector(spec: unknown, column: unknown): string | undefined {
  if (!isJsonRecord(spec) || Object.hasOwn(spec, "selector") || !isJsonRecord(column)) return undefined;
  if (typeof column.selector !== "string" || spec.kind !== column.kind) return undefined;
  if (spec.attribute !== undefined && spec.attribute !== column.attribute) return undefined;
  return column.selector;
}
