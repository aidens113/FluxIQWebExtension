// How a page action was made above humanness 0, as an action result reports it.
//
// The content script attaches `humanness: { level, aimed, misclick? }` to a
// click, type or scroll run above level 0 (`apps/extension/src/content/
// action-runtime/humanness/record-humanness.ts`); at 0 the result carries no
// key at all. It is copied, never passed through, at each hop that carries it:
// the gateway payload (`client/gateway-mapping.ts`) and the dispatch payload
// Core keeps as the attempt's `outputs.result` (`io/gateway-output-dispatcher.ts`),
// where Core's Flow step log reads it (Core `runtime/llm/step-log/flow-step.ts`).

import type { JsonObject } from "fluxiq/core";

/**
 * The record as it may travel: `level` and `aimed`, and a misclick's point
 * when both its coordinates are finite numbers; nothing else a producer put
 * beside them. `undefined` when absent or unreadable.
 */
export function webAutomationHumannessRecordValue(value: unknown): JsonObject | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const { level, aimed, misclick } = value as { level?: unknown; aimed?: unknown; misclick?: unknown };
  if (typeof level !== "number" || !Number.isFinite(level) || typeof aimed !== "boolean") return undefined;
  const at = typeof misclick === "object" && misclick !== null ? misclick as { x?: unknown; y?: unknown } : undefined;
  const point = at && typeof at.x === "number" && typeof at.y === "number" && Number.isFinite(at.x) && Number.isFinite(at.y) ? { x: at.x, y: at.y } : undefined;
  return point ? { level, aimed, misclick: point } : { level, aimed };
}
