import type { ProbeEvidence, ProbeStage } from "./model.js";

export class NativeAuthProbeError extends Error {
  readonly stage: ProbeStage;
  readonly evidence: readonly ProbeEvidence[];

  constructor(readonly code: "allocation" | "artifact_unavailable" | "artifact_stale" | "ownership" | "browser_launch" | "browser_close" | "process_survived" | "containment" | "operation_refused" | "unexpected" | "completion_unconfirmed" | "callback_mismatch" | "callback_network_attempt", diagnosis?: { stage: ProbeStage; evidence: readonly ProbeEvidence[] }) {
    super(`native_auth_probe.${code}.${diagnosis?.stage ?? "setup"}`);
    this.name = "NativeAuthProbeError";
    this.stage = diagnosis?.stage ?? "setup";
    this.evidence = diagnosis?.evidence ?? [];
  }
}
