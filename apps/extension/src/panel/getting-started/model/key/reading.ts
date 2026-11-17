import type { ModelKeyAvailability } from "fluxiq/ui";

/** Configuration metadata only; no reading gates connection, chat or deterministic work. */
export type ModelKeyReading =
  | "ready"
  | "missing"
  | "unknown"
  | "upgrade_required"
  | Extract<ModelKeyAvailability, { state: "unavailable" }>;
