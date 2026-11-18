import type { ModelKeyReading } from "./reading";

/** Safe configuration recovery guidance; client authentication is independent. */
export function modelKeyUnavailableLine(reading: Exclude<ModelKeyReading, "ready" | "missing" | "unknown">): string {
  if (reading === "upgrade_required") return "Update FluxIQ to use its saved model key with this browser.";
  switch (reading.code) {
    case "legacy_recovery_required": return "The saved model key needs recovery. Open FluxIQ to recover or replace it.";
    case "host_protection_unavailable": return "FluxIQ can't access its host key protection. Ask the host operator to restore it.";
    case "ciphertext_invalid": return "FluxIQ can't read the saved model key. Open FluxIQ to replace it.";
  }
}
