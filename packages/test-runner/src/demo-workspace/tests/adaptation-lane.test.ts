// The adaptation lane's certificate input. The lane itself drives a real
// browser and panel, so what can be exercised directly is the pure step that
// turns Core's per-call lines into the certificate's invocations; where the
// lane calls it, and what it hands the certificate, is held at source level.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { type DemoLlmAdaptationCertificationInput, evaluateDemoLlmAdaptation } from "../../demo-llm-adaptation.js";
import type { ExistingRunIntervention, ExistingRunProviderCall } from "../../existing-fluxiq-control.js";
import { type AdaptationCertificateCalls, adaptationCertificateCalls } from "../adaptation-lane.js";
import { DEFAULT_LLM_MODEL } from "@fluxiq-web-extension/test-contracts";

const sourceDirectory = path.resolve(import.meta.dirname, "../../../../../packages/test-runner/src/demo-workspace");

const PROMPTS: Record<string, string> = {
  runtime_diagnosis: "automation-studio.runtime-diagnosis.v1+stage.gather",
  evidence_tool_decision: "automation-studio.evidence-tool-decision.v1+stage.gather",
  runtime_patch: "automation-studio.runtime-patch.v1+stage.implement",
};

function line(sequence: number, taskKind: string, overrides: Partial<ExistingRunProviderCall> = {}): ExistingRunProviderCall {
  const reported = { inputTokens: 1_000 + sequence, outputTokens: 100, totalTokens: 1_100 + sequence, estimatedCostUsd: 0.001 };
  return {
    sequence, requestId: `llm.${taskKind}.${sequence}`, taskKind, stage: taskKind === "runtime_patch" ? "implement" : "gather",
    allowance: taskKind === "evidence_tool_decision" ? "exploration" : "run", promptVersion: PROMPTS[taskKind] ?? null,
    provider: "deepseek", model: DEFAULT_LLM_MODEL, validationOk: true, validationCodes: [], ...reported,
    charged: { ...reported, tokens: "reported", cost: "reported" }, budgetBreach: false, ...overrides,
  };
}

const lines = [line(1, "runtime_diagnosis"), line(2, "evidence_tool_decision"), line(3, "evidence_tool_decision"), line(4, "runtime_patch")];
const run = (calls: ExistingRunProviderCall[] = lines) => ({ providerCallCount: calls.length, providerCalls: calls, providerCallsOmitted: 0 });
const intervention = (kind: ExistingRunIntervention["kind"], requestId: string): ExistingRunIntervention => ({ interventionId: `intervention.${kind}`, kind, requestId });
const interventions = { diagnosis: intervention("diagnosis", lines[0]!.requestId), patch: intervention("runtime_patch", lines[3]!.requestId) };
// The diagnosis and patch events are adjacent, as Core writes them: the
// evidence calls have no event of their own and must still fit between them.
const events = { failed: 10, diagnosis: 20, patch: 21 };

/** The certificate input exactly as the lane assembles it around the built calls. */
function certificateInput(calls: AdaptationCertificateCalls): DemoLlmAdaptationCertificationInput {
  return {
    schemaVersion: "0.1",
    operationId: "adaptation.lane-test",
    startingGraph: { creationCertified: true, projectId: "project.one", flowId: "flow.one", startingExecutionDigest: "digest.created", ownedSubflowCount: 1, routerSubflowRouteCount: 1, nodeCount: 3, executableNodeCount: 3, recordingCount: 0, recordingProvenanceAbsent: true },
    drift: { kind: "semantic-target", scenarioId: "instruction-only-form", beforeTargetFingerprint: "target.before", afterTargetFingerprint: "target.after", introducedBeforeRun: true, observed: true },
    failedAction: { runId: "run.adapt", attemptId: "attempt.failed", sequence: calls.failedSequence, status: "failed", providerCallCountBeforeFailure: 0 },
    providerCallCount: calls.providerCallCount,
    invocations: calls.invocations,
    adaptation: { adaptationId: "adaptation.one", requestId: calls.patchRequestId, baseExecutionDigest: "digest.created", resultingExecutionDigest: "digest.adapted", validationOk: true, stale: false, concurrentMutationDetected: false, reviewOutcome: "approved", approvalChannel: "human-ui", mutationObservedBeforeApproval: false, outcome: "applied", applySequence: calls.applySequence, structuralChange: false, externalSideEffectEscalation: false, authorizationExpansion: false, unsupportedOutputCount: 0, recordingCount: 0, recordingProvenanceAbsent: true },
    postApplyValidation: { runId: "run.validation", status: "succeeded", completionSequence: calls.completionSequence, executionDigest: "digest.adapted", providerCallCount: 0, interventionCount: 0, diagnosisCount: 0, adaptationCount: 0, actionAttemptCount: 3, succeededActionCount: 3 },
    finalReplay: { runId: "run.replay", status: "succeeded", executionDigest: "digest.adapted", providerCallCount: 0, interventionCount: 0, adaptationCount: 0, actionAttemptCount: 3, succeededActionCount: 3 },
  };
}

test("builds one invocation for every call Core itemized, and passes the run's own call count", () => {
  const calls = adaptationCertificateCalls(run(), interventions, events);

  assert.equal(calls.providerCallCount, 4);
  assert.deepEqual(calls.invocations.map(item => [item.purpose, item.requestId, item.promptSchemaVersion, item.totalTokens, item.sequence]), [
    ["runtime_diagnosis", "llm.runtime_diagnosis.1", PROMPTS.runtime_diagnosis, 1_101, 20 * 1_024],
    ["runtime_evidence", "llm.evidence_tool_decision.2", PROMPTS.evidence_tool_decision, 1_102, 20 * 1_024 + 1],
    ["runtime_evidence", "llm.evidence_tool_decision.3", PROMPTS.evidence_tool_decision, 1_103, 20 * 1_024 + 2],
    ["runtime_patch", "llm.runtime_patch.4", PROMPTS.runtime_patch, 1_104, 21 * 1_024],
  ]);
  assert.deepEqual([calls.failedSequence, calls.applySequence, calls.completionSequence], [10 * 1_024, 22 * 1_024, 23 * 1_024]);
  assert.equal(calls.patchRequestId, "llm.runtime_patch.4");

  // And the certificate accepts what the lane builds, recording every call.
  const result = evaluateDemoLlmAdaptation(certificateInput(calls));
  assert.equal(result.providerCallCount, 4);
  assert.equal(result.evidenceCallCount, 2);
  assert.deepEqual(result.evaluation.invocations.map(item => item.requestId), lines.map(item => item.requestId));
});

test("a run that did not iterate still certifies as its two calls", () => {
  const pair = [line(1, "runtime_diagnosis"), line(2, "runtime_patch")];
  const calls = adaptationCertificateCalls(run(pair), { diagnosis: interventions.diagnosis, patch: intervention("runtime_patch", pair[1]!.requestId) }, events);
  assert.equal(calls.providerCallCount, 2);
  assert.equal(evaluateDemoLlmAdaptation(certificateInput(calls)).evidenceCallCount, 0);
});

test("refuses, by name, any run the certificate could not record honestly", () => {
  const replaced = (index: number, overrides: Partial<ExistingRunProviderCall>) => lines.map((item, at) => at === index ? { ...item, ...overrides } : item);
  const cases: Array<[string, Parameters<typeof adaptationCertificateCalls>[0], Parameters<typeof adaptationCertificateCalls>[2], RegExp]> = [
    ["no per-call records", { providerCallCount: 4 }, events, /no per-call records/u],
    ["count above the lines", { ...run(), providerCallCount: 5 }, events, /made 5 provider calls and its run detail itemizes 4/u],
    ["count below the lines", { ...run(), providerCallCount: 3 }, events, /made 3 provider calls and its run detail itemizes 4/u],
    ["count missing", { providerCalls: lines, providerCallsOmitted: 0 }, events, /made an unreported number of provider calls/u],
    ["lines omitted", { ...run(), providerCallsOmitted: 1 }, events, /omitting 1/u],
    ["omitted count unknown", { providerCallCount: 4, providerCalls: lines }, events, /omitting an unknown number/u],
    ["one call", run([lines[0]!]), events, /1 provider calls cannot be/u],
    ["events out of order", run(), { failed: 20, diagnosis: 20, patch: 21 }, /out of order/u],
    ["first call is not the diagnosis", run(replaced(0, { requestId: "llm.other.1" })), events, /not the diagnosis and patch interventions/u],
    ["last call is not the patch", run(replaced(3, { requestId: "llm.other.4" })), events, /not the diagnosis and patch interventions/u],
    ["a middle call is not an evidence decision", run(replaced(2, { taskKind: "runtime_patch" })), events, /call 3 is runtime_patch, not evidence_tool_decision/u],
    ["a call with no task", run(replaced(1, { taskKind: null })), events, /call 2 is an unnamed task/u],
    ["another provider", run(replaced(1, { provider: "openai" })), events, /call 2 was not a deepseek\/deepseek-flash call/u],
    ["another model", run(replaced(3, { model: "deepseek-reasoner" })), events, /call 4 was not a deepseek\/deepseek-flash call/u],
    ["an invalid call", run(replaced(2, { validationOk: false })), events, /call 3 did not validate/u],
    ["an unsettled call", run(replaced(0, { validationOk: null })), events, /call 1 did not validate/u],
    ["unreported tokens", run(replaced(1, { totalTokens: null })), events, /call 2 has no provider-reported usage/u],
    ["unreported cost", run(replaced(3, { estimatedCostUsd: null })), events, /call 4 has no provider-reported usage/u],
    ["no prompt version", run(replaced(2, { promptVersion: null })), events, /call 3 has no prompt version/u],
  ];
  for (const [name, subject, order, message] of cases) {
    assert.throws(() => adaptationCertificateCalls(subject, interventions, order), (error: Error) => /Adaptation certificate cannot record this run/u.test(error.message) && message.test(error.message), name);
  }
});

// Read line by line rather than byte for byte: a fresh Windows checkout holds
// this source with CRLF, and every scan below looks for a bare newline.
function laneBody(source: string): string {
  const text = source.replace(/\r\n/gu, "\n");
  const start = text.indexOf("export async function runDemoLlmAdaptation");
  assert.notEqual(start, -1);
  // The lane's own body ends at the first closing brace in the first column.
  const end = text.indexOf("\n}\n", start);
  assert.notEqual(end, -1);
  return text.slice(start, end);
}

// The certificate's parameter is typed, so leaving the count out fails the
// build (see `tests/demo-llm-adaptation.test.ts`). This holds the lane to
// passing the count it built from the run, not some other number, and to
// building it before the proposal is opened, reviewed or applied.
test("the lane passes the certificate the run's own call count and every call, before anything is applied", async () => {
  const body = laneBody(await readFile(path.join(sourceDirectory, "adaptation-lane.ts"), "utf8"));
  const certificate = body.slice(body.indexOf("evaluateDemoLlmAdaptation({"));
  assert.match(certificate, /\n\s*providerCallCount: calls\.providerCallCount,\n/u);
  assert.match(certificate, /\n\s*invocations: calls\.invocations,\n/u);
  assert.match(certificate, /requestId: calls\.patchRequestId,/u);
  const refused = body.indexOf("if (failedRun.providerCallCount !== failedRun.providerCalls?.length || failedRun.providerCallsOmitted !== 0)");
  const built = body.indexOf("const calls = adaptationCertificateCalls(failedRun,");
  const proposal = body.indexOf("control.getFlowAdaptation(state.projectId, state.flowId, adaptationIds[0]!)");
  const applied = body.indexOf("reviewAndApplyAdaptationViaUi(");
  assert.ok(refused > 0 && built > refused && proposal > built && applied > proposal, "the call count is refused and the calls are built before the proposal is touched");
  assert.equal(body.split("adaptationCertificateCalls(").length, 2, "the lane builds its calls exactly once");
  assert.doesNotMatch(body, /requireCompleteAdaptationIntervention|adaptationInvocation\(/u);
});
