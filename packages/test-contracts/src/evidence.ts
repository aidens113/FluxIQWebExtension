export const EVIDENCE_SCHEMA_VERSION = "0.1" as const;
export type EvidenceTrigger = "step.start" | "step.complete" | "gateway.action" | "runtime.dispatch" | "runtime.settle" | "navigation" | "state.change" | "error" | "checkpoint" | "final";
export type EvidenceEvent = {
  schemaVersion: typeof EVIDENCE_SCHEMA_VERSION;
  sequence: number;
  timestamp: string;
  trigger: EvidenceTrigger;
  scenarioStepId?: string;
  correlationId?: string;
  summary: string;
  imageSha256?: string;
  duplicateOfSha256?: string;
  details?: Record<string, unknown>;
};
export type EvidencePolicy = {
  screenshots: "none" | "checkpoints" | "events";
  trace: "off" | "failure" | "always";
  video: "off" | "failure" | "always";
  sampleFps: number;
  maxScreenshots: number;
  maxBytes: number;
  reviewRequired: boolean;
};
