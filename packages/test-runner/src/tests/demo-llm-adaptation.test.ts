import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { FIRST_LIVE_ADAPTATION_PROFILE, evaluateDemoLlmAdaptation, persistDemoLlmAdaptationResult } from "../demo-llm-adaptation.js";

function validInput(): any {
  return {
    schemaVersion: "0.1",
    operationId: "operation.adapt.one",
    startingGraph: {
      creationCertified: true, projectId: "project.one", flowId: "flow.one", startingExecutionDigest: "digest.created",
      ownedSubflowCount: 1, routerSubflowRouteCount: 1, nodeCount: 3, executableNodeCount: 3,
      recordingCount: 0, recordingProvenanceAbsent: true,
    },
    drift: {
      kind: "semantic-target", scenarioId: "instruction-only-form", beforeTargetFingerprint: "target.before",
      afterTargetFingerprint: "target.after", introducedBeforeRun: true, observed: true,
    },
    failedAction: { runId: "run.adapt.one", attemptId: "attempt.failed.one", sequence: 10, status: "failed", providerCallCountBeforeFailure: 0 },
    invocations: [{
      requestId: "request.diagnosis.one", purpose: "runtime_diagnosis", provider: "deepseek", model: "deepseek-chat",
      promptSchemaVersion: "automation-studio.runtime-diagnosis.v1", sequence: 20, attempt: 1, retryCount: 0, providerCallCount: 1,
      inputTokens: 1_400, outputTokens: 300, totalTokens: 1_700, estimatedCostUsd: 0.02, latencyMs: 600,
    }, {
      requestId: "request.adapt.one", purpose: "runtime_patch", provider: "deepseek", model: "deepseek-chat",
      promptSchemaVersion: "automation-studio.runtime-patch.v1", sequence: 25, attempt: 1, retryCount: 0, providerCallCount: 1,
      inputTokens: 1_500, outputTokens: 320, totalTokens: 1_820, estimatedCostUsd: 0.03, latencyMs: 700,
    }],
    adaptation: {
      adaptationId: "adaptation.one", requestId: "request.adapt.one", baseExecutionDigest: "digest.created", resultingExecutionDigest: "digest.adapted",
      validationOk: true, stale: false, concurrentMutationDetected: false, reviewOutcome: "approved", approvalChannel: "human-ui",
      mutationObservedBeforeApproval: false, outcome: "applied", applySequence: 30, structuralChange: false,
      externalSideEffectEscalation: false, authorizationExpansion: false, unsupportedOutputCount: 0,
      recordingCount: 0, recordingProvenanceAbsent: true,
    },
    postApplyValidation: {
      runId: "run.validation.one", status: "succeeded", completionSequence: 40, executionDigest: "digest.adapted",
      providerCallCount: 0, interventionCount: 0, diagnosisCount: 0, adaptationCount: 0, actionAttemptCount: 3, succeededActionCount: 3,
    },
    finalReplay: {
      runId: "run.replay.final", status: "succeeded", executionDigest: "digest.adapted", providerCallCount: 0,
      interventionCount: 0, adaptationCount: 0, actionAttemptCount: 3, succeededActionCount: 3,
    },
  };
}

test("first adaptation profile enforces two ordered separately bounded adaptive calls", () => {
  assert.deepEqual(FIRST_LIVE_ADAPTATION_PROFILE.budget, {
    maxInputTokens: 4_000, maxOutputTokens: 1_000, maxTotalTokensPerRequest: 5_000,
    maxCallsPerRun: 2, timeoutMs: 20_000, maxRetries: 0, maxEstimatedCostUsd: 0.25,
  });
  assert.equal(FIRST_LIVE_ADAPTATION_PROFILE.task, "adapt");
  assert.equal(FIRST_LIVE_ADAPTATION_PROFILE.approvalMode, "manual");
  assert.equal(FIRST_LIVE_ADAPTATION_PROFILE.retainRawPrompts, false);
  assert.equal(FIRST_LIVE_ADAPTATION_PROFILE.retainRawResponses, false);
});

test("adaptation launcher exposes normal and no-build focused commands without embedding provider secrets", async () => {
  const root = process.cwd();
  const [script, manifestText] = await Promise.all([
    readFile(path.join(root, "scripts", "run-demo-llm-adaptation.mjs"), "utf8"),
    readFile(path.join(root, "package.json"), "utf8"),
  ]);
  const manifest = JSON.parse(manifestText) as { scripts?: Record<string, string> };
  assert.equal(manifest.scripts?.["demo:llm:adapt"], "node scripts/run-demo-llm-adaptation.mjs");
  assert.equal(manifest.scripts?.["demo:llm:adapt:focused"], "node scripts/run-demo-llm-adaptation.mjs --no-build");
  assert.equal(manifest.scripts?.["demo:llm:adapt:control"], "node scripts/control-demo-llm-adaptation.mjs");
  assert.equal(manifest.scripts?.["demo:llm:adapt:continue"], "node scripts/control-demo-llm-adaptation.mjs continue");
  assert.equal(manifest.scripts?.["demo:llm:adapt:revert"], "node scripts/control-demo-llm-adaptation.mjs revert");
  const controlLauncher = await readFile(path.join(root, "scripts", "control-demo-llm-adaptation.mjs"), "utf8");
  assert.match(controlLauncher, /process\.stdout\.write\([^;]+process\.exit\(0\)/s);
  assert.match(controlLauncher, /process\.stderr\.write\([^;]+process\.exit\(1\)/s);
  assert.match(script, /runDemoLlmAdaptation/u);
  assert.match(script, /withoutProviderSecrets/u);
  assert.doesNotMatch(script, /DEEPSEEK_API_KEY|rawPrompt|rawResponse/u);
});

test("certifies failed-action-first adaptation, resumed completion, and zero-call replay", () => {
  const result = evaluateDemoLlmAdaptation(validInput());
  assert.equal(result.providerCallCount, 2);
  assert.equal(result.retryCount, 0);
  assert.equal(result.reviewOutcome, "approved");
  assert.equal(result.applyOutcome, "applied");
  assert.equal(result.postApplyValidationStatus, "succeeded");
  assert.notEqual(result.startingExecutionDigest, result.resultingExecutionDigest);
  assert.equal(result.recordingCountBefore, result.recordingCountAfter);
  assert.equal(result.recordingProvenanceAbsent, true);
  assert.equal(result.finalReplayProviderCallCount, 0);
  assert.equal(result.evaluation.verdict, "passed");
});

test("requires exactly diagnosis then patch calls and rejects retries or invalid accounting", () => {
  const tripled = validInput(); tripled.invocations.push({ ...tripled.invocations[1], requestId: "request.extra" });
  assert.throws(() => evaluateDemoLlmAdaptation(tripled), /exactly two/);
  for (const [index, field, value] of [[0, "purpose", "runtime_patch"], [1, "purpose", "runtime_diagnosis"], [1, "retryCount", 1], [1, "attempt", 2], [1, "providerCallCount", 2]] as const) {
    const input = validInput(); input.invocations[index][field] = value;
    assert.throws(() => evaluateDemoLlmAdaptation(input), /fixed safety fact/);
  }
  for (const [field, value] of [["inputTokens", 4001], ["outputTokens", 1001], ["totalTokens", 5001], ["estimatedCostUsd", 0.251], ["latencyMs", Number.NaN]] as const) {
    const input = validInput(); input.invocations[1][field] = value;
    assert.throws(() => evaluateDemoLlmAdaptation(input), /budget|finite/);
  }
  const mismatch = validInput(); mismatch.invocations[1].totalTokens = 1699;
  assert.throws(() => evaluateDemoLlmAdaptation(mismatch), /budget/);
  const missing = validInput(); delete missing.invocations[1].totalTokens;
  assert.throws(() => evaluateDemoLlmAdaptation(missing), /missing or unsupported/);
  const wrongPrompt = validInput(); wrongPrompt.invocations[1].promptSchemaVersion = "automation-studio.runtime-diagnosis.v1";
  assert.throws(() => evaluateDemoLlmAdaptation(wrongPrompt), /fixed safety fact/);
  const duplicateRequest = validInput(); duplicateRequest.invocations[1].requestId = duplicateRequest.invocations[0].requestId; duplicateRequest.adaptation.requestId = duplicateRequest.invocations[0].requestId;
  assert.throws(() => evaluateDemoLlmAdaptation(duplicateRequest), /distinct request identities/);
});

test("rejects provider calls before failure and invalid failure-invocation-apply-resume ordering", () => {
  for (const mutate of [
    (input: any) => { input.failedAction.providerCallCountBeforeFailure = 1; },
    (input: any) => { input.failedAction.status = "succeeded"; },
    (input: any) => { input.invocations[0].sequence = 9; },
    (input: any) => { input.invocations[1].sequence = 19; },
    (input: any) => { input.adaptation.applySequence = 24; },
    (input: any) => { input.postApplyValidation.completionSequence = 29; },
  ]) {
    const input = validInput(); mutate(input);
    assert.throws(() => evaluateDemoLlmAdaptation(input), /fixed safety fact|ordering/);
  }
});

test("rejects stale, concurrent, unreviewed, preapproval, unsafe, unsupported, or unchanged adaptation", () => {
  for (const mutate of [
    (input: any) => { input.adaptation.requestId = "request.other"; },
    (input: any) => { input.adaptation.baseExecutionDigest = "digest.other"; },
    (input: any) => { input.adaptation.resultingExecutionDigest = "digest.created"; input.postApplyValidation.executionDigest = "digest.created"; input.finalReplay.executionDigest = "digest.created"; },
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

test("rejects missing semantic drift, non-creation graph, failed post-apply validation, any recording use, and assisted replay", () => {
  for (const mutate of [
    (input: any) => { input.startingGraph.creationCertified = false; },
    (input: any) => { input.startingGraph.executableNodeCount = 2; },
    (input: any) => { input.drift.kind = "layout-only"; },
    (input: any) => { input.drift.afterTargetFingerprint = "target.before"; },
    (input: any) => { input.postApplyValidation.runId = "run.adapt.one"; },
    (input: any) => { input.postApplyValidation.status = "failed"; },
    (input: any) => { input.postApplyValidation.succeededActionCount = 1; },
    (input: any) => { input.startingGraph.recordingCount = 1; input.adaptation.recordingCount = 1; },
    (input: any) => { input.adaptation.recordingCount = 1; },
    (input: any) => { input.adaptation.recordingProvenanceAbsent = false; },
    (input: any) => { input.finalReplay.providerCallCount = 1; },
    (input: any) => { input.finalReplay.interventionCount = 1; },
    (input: any) => { input.finalReplay.adaptationCount = 1; },
    (input: any) => { input.finalReplay.succeededActionCount = 2; },
  ]) {
    const input = validInput(); mutate(input);
    assert.throws(() => evaluateDemoLlmAdaptation(input), /fixed safety fact|creation-certified|semantic target|validation|recording|replay/);
  }
});

test("rejects raw prompt, response, key, credential, recording identity, and unknown fields", () => {
  for (const field of ["rawPrompt", "rawResponse", "apiKey", "keyId", "credential", "password", "pin", "authorizationHeader", "recordingId", "lastRecordingId", "recordingEvents", "recordingEvidence", "recordingMetadata"]) {
    const input = validInput(); input.adaptation[field] = "forbidden";
    assert.throws(() => evaluateDemoLlmAdaptation(input), /forbidden sensitive or recording/);
  }
  const recordingIdentity = validInput(); recordingIdentity.adaptation.adaptationId = "recording.adaptation";
  assert.throws(() => evaluateDemoLlmAdaptation(recordingIdentity), /identifier is invalid/);
  const extra = validInput(); extra.postApplyValidation.arbitrary = true;
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
