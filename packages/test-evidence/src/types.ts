import type {
  EvidenceEvent as ContractEvidenceEvent,
  EvidencePolicy as ContractEvidencePolicy,
  EvidenceTrigger as ContractEvidenceTrigger,
} from "@fluxiq-web-extension/test-contracts";

export type EvidenceEvent = ContractEvidenceEvent;
export type EvidencePolicy = ContractEvidencePolicy;
export type EvidenceTrigger = ContractEvidenceTrigger;

export type CaptureCorrelation = {
  runId: string;
  scenarioId: string;
  stepId?: string;
  gatewayMessageId?: string;
  recordingEntryId?: string;
  commandAttemptId?: string;
  correlationId: string;
};

export type CaptureEvidenceEventInput = {
  trigger: EvidenceTrigger;
  summary: string;
  correlation: CaptureCorrelation;
  details?: Record<string, unknown>;
  /** Suppress pixels while retaining a truthful correlated event boundary. */
  screenshotSuppression?: "sensitive-action";
};

export type CaptureScreenshot = {
  path?: string;
  sha256?: string;
  duplicateOfSha256?: string;
  suppressed?: "policy" | "rate-limit" | "quota" | "capture-unavailable" | "sensitive-action";
};

export type CapturedEvidenceEvent = CaptureEvidenceEventInput & {
  schemaVersion: "0.1";
  sequence: number;
  timestamp: string;
  screenshot?: CaptureScreenshot;
  published: EvidenceEvent;
};

/** @deprecated Use CaptureCorrelation. */
export type Correlation = CaptureCorrelation;
/** @deprecated Use CaptureEvidenceEventInput. */
export type EvidenceEventInput = CaptureEvidenceEventInput;

export type CapturePolicy = Pick<EvidencePolicy, "screenshots" | "maxScreenshots" | "maxBytes"> & Partial<Omit<EvidencePolicy, "screenshots" | "maxScreenshots" | "maxBytes">> & {
  minimumScreenshotIntervalMs?: number;
  /** Preserve every sampled frame even when consecutive pixels are identical. */
  deduplicateScreenshots?: boolean;
};

export type ArtifactEntry = {
  path: string;
  mediaType: string;
  bytes: number;
  sha256: string;
  redaction: "not-required" | "applied" | "verified";
};

export type ArtifactIndex = {
  schemaVersion: "0.1";
  generatedAt: string;
  artifacts: ArtifactEntry[];
};

export type EvidenceSummary = {
  schemaVersion: "0.1";
  runId: string;
  scenarioId: string;
  verdict: "passed" | "failed" | "inconclusive";
  startedAt: string;
  finishedAt: string;
  eventCount: number;
  screenshotCount: number;
  duplicateScreenshotCount: number;
  firstFailure?: { sequence: number; summary: string; stepId?: string };
  metrics?: Record<string, number>;
};

export type VerifiedVisual = {
  bytes: Uint8Array;
  mediaType: "image/png" | "image/jpeg" | "image/webp";
  redactionVerified: true;
};

export type VerifiedArtifact = {
  bytes: Uint8Array;
  mediaType: string;
  redactionVerified: true;
  redaction: "applied" | "verified";
};

export type ScreenshotAdapter = {
  capture(input: CaptureEvidenceEventInput): Promise<VerifiedVisual | undefined>;
};

export type FinalizeInput = {
  verdict: EvidenceSummary["verdict"];
  metrics?: Record<string, number>;
};
