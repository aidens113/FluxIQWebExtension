import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { FIRST_LIVE_ADAPTATION_PROFILE, evaluateDemoLlmAdaptation, persistDemoLlmAdaptationResult } from "./demo-llm-adaptation.js";

function validInput(): any {
  return {
    schemaVersion: "0.1",
    operationId: "operation.adapt.one",
    startingGraph: {
      creationCertified: true, projectId: "project.one", flowId: "flow.one", startingExecutionDigest: "digest.created",
      ownedSubflowCount: 1, routerSubflowRouteCount: 1, nodeCount: 3, executableNodeCount: 3,
      recordingCount: 2, recordingProvenanceAbsent: true,
    },
    drift: {
      kind: "semantic-target", scenarioId: "instruction-only-form", beforeTargetFingerprint: "target.before",
      afterTargetFingerprint: "target.after", introducedBeforeRun: true, observed: true,
    },
    failedAction: { runId: "run.adapt.one", attemptId: "attempt.failed.one", sequence: 10, status: "failed", providerCallCountBeforeFailure: 0 },
    invocations: [{
      requestId: "request.adapt.one", purpose: "runtime_adaptation", provider: "deepseek", model: "deepseek-chat",
      promptSchemaVersion: "automation-studio.runtime-adaptation.v1", sequence: 20, attempt: 1, retryCount: 0, providerCallCount: 1,
      inputTokens: 1_400, outputTokens: 300, totalTokens: 1_700, estimatedCostUsd: 0.02, latencyMs: 600,
    }],
    adaptation: {
      adaptationId: "adaptation.one", requestId: "request.adapt.one", baseExecutionDigest: "digest.created", resultingExecutionDigest: "digest.adapted",
      validationOk: true, stale: false, concurrentMutationDetected: false, reviewOutcome: "approved", approvalChannel: "human-ui",
      mutationObservedBeforeApproval: false, outcome: "applied", applySequence: 30, structuralChange: false,
      externalSideEffectEscalation: false, authorizationExpansion: false, unsupportedOutputCount: 0,
      recordingCount: 2, recordingProvenanceAbsent: true,
    },
    resumed: {
      runId: "run.adapt.one", status: "succeeded", completionSequence: 40, executionDigest: "digest.adapted",
      providerCallCount: 1, diagnosisCount: 0, adaptationCount: 1, resumedActionCount: 2, succeededResumedActionCount: 2,
    },
    finalReplay: {
      runId: "run.replay.final", status: "succeeded", executionDigest: "digest.adapted", providerCallCount: 0,
      interventionCount: 0, adaptationCount: 0, actionAttemptCount: 3, succeededActionCount: 3,
    },
  };
}

test("first adaptation profile enforces one separately bounded adaptive call", () => {
  assert.deepEqual(FIRST_LIVE_ADAPTATION_PROFILE.budget, {
    maxInputTokens: 2_000, maxOutputTokens: 512, maxTotalTokensPerRequest: 3_000,
    maxCallsPerRun: 1, timeoutMs: 20_000, maxRetries: 0, maxEstimatedCostUsd: 0.25,
  });
  assert.equal(FIRST_LIVE_ADAPTATION_PROFILE.task, "adapt");
  assert.equal(FIRST_LIVE_ADAPTATION_PROFILE.approvalMode, "manual");
  assert.equal(FIRST_LIVE_ADAPTATION_PROFILE.retainRawPrompts, false);
  assert.equal(FIRST_LIVE_ADAPTATION_PROFILE.retainRawResponses, false);
});

test("certifies failed-action-first adaptation, resumed completion, and zero-call replay", () => {
  const result = evaluateDemoLlmAdaptation(validInput());
  assert.equal(result.providerCallCount, 1);
  assert.equal(result.retryCount, 0);
  assert.equal(result.reviewOutcome, "approved");
  assert.equal(result.applyOutcome, "applied");
  assert.equal(result.resumedStatus, "succeeded");
  assert.notEqual(result.startingExecutionDigest, result.resultingExecutionDigest);
  assert.equal(result.recordingCountBefore, result.recordingCountAfter);
  assert.equal(result.recordingProvenanceAbsent, true);
  assert.equal(result.finalReplayProviderCallCount, 0);
  assert.equal(result.evaluation.verdict, "passed");
});

test("rejects diagnosis-plus-patch double calls, retries, missing usage, nonfinite and over-budget accounting", () => {
  const doubled = validInput(); doubled.invocations.push({ ...doubled.invocations[0], requestId: "request.diagnosis", purpose: "diagnosis" });
  assert.throws(() => evaluateDemoLlmAdaptation(doubled), /exactly one/);
  for (const [field, value] of [["purpose", "diagnosis"], ["retryCount", 1], ["attempt", 2], ["providerCallCount", 2]] as const) {
    const input = validInput(); input.invocations[0][field] = value;
    assert.throws(() => evaluateDemoLlmAdaptation(input), /fixed safety fact/);
  }
  for (const [field, value] of [["inputTokens", 2001], ["outputTokens", 513], ["totalTokens", 3001], ["estimatedCostUsd", 0.251], ["latencyMs", Number.NaN]] as const) {
    const input = validInput(); input.invocations[0][field] = value;
    assert.throws(() => evaluateDemoLlmAdaptation(input), /budget|finite/);
  }
  const mismatch = validInput(); mismatch.invocations[0].totalTokens = 1699;
  assert.throws(() => evaluateDemoLlmAdaptation(mismatch), /budget/);
  const missing = validInput(); delete missing.invocations[0].totalTokens;
  assert.throws(() => evaluateDemoLlmAdaptation(missing), /missing or unsupported/);
});

test("rejects provider calls before failure and invalid failure-invocation-apply-resume ordering", () => {
  for (const mutate of [
    (input: any) => { input.failedAction.providerCallCountBeforeFailure = 1; },
    (input: any) => { input.failedAction.status = "succeeded"; },
    (input: any) => { input.invocations[0].sequence = 9; },
    (input: any) => { input.adaptation.applySequence = 19; },
    (input: any) => { input.resumed.completionSequence = 29; },
  ]) {
    const input = validInput(); mutate(input);
    assert.throws(() => evaluateDemoLlmAdaptation(input), /fixed safety fact|ordering/);
  }
});

test("rejects stale, concurrent, unreviewed, preapproval, unsafe, unsupported, or unchanged adaptation", () => {
  for (const mutate of [
    (input: any) => { input.adaptation.requestId = "request.other"; },
    (input: any) => { input.adaptation.baseExecutionDigest = "digest.other"; },
    (input: any) => { input.adaptation.resultingExecutionDigest = "digest.created"; input.resumed.executionDigest = "digest.created"; input.finalReplay.executionDigest = "digest.created"; },
    (input: any) => { input.adaptation.validationOk = false; },
    (input: any) => { input.adaptation.stale = true; },
    (input: any) => { input.adaptation.concurrentMutationDetected = true; },
    (input: any) => { input.adaptation.reviewOutcome = "pending"; },
    (input: any) => { input.adaptation.approvalChannel = "api"; },
    (input: any) => { input.adaptation.mutationObservedBeforeApproval = true; },
    (input: any) => { input.adaptation.outcome = "rejected"; },
    (input: any) => { input.adaptation.structuralChange = true; },
    (input: any) => { input.adaptation.externalSideEffectEscalation = true; },
    (input: any) => { input.adaptation.authorizationExpansion = true; },
    (input: any) => { input.adaptation.unsupportedOutputCount = 1; },
  ]) {
    const input = validInput(); mutate(input);
    assert.throws(() => evaluateDemoLlmAdaptation(input), /fixed safety fact|stale|unbound|concurrent|unchanged/);
  }
});

test("rejects missing semantic drift, non-creation graph, failed resume, recording change, and assisted replay", () => {
  for (const mutate of [
    (input: any) => { input.startingGraph.creationCertified = false; },
    (input: any) => { input.startingGraph.executableNodeCount = 2; },
    (input: any) => { input.drift.kind = "layout-only"; },
    (input: any) => { input.drift.afterTargetFingerprint = "target.before"; },
    (input: any) => { input.resumed.runId = "run.other"; },
    (input: any) => { input.resumed.status = "failed"; },
    (input: any) => { input.resumed.succeededResumedActionCount = 1; },
    (input: any) => { input.adaptation.recordingCount = 3; },
    (input: any) => { input.adaptation.recordingProvenanceAbsent = false; },
    (input: any) => { input.finalReplay.providerCallCount = 1; },
    (input: any) => { input.finalReplay.interventionCount = 1; },
    (input: any) => { input.finalReplay.adaptationCount = 1; },
    (input: any) => { input.finalReplay.succeededActionCount = 2; },
  ]) {
    const input = validInput(); mutate(input);
    assert.throws(() => evaluateDemoLlmAdaptation(input), /fixed safety fact|creation-certified|semantic target|resume|recording|replay/);
  }
});

test("rejects raw prompt, response, key, credential, recording identity, and unknown fields", () => {
  for (const field of ["rawPrompt", "rawResponse", "apiKey", "keyId", "credential", "password", "pin", "authorizationHeader", "recordingId", "lastRecordingId", "recordingEvents", "recordingEvidence", "recordingMetadata"]) {
    const input = validInput(); input.adaptation[field] = "forbidden";
    assert.throws(() => evaluateDemoLlmAdaptation(input), /forbidden sensitive or recording/);
  }
  const recordingIdentity = validInput(); recordingIdentity.adaptation.adaptationId = "recording.adaptation";
  assert.throws(() => evaluateDemoLlmAdaptation(recordingIdentity), /identifier is invalid/);
  const extra = validInput(); extra.resumed.arbitrary = true;
  assert.throws(() => evaluateDemoLlmAdaptation(extra), /missing or unsupported/);
});

test("persists only sanitized adaptation certification with leak attestation", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-adaptation-result-"));
  const sensitive = "SENSITIVE_LITERAL_NOT_FOR_ADAPTATION";
  try {
    const result = await persistDemoLlmAdaptationResult(root, evaluateDemoLlmAdaptation(validInput()), [sensitive]);
    assert.equal(result.leakAttestation.status, "passed");
    assert.equal(result.leakAttestation.findingCount, 0);
    const text = await readFile(path.join(root, "demo-llm-adaptation-result.json"), "utf8");
    assert.equal(text.includes(sensitive), false);
    const persisted = JSON.parse(text) as Record<string, unknown>;
    const forbidden = new Set(["rawPrompt", "rawResponse", "apiKey", "keyId", "credential", "password", "pin", "authorizationHeader", "recordingId", "lastRecordingId", "recordingEvents", "recordingEvidence", "recordingMetadata"]);
    const visit = (value: unknown): void => { if (!value || typeof value !== "object") return; for (const [key, child] of Object.entries(value as Record<string, unknown>)) { assert.equal(forbidden.has(key), false, key); visit(child); } };
    visit(persisted);
    assert.deepEqual(persisted, result);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
