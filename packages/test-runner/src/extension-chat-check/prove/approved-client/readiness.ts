import { readModelKeyAvailability } from "fluxiq/ui";

/** Configuration evidence only. A model request is required to prove client access. */
export function approvedClientModelReadiness(reply: unknown): string {
  if (record(reply)?.ok !== true) return "unknown";
  const keys = record(record(reply)?.payload)?.keys;
  if (!Array.isArray(keys)) return "unknown";
  const candidates = keys.map(record).filter((key) => {
    if (key?.enabled !== true || key.kind !== "llm" || key.heldByYou === false) return false;
    const provider = key.provider === undefined ? "deepseek" : typeof key.provider === "string" ? key.provider.toLowerCase().replace(/[^a-z0-9]/gu, "") : "";
    return provider === "deepseek" || provider === "anthropic" || provider === "anthropicclaude";
  });
  if (candidates.length === 0) return "missing";
  const readings = candidates.map((key) => {
    if (key?.availability === undefined) return key?.unlocked === false ? "unavailable:upgrade_required" : "available";
    const availability = readModelKeyAvailability(key.availability);
    return availability === null ? "unknown" : availability.state === "available" ? "available" : `unavailable:${availability.code}`;
  });
  return readings.includes("available") ? "available" : readings.includes("unknown") ? "unknown" : readings[0]!;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
