import type { AutomationStudioElementTarget } from "fluxiq/automation-studio";

export function isWebElementTarget(value: unknown): value is AutomationStudioElementTarget {
  return Boolean(value)
    && typeof value === "object"
    && !Array.isArray(value)
    && (value as Record<string, unknown>).kind === "element"
    && Boolean((value as Record<string, unknown>).fingerprint)
    && typeof (value as Record<string, unknown>).fingerprint === "object"
    && !Array.isArray((value as Record<string, unknown>).fingerprint);
}
