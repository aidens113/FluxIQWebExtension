import type { RunManifest } from "@fluxiq-web-extension/test-contracts";
import type { RunRedactionAttestation } from "./attest-run-redaction.js";

/**
 * The manifest's `redactionState`, from what the run's redaction attestation
 * observed rather than from a constant.
 *
 * `verified` only when a scan for the scenario's declared literals ran and found
 * nothing; `failed` when it found one or could not look. Everything else is
 * `pending`: no attestation ran, or the scenario declares no literal to scan
 * for. Either way nothing was verified, and a manifest that said so would repeat
 * the constant this replaces.
 */
export function runRedactionState(attestation: Pick<RunRedactionAttestation, "status"> | undefined): RunManifest["redactionState"] {
  switch (attestation?.status) {
    case "passed": return "verified";
    case "failed": return "failed";
    default: return "pending";
  }
}
