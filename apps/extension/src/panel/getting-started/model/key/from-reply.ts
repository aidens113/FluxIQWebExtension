// The background's `fluxiq.panel.modelReadiness` reply, read as a ModelKeyReading.
// The reply is `{ ok: true, payload: { keys: [{ enabled, unlocked?, lockedBecause? }] } }`; a reply
// with no list says nothing about the keys. Same rules as the chat's own reading in
// `@fluxiq/ui-components` (`onboarding/model-readiness.ts`), so the two never disagree.

import type { PanelResult } from "../../../state";
import type { ModelKeyReading } from "./reading";

/** Never throws; anything that is not a clear answer is `unknown`. */
export function modelKeyFromReply(result: PanelResult<unknown>): ModelKeyReading {
  if (!result.ok) return "unknown";
  const payload = record(record(result.value)?.payload);
  const keys = payload?.keys;
  if (!Array.isArray(keys)) return "unknown";
  const enabled = keys.map(record).filter((key) => key?.enabled === true);
  if (enabled.length === 0) return "missing";
  // A key that says nothing about being unlocked (an older Core, or someone else's) is ready as it always was.
  return enabled.every((key) => key?.unlocked === false) ? "locked" : "ready";
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}
