import type { RunManifest } from "@fluxiq-web-extension/test-contracts";
import type { RunRedactionAttestation } from "./attest-run-redaction.js";

/**
 * The manifest's `redactionState`, from what the run's redaction attestation
 * observed rather than from a constant.
 *
 * - `verified` only when a scan for the scenario's declared literals ran and
 *   found nothing;
 * - `failed` when it found one or could not look;
 * - `not_applicable` when the scenario declares no literal, so there was nothing
 *   to scan for. It is its own value so that a run with nothing to check is
 *   neither claimed as verified nor left looking unfinished for good;
 * - `pending` when no attestation ran at all: the run did not reach it, or its
 *   FluxIQ could not be scanned.
 */
export function runRedactionState(attestation: Pick<RunRedactionAttestation, "status"> | undefined): RunManifest["redactionState"] {
  switch (attestation?.status) {
    case "passed": return "verified";
    case "failed": return "failed";
    case "not-applicable": return "not_applicable";
    default: return "pending";
  }
}
