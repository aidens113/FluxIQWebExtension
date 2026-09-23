import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { type DemoLlmAdaptationCertificationInput, FIRST_LIVE_ADAPTATION_PROFILE, evaluateDemoLlmAdaptation, persistDemoLlmAdaptationResult } from "../demo-llm-adaptation.js";
import { DEFAULT_LLM_MODEL } from "@fluxiq-web-extension/test-contracts";

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
    providerCallCount: 2,
    invocations: [{
      requestId: "request.diagnosis.one", purpose: "runtime_diagnosis", provider: "deepseek", model: DEFAULT_LLM_MODEL,
      promptSchemaVersion: "automation-studio.runtime-diagnosis.v1", sequence: 20, attempt: 1, retryCount: 0, providerCallCount: 1,
      inputTokens: 1_400, outputTokens: 300, totalTokens: 1_700, estimatedCostUsd: 0.02, latencyMs: 600,
    }, {
      requestId: "request.adapt.one", purpose: "runtime_patch", provider: "deepseek", model: DEFAULT_LLM_MODEL,
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

// The same run after it gathered evidence `count` times between its diagnosis
// and its patch. Every later event moves after the last call, and the run's
// reported call count covers every call. The evidence prompt version is Core's
// own, staged as Core stages it for a recovery's gathering calls.
function withEvidenceCalls(input: any, count: number): any {
  const [diagnosis, patch] = input.invocations;
  const evidence = Array.from({ length: count }, (_, index) => ({
    requestId: `request.evidence.${index + 1}`, purpose: "runtime_evidence", provider: "deepseek", model: DEFAULT_LLM_MODEL,
    promptSchemaVersion: "automation-studio.evidence-tool-decision.v1+stage.gather", sequence: diagnosis.sequence + index + 1, attempt: 1, retryCount: 0, providerCallCount: 1,
    inputTokens: 1_000 + index, outputTokens: 100, totalTokens: 1_100 + index, estimatedCostUsd: 0.01, latencyMs: 400,
  }));
  const patchSequence = diagnosis.sequence + count + 1;
  input.invocations = [diagnosis, ...evidence, { ...patch, sequence: patchSequence }];
  input.providerCallCount = count + 2;
  input.adaptation.applySequence = patchSequence + 1;
  input.postApplyValidation.completionSequence = patchSequence + 2;
  return input;
}

test("first adaptation profile bounds each call strictly and lets the adaptation iterate", () => {
  // The call count is a ceiling, not a count the certificate below requires:
  // an adaptation may gather evidence between its diagnosis and patch.
  assert.deepEqual(FIRST_LIVE_ADAPTATION_PROFILE.budget, {
    maxInputTokens: 48_000, maxOutputTokens: 8_000, maxTotalTokensPerRequest: 56_000,
    maxCallsPerRun: 26, timeoutMs: 30_000, maxRetries: 0, maxEstimatedCostUsd: 0.25,
  });
  assert.equal(FIRST_LIVE_ADAPTATION_PROFILE.task, "adapt");
  assert.equal(FIRST_LIVE_ADAPTATION_PROFILE.approvalMode, "manual");
  assert.equal(FIRST_LIVE_ADAPTATION_PROFILE.retainRawPrompts, false);
  assert.equal(FIRST_LIVE_ADAPTATION_PROFILE.retainRawResponses, false);
});

test("adaptation launcher exposes normal and no-build focused commands without embedding provider secrets", async () => {
  const root = path.resolve(import.meta.dirname, "../../../..");
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
  assert.equal(result.evidenceCallCount, 0);
  assert.equal(result.evaluation.invocations.length, 2);
  assert.deepEqual(result.evaluation.invocations.map(item => item.requestId), ["request.diagnosis.one", "request.adapt.one"]);
  assert.equal(result.evaluation.maxCallsPerRun, FIRST_LIVE_ADAPTATION_PROFILE.budget.maxCallsPerRun);
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

test("certifies an adaptation that gathered evidence, recording every call it made", () => {
  const result = evaluateDemoLlmAdaptation(withEvidenceCalls(validInput(), 3));
  assert.equal(result.providerCallCount, 5);
  assert.equal(result.evidenceCallCount, 3);
  assert.equal(result.evaluation.invocations.length, 5);
  assert.deepEqual(result.evaluation.invocations.map(item => item.requestId), [
    "request.diagnosis.one", "request.evidence.1", "request.evidence.2", "request.evidence.3", "request.adapt.one",
  ]);
  assert.deepEqual(result.evaluation.invocations.map(item => item.promptSchemaVersion), [
    "automation-studio.runtime-diagnosis.v1",
    "automation-studio.evidence-tool-decision.v1", "automation-studio.evidence-tool-decision.v1", "automation-studio.evidence-tool-decision.v1",
    "automation-studio.runtime-patch.v1",
  ]);
  // Each call's own usage is kept, so the run's spend can be read in full.
  assert.deepEqual(result.evaluation.invocations.map(item => item.totalTokens), [1_700, 1_100, 1_101, 1_102, 1_820]);
  assert.deepEqual(result.evaluation.invocations.map(item => item.estimatedCostUsd), [0.02, 0.01, 0.01, 0.01, 0.03]);
  assert.ok(result.evaluation.invocations.every(item => item.attempt === 1 && item.outcome === "succeeded"));
  assert.match(result.evaluation.reasons[0] ?? "", /5 provider calls: one diagnosis, 3 gathering evidence, and one patch/);
  assert.equal(result.adaptationId, "adaptation.one");
  assert.equal(result.finalReplayProviderCallCount, 0);
  assert.equal(result.evaluation.deterministicReplay.llmCalls, 0);
  assert.equal(result.evaluation.verdict, "passed");
});

// Core stages every recovery prompt as `<schema>+stage.<stage>`. Each call's
// schema and its stage are pinned; the evaluation records the schema alone,
// because the Lab's provenance identifier has no room for a `+`.
test("accepts each call's prompt staged at its own stage, and only there", () => {
  const staged = withEvidenceCalls(validInput(), 2);
  staged.invocations[0].promptSchemaVersion = "automation-studio.runtime-diagnosis.v1+stage.gather";
  staged.invocations[3].promptSchemaVersion = "automation-studio.runtime-patch.v1+stage.implement";
  assert.deepEqual(evaluateDemoLlmAdaptation(staged).evaluation.invocations.map(item => item.promptSchemaVersion), [
    "automation-studio.runtime-diagnosis.v1", "automation-studio.evidence-tool-decision.v1", "automation-studio.evidence-tool-decision.v1", "automation-studio.runtime-patch.v1",
  ]);
  const unstagedEvidence = withEvidenceCalls(validInput(), 1); unstagedEvidence.invocations[1].promptSchemaVersion = "automation-studio.evidence-tool-decision.v1";
  assert.equal(evaluateDemoLlmAdaptation(unstagedEvidence).evidenceCallCount, 1);
  for (const [index, prompt] of [
    [0, "automation-studio.runtime-diagnosis.v1+stage.implement"], [0, "automation-studio.runtime-diagnosis.v1+stage.gather+x"],
    [1, "automation-studio.evidence-tool-decision.v1+stage.verify"], [2, "automation-studio.runtime-patch.v1+stage.gather"],
    [2, "automation-studio.runtime-patch.v1+stage.implement+"],
  ] as const) {
    const input = withEvidenceCalls(validInput(), 1); input.invocations[index].promptSchemaVersion = prompt;
    assert.throws(() => evaluateDemoLlmAdaptation(input), /fixed safety fact/, prompt);
  }
});

// The certificate once took `unknown`, so a caller that forgot the run's call
// count compiled and failed only at run time, after apply. The directive below
// fails the build if the parameter ever stops being typed.
test("a certificate input without the run's call count does not compile, and is refused if forced", () => {
  const { providerCallCount: _count, ...uncounted } = validInput() as DemoLlmAdaptationCertificationInput;
  assert.throws(() => evaluateDemoLlmAdaptation(
    // @ts-expect-error -- `providerCallCount` is required.
    uncounted,
  ), /missing or unsupported/);
});

test("refuses a certificate whose call count disagrees with its invocations", () => {
  // Understated: the run made five calls but only the diagnosis and patch were recorded.
  const understated = validInput(); understated.providerCallCount = 5;
  // Overstated: five calls recorded for a run that reported two.
  const overstated = withEvidenceCalls(validInput(), 3); overstated.providerCallCount = 2;
  const oneShort = withEvidenceCalls(validInput(), 3); oneShort.providerCallCount = 6;
  for (const input of [understated, overstated, oneShort]) {
    assert.throws(() => evaluateDemoLlmAdaptation(input), /every call must be recorded/);
  }
  const unreported = validInput(); delete unreported.providerCallCount;
  assert.throws(() => evaluateDemoLlmAdaptation(unreported), /missing or unsupported/);
  for (const value of [2.5, -2, "2", Number.NaN, null]) {
    const input = validInput(); input.providerCallCount = value;
    assert.throws(() => evaluateDemoLlmAdaptation(input), /finite nonnegative integers/, String(value));
  }
});

test("certifies up to the grant's ceiling and refuses a call count past it", () => {
  const ceiling = FIRST_LIVE_ADAPTATION_PROFILE.budget.maxCallsPerRun;
  const atCeiling = evaluateDemoLlmAdaptation(withEvidenceCalls(validInput(), ceiling - 2));
  assert.equal(atCeiling.providerCallCount, ceiling);
  assert.equal(atCeiling.evaluation.invocations.length, ceiling);
  assert.throws(() => evaluateDemoLlmAdaptation(withEvidenceCalls(validInput(), ceiling - 1)), /grant could not have produced/);
});

test("requires exactly one diagnosis first and one patch last, and rejects retries or invalid accounting", () => {
  const diagnosis = () => validInput().invocations[0];
  const patch = () => validInput().invocations[1];
  const evidence = () => withEvidenceCalls(validInput(), 1).invocations[1];
  const shapes: Array<[string, any[]]> = [
    ["two patches", [diagnosis(), { ...patch(), requestId: "request.adapt.extra", sequence: 22 }, { ...patch(), sequence: 25 }]],
    ["two patches around evidence", [diagnosis(), { ...patch(), requestId: "request.adapt.extra", sequence: 21 }, { ...evidence(), sequence: 22 }, patch()]],
    ["two diagnoses", [diagnosis(), { ...diagnosis(), requestId: "request.diagnosis.two", sequence: 21 }, patch()]],
    ["no diagnosis", [{ ...evidence(), sequence: 20 }, patch()]],
    ["patch first", [{ ...patch(), sequence: 20 }, { ...patch(), requestId: "request.adapt.extra", sequence: 25 }]],
    ["diagnosis last", [diagnosis(), { ...diagnosis(), requestId: "request.diagnosis.two", sequence: 25 }]],
    ["evidence last", [diagnosis(), { ...evidence(), sequence: 25 }]],
    ["swapped", [{ ...patch(), sequence: 20 }, { ...diagnosis(), sequence: 25 }]],
  ];
  for (const [name, invocations] of shapes) {
    const input = validInput(); input.invocations = invocations; input.providerCallCount = invocations.length;
    assert.throws(() => evaluateDemoLlmAdaptation(input), /exactly one diagnosis first, exactly one patch last/, name);
  }
  for (const invocations of [[diagnosis()], [patch()], []]) {
    const input = validInput(); input.invocations = invocations; input.providerCallCount = invocations.length;
    assert.throws(() => evaluateDemoLlmAdaptation(input), /requires a diagnosis invocation and a patch invocation/);
  }
  const notArray = validInput(); notArray.invocations = { 0: diagnosis(), 1: patch() };
  assert.throws(() => evaluateDemoLlmAdaptation(notArray), /requires a diagnosis invocation and a patch invocation/);
  const position = { diagnosis: 0, evidence: 1, patch: 2 } as const;
  for (const [call, field, value] of [
    ["patch", "retryCount", 1], ["patch", "attempt", 2], ["patch", "providerCallCount", 2], ["diagnosis", "provider", "openai"],
    ["evidence", "retryCount", 1], ["evidence", "attempt", 2], ["evidence", "providerCallCount", 2], ["evidence", "model", "other-model"],
  ] as const) {
    const input = withEvidenceCalls(validInput(), 1);
    input.invocations[position[call]][field] = value;
    assert.throws(() => evaluateDemoLlmAdaptation(input), /fixed safety fact/, `${call}.${field}`);
  }
  for (const [field, value] of [["inputTokens", 4001], ["outputTokens", 1001], ["totalTokens", 5001], ["estimatedCostUsd", 0.251], ["latencyMs", Number.NaN]] as const) {
    const input = validInput(); input.invocations[1][field] = value;
    assert.throws(() => evaluateDemoLlmAdaptation(input), /budget|finite/);
    const evidenceInput = withEvidenceCalls(validInput(), 2); evidenceInput.invocations[2][field] = value;
    assert.throws(() => evaluateDemoLlmAdaptation(evidenceInput), /budget|finite/, `evidence ${field}`);
  }
  const mismatch = validInput(); mismatch.invocations[1].totalTokens = 1699;
  assert.throws(() => evaluateDemoLlmAdaptation(mismatch), /budget/);
  const evidenceMismatch = withEvidenceCalls(validInput(), 1); evidenceMismatch.invocations[1].totalTokens = 1_099;
  assert.throws(() => evaluateDemoLlmAdaptation(evidenceMismatch), /budget/);
  const missing = validInput(); delete missing.invocations[1].totalTokens;
  assert.throws(() => evaluateDemoLlmAdaptation(missing), /missing or unsupported/);
  const evidenceMissing = withEvidenceCalls(validInput(), 1); delete evidenceMissing.invocations[1].latencyMs;
  assert.throws(() => evaluateDemoLlmAdaptation(evidenceMissing), /missing or unsupported/);
  const wrongPrompt = validInput(); wrongPrompt.invocations[1].promptSchemaVersion = "automation-studio.runtime-diagnosis.v1";
  assert.throws(() => evaluateDemoLlmAdaptation(wrongPrompt), /fixed safety fact/);
  const wrongDiagnosisPrompt = withEvidenceCalls(validInput(), 1); wrongDiagnosisPrompt.invocations[0].promptSchemaVersion = "automation-studio.evidence-tool-decision.v1";
  assert.throws(() => evaluateDemoLlmAdaptation(wrongDiagnosisPrompt), /fixed safety fact/);
  // A call labelled as evidence but carrying the diagnosis or patch prompt is a
  // second diagnosis or patch in disguise.
  for (const prompt of ["automation-studio.runtime-diagnosis.v1", "automation-studio.runtime-patch.v1", "automation-studio.runtime-diagnosis.v1+stage.gather"]) {
    const input = withEvidenceCalls(validInput(), 2); input.invocations[2].promptSchemaVersion = prompt;
    assert.throws(() => evaluateDemoLlmAdaptation(input), /must not carry the diagnosis or patch prompt/);
  }
  for (const prompt of ["evidence prompt", "automation-studio.runtime-evidence.v1", "automation-studio.evidence-tool-decision.v2+stage.gather", 7]) {
    const unpinned = withEvidenceCalls(validInput(), 1); unpinned.invocations[1].promptSchemaVersion = prompt;
    assert.throws(() => evaluateDemoLlmAdaptation(unpinned), /fixed safety fact/, String(prompt));
  }
  const duplicateRequest = validInput(); duplicateRequest.invocations[1].requestId = duplicateRequest.invocations[0].requestId; duplicateRequest.adaptation.requestId = duplicateRequest.invocations[0].requestId;
  assert.throws(() => evaluateDemoLlmAdaptation(duplicateRequest), /distinct request identities/);
  for (const [left, right] of [[1, 2], [0, 2], [3, 1]] as const) {
    const input = withEvidenceCalls(validInput(), 2);
    input.invocations[right].requestId = input.invocations[left].requestId;
    input.adaptation.requestId = input.invocations[3].requestId;
    assert.throws(() => evaluateDemoLlmAdaptation(input), /distinct request identities/, `${left}=${right}`);
  }
  // The applied change must be bound to the patch, not to any other call.
  const boundToEvidence = withEvidenceCalls(validInput(), 1); boundToEvidence.adaptation.requestId = "request.evidence.1";
  assert.throws(() => evaluateDemoLlmAdaptation(boundToEvidence), /stale, unbound/);
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
  // With evidence calls (diagnosis 20, evidence 21-22, patch 23, apply 24,
  // validation 25), every call must sit strictly between its neighbours.
  for (const mutate of [
    (input: any) => { input.invocations[1].sequence = 20; },
    (input: any) => { input.invocations[1].sequence = 19; },
    (input: any) => { input.invocations[1].sequence = 22; },
    (input: any) => { input.invocations[2].sequence = 23; },
    (input: any) => { input.invocations[2].sequence = 24; },
    (input: any) => { input.invocations[3].sequence = 22; },
    (input: any) => { input.adaptation.applySequence = 23; },
  ]) {
    const input = withEvidenceCalls(validInput(), 2); mutate(input);
    assert.throws(() => evaluateDemoLlmAdaptation(input), /ordering/);
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
    (input: any) => { input.startingGraph.recordingCount = 2; input.adaptation.recordingCount = 3; },
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

    const iterated = await persistDemoLlmAdaptationResult(root, evaluateDemoLlmAdaptation(withEvidenceCalls(validInput(), 3)), [sensitive]);
    const iteratedText = JSON.parse(await readFile(path.join(root, "demo-llm-adaptation-result.json"), "utf8")) as typeof iterated;
    assert.equal(iteratedText.providerCallCount, 5);
    assert.equal(iteratedText.evidenceCallCount, 3);
    assert.equal(iteratedText.evaluation.invocations.length, 5);
    assert.deepEqual(iteratedText, iterated);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

// The demo project also holds the recording-driven diagnosis Flow, so it is
// never recording-free. What an instruction-only repair must not do is add a
// recording or put recording provenance in the repaired Flow; a live repair
// was refused only because the project already had recordings of its own.
test("a project that already holds other Flows' recordings passes when the repair adds none", () => {
  const input = validInput();
  input.startingGraph.recordingCount = 2;
  input.adaptation.recordingCount = 2;
  const result = evaluateDemoLlmAdaptation(input);
  assert.equal(result.recordingCountBefore, 2);
  assert.equal(result.recordingCountAfter, 2);
  assert.equal(result.recordingProvenanceAbsent, true);
});
