// The background's `fluxiq.panel.modelReadiness` reply, read as a ModelKeyReading.
// The safe per-key availability is metadata, not a second client-authentication state.
// These supported-provider and compatibility rules match shared chat readiness.

import { readModelKeyAvailability } from "fluxiq/ui";
import type { PanelResult } from "../../../state";
import type { ModelKeyReading } from "./reading";

/** Never throws; anything that is not a clear answer is `unknown`. */
export function modelKeyFromReply(result: PanelResult<unknown>): ModelKeyReading {
  if (!result.ok) return "unknown";
  const payload = record(record(result.value)?.payload);
  const keys = payload?.keys;
  if (!Array.isArray(keys)) return "unknown";
  const enabled = keys.map(record).filter((key) => key?.enabled === true && key.heldByYou !== false && supportedModelKey(key));
  if (enabled.length === 0) return "missing";
  const readings = enabled.map(keyReading);
  if (readings.includes("ready")) return "ready";
  if (readings.includes("unknown")) return "unknown";
  return readings[0]!;
}

function supportedModelKey(key: Record<string, unknown>): boolean {
  if (key.kind !== "llm") return false;
  const provider = key.provider === undefined ? "deepseek" : typeof key.provider === "string" ? key.provider.toLowerCase().replace(/[^a-z0-9]/gu, "") : "";
  return provider === "deepseek" || provider === "anthropic" || provider === "anthropicclaude";
}

function keyReading(key: Record<string, unknown> | undefined): ModelKeyReading {
  if (key?.availability !== undefined) {
    const availability = readModelKeyAvailability(key.availability);
    if (availability === null) return "unknown";
    return availability.state === "available" ? "ready" : availability;
  }
  // An old lock flag proves incompatibility, not a particular recovery cause.
  return key?.unlocked === false ? "upgrade_required" : "ready";
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}
