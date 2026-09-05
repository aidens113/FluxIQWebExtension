import assert from "node:assert/strict";
import test from "node:test";
import {
  ContractValidationError,
  assertCandidateComparison,
  assertEvidenceEvent,
  assertEvidenceEvents,
  assertEvidencePolicy,
  assertRunEvaluation,
  assertRunManifest,
  parseCandidateComparisonJson,
  parseEvidenceEventJson,
  parseEvidencePolicyJson,
  parseRunEvaluationJson,
  parseRunManifestJson,
  validateRunManifest,
} from "../dist/index.js";

const SHA = "a".repeat(64);
const manifest = () => ({
  schemaVersion: "0.1", runId: "run-1", scenarioId: "basic-form", scenarioRevision: SHA, seed: 1,
  status: "passed", startedAt: "2030-01-01T00:00:00.000Z", finishedAt: "2030-01-01T00:01:00.000Z",
  repositories: { facility: { path: "workspace", commit: "b".repeat(40), dirty: false }, core: { path: "../core", commit: "c".repeat(40), dirty: false } },
  compatibility: [{ packageName: "fluxiq", requested: "workspace:*", resolvedVersion: "1.0.0", source: "link:../core" }],
  lockfiles: [{ path: "pnpm-lock.yaml", sha256: SHA }], extension: { version: "0.1.0", sha256: SHA, path: "apps/extension/dist/e2e" },
  environment: { os: "windows", architecture: "x64", browserName: "chromium", browserVersion: "1", locale: "en-US", timezone: "UTC", viewport: { width: 1280, height: 720 } },
  ports: { scenario: 12345 }, processExits: { scenario: 0 }, artifacts: [{ path: "logs/run.json", mediaType: "application/json", sha256: SHA, bytes: 12, redaction: "verified" }],
  redactionState: "verified", verdict: "passed",
});

test("run manifests validate and parse independently of Playwright", () => {
  const value = manifest(); assert.doesNotThrow(() => assertRunManifest(value)); assert.equal(parseRunManifestJson(JSON.stringify(value)).runId, "run-1");
});

test("run manifests accept optional sanitized isolated and existing FluxIQ execution provenance", () => {
  const isolated = { ...manifest(), fluxiqExecution: { targetMode: "isolated" } };
  assert.doesNotThrow(() => assertRunManifest(isolated));
  const existing = {
    ...manifest(),
    fluxiqExecution: {
      targetMode: "existing", origin: "https://fluxiq.invalid", projectId: "project-1", flowId: "flow-1",
      flowContentHash: SHA, runtimeRunId: "run-runtime-1", runtimeId: "runtime-1",
      sessionIdentityVerified: true, panelVerification: "verified",
    },
  };
  assert.deepEqual(parseRunManifestJson(JSON.stringify(existing)).fluxiqExecution, existing.fluxiqExecution);
  const clone = {
    ...manifest(), fluxiqExecution: {
      targetMode: "clone", stage: "executed", sourceOrigin: "https://fluxiq.invalid", sourceProjectId: "project.source", sourceFlowId: "flow.source",
      sourceContentHash: SHA, sourceSessionIdentityVerified: true, clonePackageHash: "b".repeat(64),
      destinationProjectId: "project.clone", destinationFlowId: "flow.clone", destinationContentHash: "c".repeat(64),
      dependencyVerdict: "compatible", remappingSummary: { projects: 1, flows: 1, nodes: 2, edges: 1, localReferences: 0 },
      destinationRuntimeRunId: "run.clone", sourceHashVerifiedAfterRun: true, panelVerification: "verified", cleanupOutcome: "completed",
    },
  };
  assert.deepEqual(parseRunManifestJson(JSON.stringify(clone)).fluxiqExecution, clone.fluxiqExecution);
});

test("FluxIQ execution provenance fails closed on incomplete, unsafe, or credential-bearing metadata", () => {
  const missing = { ...manifest(), fluxiqExecution: { targetMode: "existing", origin: "https://fluxiq.invalid" } };
  const unsafeOrigin = {
    ...manifest(), fluxiqExecution: {
      targetMode: "existing", origin: "https://user:secret@fluxiq.invalid/panel?token=nope", projectId: "project-1", flowId: "flow-1",
      flowContentHash: SHA, runtimeRunId: "runtime-run-1", sessionIdentityVerified: false, panelVerification: "limited",
    },
  };
  const secretField = { ...manifest(), fluxiqExecution: { targetMode: "isolated", cookie: "must-not-be-recorded" } };
  const cloneSecret = {
    ...manifest(), fluxiqExecution: {
      targetMode: "clone", stage: "executed", sourceOrigin: "https://fluxiq.invalid", sourceProjectId: "project.source", sourceFlowId: "flow.source",
      sourceContentHash: SHA, sourceSessionIdentityVerified: true, clonePackageHash: SHA, destinationProjectId: "project.clone",
      destinationFlowId: "flow.clone", destinationContentHash: SHA, dependencyVerdict: "compatible",
      remappingSummary: { projects: 1, flows: 1, nodes: 1, edges: 0, localReferences: 0 }, destinationRuntimeRunId: "run.clone",
      sourceHashVerifiedAfterRun: true, panelVerification: "verified", cleanupOutcome: "completed", authorization: "Bearer no",
    },
  };
  assert.throws(() => assertRunManifest(missing), ContractValidationError);
  assert.throws(() => assertRunManifest(unsafeOrigin), ContractValidationError);
  assert.throws(() => assertRunManifest(secretField), ContractValidationError);
  assert.throws(() => assertRunManifest(cloneSecret), ContractValidationError);
});

test("clone execution provenance preserves strict exported and imported failure stages", () => {
  const common = {
    targetMode: "clone", sourceOrigin: "https://fluxiq.invalid", sourceProjectId: "project.source", sourceFlowId: "flow.source",
    sourceContentHash: SHA, sourceSessionIdentityVerified: false, clonePackageHash: "b".repeat(64), dependencyVerdict: "incompatible",
    remappingSummary: { projects: 1, flows: 1, nodes: 2, edges: 1, localReferences: 0 }, cleanupOutcome: "completed",
  };
  assert.doesNotThrow(() => assertRunManifest({ ...manifest(), fluxiqExecution: { ...common, stage: "exported" } }));
  assert.doesNotThrow(() => assertRunManifest({ ...manifest(), fluxiqExecution: { ...common, stage: "imported", dependencyVerdict: "compatible", destinationProjectId: "project.clone", destinationFlowId: "flow.clone", destinationContentHash: "c".repeat(64) } }));
  assert.throws(() => assertRunManifest({ ...manifest(), fluxiqExecution: { ...common, stage: "exported", destinationProjectId: "project.clone" } }), ContractValidationError);
  assert.throws(() => assertRunManifest({ ...manifest(), fluxiqExecution: { ...common, stage: "executed", destinationProjectId: "project.clone", destinationFlowId: "flow.clone", destinationContentHash: SHA } }), ContractValidationError);
});

test("run validation rejects unknown fields, unsafe paths, duplicate artifacts, bad hashes, and inconsistent verdicts", () => {
  const value = manifest(); value.status = "running"; value.artifacts.push({ ...value.artifacts[0], path: "logs/run.json", sha256: "bad" }); value.lockfiles[0].path = "../secret"; value.extra = true;
  const checked = validateRunManifest(value); assert.equal(checked.valid, false);
  for (const fragment of ["unknown property", "normalized relative path", "artifact paths must be unique", "lowercase SHA-256", "absent before terminal"]) assert.ok(!checked.valid && checked.issues.some(issue => issue.message.includes(fragment)), fragment);
  assert.throws(() => assertRunManifest(value), ContractValidationError);
});

test("run validation rejects duplicate lockfiles, reversed dates, and incomplete redaction verification", () => {
  const value = manifest(); value.lockfiles.push({ ...value.lockfiles[0] }); value.finishedAt = "2029-12-31T23:59:00.000Z"; value.artifacts[0].redaction = "applied";
  const checked = validateRunManifest(value); assert.equal(checked.valid, false);
  for (const fragment of ["lockfile paths must be unique", "must not precede", "only marked applied"]) assert.ok(!checked.valid && checked.issues.some(issue => issue.message.includes(fragment)), fragment);
});

test("evidence event collections enforce schema, hashes, properties, and ordered unique sequences", () => {
  const event = { schemaVersion: "0.1", sequence: 1, timestamp: "2030-01-01T00:00:00.000Z", trigger: "checkpoint", summary: "checkpoint", correlationId: "command-1", imageSha256: SHA };
  assert.doesNotThrow(() => assertEvidenceEvent(event)); assert.equal(parseEvidenceEventJson(JSON.stringify(event)).sequence, 1);
  assert.throws(() => assertEvidenceEvents([event, { ...event, summary: "duplicate", unexpected: true }]), ContractValidationError);
  assert.throws(() => assertEvidenceEvent({ ...event, imageSha256: SHA, duplicateOfSha256: SHA }), ContractValidationError);
});

test("evidence policy enforces finite bounded quotas and rejects unknown properties", () => {
  const policy = { screenshots: "events", trace: "failure", video: "off", sampleFps: 0.5, maxScreenshots: 50, maxBytes: 1024, reviewRequired: false };
  assert.doesNotThrow(() => assertEvidencePolicy(policy)); assert.equal(parseEvidencePolicyJson(JSON.stringify(policy)).maxBytes, 1024);
  assert.throws(() => assertEvidencePolicy({ ...policy, sampleFps: Number.POSITIVE_INFINITY, extra: true }), ContractValidationError);
});

test("run evaluations enforce failure classification, finite metrics, unique invariants, and verdict consistency", () => {
  const evaluation = { schemaVersion: "0.1", runId: "run-1", verdict: "failed", failureCategory: "action.targeting", invariants: [{ id: "target-found", passed: false, expected: "found", actual: "missing", evidenceSequences: [1] }], metrics: { latencyMs: 12 } };
  assert.doesNotThrow(() => assertRunEvaluation(evaluation)); assert.equal(parseRunEvaluationJson(JSON.stringify(evaluation)).verdict, "failed");
  assert.throws(() => assertRunEvaluation({ ...evaluation, verdict: "passed", metrics: { broken: Number.NaN } }), ContractValidationError);
  assert.throws(() => assertRunEvaluation({ ...evaluation, invariants: [evaluation.invariants[0], evaluation.invariants[0]] }), ContractValidationError);
});

test("candidate comparisons reject self-comparison, unsafe improvement, invalid metrics, and unreasoned rejection", () => {
  const comparison = { schemaVersion: "0.1", baselineRunId: "base", candidateRunId: "candidate", safetyPassed: true, expectationSetEqual: true, evidenceComplete: true, metricDeltas: { latencyMs: -2 }, verdict: "improved", reasons: ["lower latency"] };
  assert.doesNotThrow(() => assertCandidateComparison(comparison)); assert.equal(parseCandidateComparisonJson(JSON.stringify(comparison)).verdict, "improved");
  assert.throws(() => assertCandidateComparison({ ...comparison, candidateRunId: "base", safetyPassed: false, metricDeltas: { bad: Number.POSITIVE_INFINITY } }), ContractValidationError);
  assert.throws(() => assertCandidateComparison({ ...comparison, verdict: "rejected", reasons: [] }), ContractValidationError);
});

test("all JSON parsers reject malformed input with contract errors", () => {
  for (const parser of [parseRunManifestJson, parseEvidenceEventJson, parseEvidencePolicyJson, parseRunEvaluationJson, parseCandidateComparisonJson]) assert.throws(() => parser("{"), ContractValidationError);
});
