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
};
