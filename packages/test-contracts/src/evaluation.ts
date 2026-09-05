export const EVALUATION_SCHEMA_VERSION = "0.1" as const;
export const failureCategories = [
  "fixture.invalid", "environment.missing", "process.startup", "extension.install", "extension.worker",
  "gateway.connection", "gateway.pairing", "recording.contract", "recording.persistence", "action.dispatch",
  "action.targeting", "runtime.behavior", "visual.mismatch", "performance.budget", "security.redaction",
  "test.flaky", "unknown",
] as const;
export type FailureCategory = (typeof failureCategories)[number];
export type InvariantResult = { id: string; passed: boolean; expected: string; actual: string; evidenceSequences: number[] };
export type RunEvaluation = {
  schemaVersion: typeof EVALUATION_SCHEMA_VERSION;
  runId: string;
  verdict: "passed" | "failed" | "inconclusive";
  failureCategory?: FailureCategory;
  invariants: InvariantResult[];
  metrics: Record<string, number>;
};
export type CandidateComparison = {
  schemaVersion: typeof EVALUATION_SCHEMA_VERSION;
  baselineRunId: string;
  candidateRunId: string;
  safetyPassed: boolean;
  expectationSetEqual: boolean;
  evidenceComplete: boolean;
  metricDeltas: Record<string, number>;
  verdict: "improved" | "regressed" | "equivalent" | "rejected";
  reasons: string[];
};
