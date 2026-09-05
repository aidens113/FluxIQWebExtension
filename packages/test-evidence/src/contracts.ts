import {
  EVIDENCE_SCHEMA_VERSION,
  assertEvidenceEvent,
  assertEvidencePolicy,
  type EvidenceEvent,
  type EvidencePolicy,
} from "@fluxiq-web-extension/test-contracts";
import type { CaptureEvidenceEventInput, CapturePolicy, CaptureScreenshot } from "./types.js";

export const DEFAULT_EVIDENCE_POLICY: Readonly<EvidencePolicy> = Object.freeze({
  screenshots: "none",
  trace: "off",
  video: "off",
  sampleFps: 0,
  maxScreenshots: 0,
  maxBytes: 0,
  reviewRequired: false,
});

export function toContractEvidencePolicy(policy: CapturePolicy): EvidencePolicy {
  const contract: EvidencePolicy = {
    screenshots: policy.screenshots,
    trace: policy.trace ?? "off",
    video: policy.video ?? "off",
    sampleFps: policy.sampleFps ?? 0,
    maxScreenshots: policy.maxScreenshots,
    maxBytes: policy.maxBytes,
    reviewRequired: policy.reviewRequired ?? false,
  };
  assertEvidencePolicy(contract);
  return contract;
}

export function toContractEvidenceEvent(
  input: CaptureEvidenceEventInput,
  publication: { sequence: number; timestamp: string; screenshot?: CaptureScreenshot },
): EvidenceEvent {
  const capture: Record<string, unknown> = {
    runId: input.correlation.runId,
    scenarioId: input.correlation.scenarioId,
  };
  for (const key of ["gatewayMessageId", "recordingEntryId", "commandAttemptId"] as const) {
    const value = input.correlation[key];
    if (value !== undefined) capture[key] = value;
  }
  if (publication.screenshot?.path !== undefined) capture.screenshotPath = publication.screenshot.path;
  if (publication.screenshot?.suppressed !== undefined) capture.screenshotSuppressed = publication.screenshot.suppressed;
  const event: EvidenceEvent = {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    sequence: publication.sequence,
    timestamp: publication.timestamp,
    trigger: input.trigger,
    summary: input.summary,
    correlationId: input.correlation.correlationId,
    details: { ...(input.details ?? {}), capture },
  };
  if (input.correlation.stepId !== undefined) event.scenarioStepId = input.correlation.stepId;
  if (publication.screenshot?.duplicateOfSha256 !== undefined) event.duplicateOfSha256 = publication.screenshot.duplicateOfSha256;
  else if (publication.screenshot?.sha256 !== undefined) event.imageSha256 = publication.screenshot.sha256;
  assertEvidenceEvent(event);
  return event;
}
