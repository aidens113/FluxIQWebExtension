import type { AutomationStudioAdaptiveFailureClass } from "./failure-category.js";
import type { ScenarioStepOperation } from "./scenario.js";

export const RUN_SCHEMA_VERSION = "0.1" as const;

export type RepositoryRevision = { path: string; commit: string; dirty: boolean };
export type PackageCompatibility = {
  packageName: string;
  requested: string;
  resolvedVersion: string;
  source: string;
  integrity?: string;
};
export type RunArtifact = {
  path: string;
  mediaType: string;
  sha256: string;
  bytes: number;
  redaction: "not-required" | "applied" | "verified";
};
export type CloneRemappingSummary = { projects: number; flows: number; nodes: number; edges: number; localReferences: number };
export type CloneExecutionExportedMetadata = {
  targetMode: "clone";
  stage: "exported";
  sourceOrigin: string;
  sourceProjectId: string;
  sourceFlowId: string;
  sourceContentHash: string;
  sourceSessionIdentityVerified: boolean;
  clonePackageHash: string;
  dependencyVerdict: "compatible" | "incompatible";
  remappingSummary: CloneRemappingSummary;
  cleanupOutcome: "pending" | "completed" | "failed";
};
export type CloneExecutionImportedMetadata = Omit<CloneExecutionExportedMetadata, "stage"> & {
  stage: "imported";
  destinationProjectId: string;
  destinationFlowId: string;
  destinationContentHash: string;
};
export type CloneExecutionExecutedMetadata = Omit<CloneExecutionImportedMetadata, "stage"> & {
  stage: "executed";
  destinationRuntimeRunId: string;
  sourceHashVerifiedAfterRun: boolean;
  panelVerification: "verified" | "limited";
};
export type FluxIQExecutionMetadata =
  | { targetMode: "isolated" }
  | { targetMode: "persistent-isolated"; workspace: string }
  | {
      targetMode: "existing";
      origin: string;
      projectId: string;
      flowId: string;
      flowContentHash: string;
      runtimeRunId: string;
      runtimeId?: string;
      sessionIdentityVerified: boolean;
      panelVerification: "verified" | "limited";
    }
  | CloneExecutionExportedMetadata
  | CloneExecutionImportedMetadata
  | CloneExecutionExecutedMetadata;
/** One recording-script step as the recording lane performed it. */
export type RunStepTiming = {
  stepId: string;
  operation: ScenarioStepOperation;
  startedAt: string;
  durationMs: number;
  outcome: "succeeded" | "failed";
};
export const runActionStatuses = ["succeeded", "failed", "timed_out", "cancelled", "queued", "running", "waiting", "unknown"] as const;
/**
 * One FluxIQ action the run executed: the Core round-trip probe on the
 * recording lane, or a persisted Flow's action attempt on existing and clone.
 * `durationMs` is absent while an attempt has not finished.
 */
export type RunActionTiming = {
  actionType: string;
  startedAt: string;
  durationMs?: number;
  status: (typeof runActionStatuses)[number];
};
/**
 * The automation failure FluxIQ reported for the run, in Core's failure
 * taxonomy (`AutomationStudioAdaptiveFailureClass`). It is not the test-rig
 * `FailureCategory` a runner failure is classified with.
 */
export type RunAutomationFailure = { category: AutomationStudioAdaptiveFailureClass; code?: string };
export type RunManifest = {
  schemaVersion: typeof RUN_SCHEMA_VERSION;
  runId: string;
  scenarioId: string;
  scenarioRevision: string;
  seed: number;
  status: "created" | "running" | "passed" | "failed" | "aborted";
  startedAt: string;
  finishedAt?: string;
  repositories: { facility: RepositoryRevision; core: RepositoryRevision };
  compatibility: PackageCompatibility[];
  lockfiles: Array<{ path: string; sha256: string }>;
  extension: { version: string; sha256: string; path: string };
  environment: {
    os: string;
    architecture: string;
    browserName: string;
    browserVersion: string;
    locale: string;
    timezone: string;
    viewport: { width: number; height: number };
  };
  ports: Record<string, number>;
  processExits: Record<string, number | null>;
  artifacts: RunArtifact[];
  redactionState: "pending" | "verified" | "failed";
  verdict?: "passed" | "failed" | "inconclusive";
  /** Sanitized execution provenance only. Credentials and raw gateway data are forbidden. */
  fluxiqExecution?: FluxIQExecutionMetadata;
  /** The `workflows[]` entry that ran; absent for the primary workflow. */
  workflowId?: string;
  /** The armed variant of that workflow; absent when none was armed. */
  variantId?: string;
  /** `null` when FluxIQ reported no failure; absent when the lane could not observe one. */
  automationFailure?: RunAutomationFailure | null;
  steps?: RunStepTiming[];
  actions?: RunActionTiming[];
};
