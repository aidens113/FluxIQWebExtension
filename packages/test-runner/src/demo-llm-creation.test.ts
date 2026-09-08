import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { FIRST_LIVE_CREATION_PROFILE, evaluateDemoLlmCreation, persistDemoLlmCreationResult } from "./demo-llm-creation.js";

function validInput(): any {
  return {
    schemaVersion: "0.1",
    operationId: "operation.create.one",
    blankBefore: {
      certified: true, projectId: "project.one", flowId: "flow.one", baseExecutionDigest: "digest.before",
      nodeCount: 0, edgeCount: 0, ownedSubflowCount: 0, routerSubflowRouteCount: 0,
      recordingCount: 2, recordingProvenanceAbsent: true,
    },
    invocations: [{
      requestId: "request.one", purpose: "flow_bootstrap", provider: "deepseek", model: "deepseek-chat",
      promptSchemaVersion: "automation-studio.flow-bootstrap.v1", attempt: 1, retryCount: 0, providerCallCount: 1,
      inputTokens: 1_200, outputTokens: 300, totalTokens: 1_500, estimatedCostUsd: 0.02, latencyMs: 500,
    }],
    proposal: { proposalId: "proposal.one", proposalDigest: "digest.proposal", baseExecutionDigest: "digest.before", validationOk: true, stale: false, unsupportedOutputCount: 0 },
    review: { proposalId: "proposal.one", outcome: "approved", channel: "human-ui", mutationObservedBeforeApproval: false },
    apply: {
      proposalId: "proposal.one", baseExecutionDigest: "digest.before", resultingExecutionDigest: "digest.after", outcome: "applied",
      routerId: "router.one", routerSubflowId: "subflow.one", ownedSubflowId: "subflow.one", graphFlowId: "flow.graph.one",
      ownedSubflowCount: 1, routerSubflowRouteCount: 1,
      nodeCount: 3, edgeCount: 2, executableNodeCount: 3, overlappingPositionCount: 0, deterministicLayout: true, unsupportedOutputCount: 0,
      recordingCount: 2, recordingProvenanceAbsent: true,
    },
    replay: { runId: "run.replay.one", status: "succeeded", executionDigest: "digest.after", providerCallCount: 0, interventionCount: 0, actionAttemptCount: 3, succeededActionCount: 3 },
  };
}

function clone<T>(value: T): T { return structuredClone(value); }

test("first creation profile enforces the one-call strict live ceiling", () => {
  assert.deepEqual(FIRST_LIVE_CREATION_PROFILE.budget, {
    maxInputTokens: 2_000, maxOutputTokens: 512, maxTotalTokensPerRequest: 3_000,
    maxCallsPerRun: 1, timeoutMs: 20_000, maxRetries: 0, maxEstimatedCostUsd: 0.25,
  });
  assert.equal(FIRST_LIVE_CREATION_PROFILE.task, "create-flow");
  assert.equal(FIRST_LIVE_CREATION_PROFILE.approvalMode, "manual");
  assert.equal(FIRST_LIVE_CREATION_PROFILE.retainRawPrompts, false);
  assert.equal(FIRST_LIVE_CREATION_PROFILE.retainRawResponses, false);
});

test("certifies one reviewed blank-flow bootstrap and zero-call deterministic replay", () => {
  const result = evaluateDemoLlmCreation(validInput());
  assert.equal(result.providerCallCount, 1);
  assert.equal(result.retryCount, 0);
  assert.equal(result.reviewOutcome, "approved");
  assert.equal(result.applyOutcome, "applied");
  assert.equal(result.topology.ownedSubflowCount, 1);
  assert.equal(result.topology.routerSubflowRouteCount, 1);
  assert.equal(result.topology.nodeCount, 3);
  assert.equal(result.topology.deterministicLayout, true);
  assert.equal(result.topology.overlappingPositionCount, 0);
  assert.equal(result.recordingCountBefore, result.recordingCountAfter);
  assert.equal(result.recordingProvenanceAbsent, true);
  assert.equal(result.replayProviderCallCount, 0);
  assert.equal(result.evaluation.verdict, "passed");
  assert.equal(result.evaluation.invocations.length, 1);
});

test("rejects missing, extra, nonfinite, retried, or over-budget provider accounting", () => {
  const extra = validInput(); extra.invocations.push(clone(extra.invocations[0]));
  assert.throws(() => evaluateDemoLlmCreation(extra), /exactly one/);
  for (const [field, value] of [["retryCount", 1], ["providerCallCount", 2], ["attempt", 2]] as const) {
    const input = validInput(); input.invocations[0][field] = value;
    assert.throws(() => evaluateDemoLlmCreation(input), /fixed safety fact/);
  }
  for (const [field, value] of [["inputTokens", 2001], ["outputTokens", 513], ["totalTokens", 3001], ["estimatedCostUsd", 0.251], ["latencyMs", Number.NaN]] as const) {
    const input = validInput(); input.invocations[0][field] = value;
    assert.throws(() => evaluateDemoLlmCreation(input), /budget|finite/);
  }
  const mismatch = validInput(); mismatch.invocations[0].totalTokens = 1499;
  assert.throws(() => evaluateDemoLlmCreation(mismatch), /budget/);
  const missing = validInput(); delete missing.invocations[0].totalTokens;
  assert.throws(() => evaluateDemoLlmCreation(missing), /missing or unsupported/);
});

test("rejects uncertified blank state, stale or invalid proposals, and mutation before UI approval", () => {
  for (const mutate of [
    (input: any) => { input.blankBefore.nodeCount = 1; },
    (input: any) => { input.blankBefore.recordingProvenanceAbsent = false; },
    (input: any) => { input.proposal.validationOk = false; },
    (input: any) => { input.proposal.stale = true; },
    (input: any) => { input.proposal.baseExecutionDigest = "digest.other"; },
    (input: any) => { input.review.outcome = "pending"; },
    (input: any) => { input.review.channel = "api"; },
    (input: any) => { input.review.mutationObservedBeforeApproval = true; },
    (input: any) => { input.apply.proposalId = "proposal.other"; },
  ]) {
    const input = validInput(); mutate(input);
    assert.throws(() => evaluateDemoLlmCreation(input), /fixed safety fact|stale|unbound|review/);
  }
});

test("rejects unsupported, disconnected, overlapping, unowned, unchanged, or recording-derived output", () => {
  for (const mutate of [
    (input: any) => { input.proposal.unsupportedOutputCount = 1; },
    (input: any) => { input.apply.unsupportedOutputCount = 1; },
    (input: any) => { input.apply.ownedSubflowCount = 0; },
    (input: any) => { input.apply.routerSubflowRouteCount = 0; },
    (input: any) => { input.apply.deterministicLayout = false; },
    (input: any) => { input.apply.overlappingPositionCount = 1; },
    (input: any) => { input.apply.nodeCount = 0; input.apply.executableNodeCount = 0; input.apply.edgeCount = 0; },
    (input: any) => { input.apply.executableNodeCount = 2; },
    (input: any) => { input.apply.edgeCount = 1; },
    (input: any) => { input.apply.routerSubflowId = "subflow.other"; },
    (input: any) => { input.apply.resultingExecutionDigest = "digest.before"; input.replay.executionDigest = "digest.before"; },
    (input: any) => { input.apply.recordingCount = 3; },
    (input: any) => { input.apply.recordingProvenanceAbsent = false; },
  ]) {
    const input = validInput(); mutate(input);
    assert.throws(() => evaluateDemoLlmCreation(input), /fixed safety fact|topology|recording|changed/);
  }
});

test("rejects failed or LLM-assisted replay", () => {
  for (const mutate of [
    (input: any) => { input.replay.status = "failed"; },
    (input: any) => { input.replay.providerCallCount = 1; },
    (input: any) => { input.replay.interventionCount = 1; },
    (input: any) => { input.replay.executionDigest = "digest.other"; },
    (input: any) => { input.replay.succeededActionCount = 2; },
    (input: any) => { input.replay.actionAttemptCount = 0; input.replay.succeededActionCount = 0; },
  ]) {
    const input = validInput(); mutate(input);
    assert.throws(() => evaluateDemoLlmCreation(input), /fixed safety fact|replay/);
  }
});

test("rejects raw prompt, response, key, credential, recording identity, and unknown fields", () => {
  for (const field of ["rawPrompt", "rawResponse", "apiKey", "keyId", "credential", "password", "pin", "authorizationHeader", "recordingId", "lastRecordingId", "recordingEvents", "recordingEvidence", "recordingMetadata"]) {
    const input = validInput(); input.proposal[field] = "forbidden";
    assert.throws(() => evaluateDemoLlmCreation(input), /forbidden sensitive or recording/);
  }
  const recordingIdentity = validInput(); recordingIdentity.proposal.proposalId = "recording.proposal";
  assert.throws(() => evaluateDemoLlmCreation(recordingIdentity), /identifier is invalid/);
  const extra = validInput(); extra.apply.arbitrary = true;
  assert.throws(() => evaluateDemoLlmCreation(extra), /missing or unsupported/);
});

test("persists only sanitized creation certification with leak attestation", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-creation-result-"));
  const sensitive = "SENSITIVE_LITERAL_NOT_FOR_ARTIFACT";
  try {
    const result = await persistDemoLlmCreationResult(root, evaluateDemoLlmCreation(validInput()), [sensitive]);
    assert.equal(result.leakAttestation.status, "passed");
    assert.equal(result.leakAttestation.findingCount, 0);
    const text = await readFile(path.join(root, "demo-llm-creation-result.json"), "utf8");
    assert.equal(text.includes(sensitive), false);
    const persisted = JSON.parse(text) as Record<string, unknown>;
    const forbiddenKeys = new Set(["rawPrompt", "rawResponse", "apiKey", "keyId", "credential", "password", "pin", "authorizationHeader", "recordingId", "lastRecordingId", "recordingEvents", "recordingEvidence", "recordingMetadata"]);
    const visit = (value: unknown): void => {
      if (!value || typeof value !== "object") return;
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) { assert.equal(forbiddenKeys.has(key), false, key); visit(child); }
    };
    visit(persisted);
    assert.deepEqual(persisted, result);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
