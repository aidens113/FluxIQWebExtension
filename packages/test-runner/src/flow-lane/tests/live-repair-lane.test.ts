import assert from "node:assert/strict";
import test from "node:test";
import type { ResolvedScenarioWorkflow, WebScenario } from "@fluxiq-web-extension/test-contracts";
import type { ExistingRuntimePatchAttempt } from "../../existing-fluxiq-control.js";
import { RunnerFailure } from "../../failure.js";
import type { HarnessRecoveryDetail } from "../harness-recovery.js";
import type { PersistedFlowLlmExecution } from "../persisted-flow-run.js";
import type { FlowRepairExpectation } from "../repair/index.js";
import { flowLaneSnapshot, runFlowLane, type FlowLaneControl, type FlowLaneEvidence } from "../run-flow-lane.js";

// The Flow lane under a live grant, the way `identity-drift --variant
// renamed-redesign --flow --live-llm --llm-task adapt` runs it: the recorded
// click fails with `target_not_found`, Core's recovery proposes (or is refused)
// a target override, and the run is held to the scenario's declared
// proposal-only outcome and judged on the proposal it saved.

const ADAPTATION_ID = "adaptation.run.live.temporary-target-override.1";
const PROPOSAL_ID = `proposal.${ADAPTATION_ID}`;
const NOT_FOUND = { category: "target_not_found", code: "web.target.not_found", retryable: true };
const EXPECTATION: FlowRepairExpectation = { patchKind: "temporary_target_override", target: { tagName: "button", accessibleName: "Apply changes", controlType: "submit" } };
const RENAMED_SAVE = { handles: { element: "target.2" }, handleResolution: "named", tagName: "button", accessibleName: "Apply changes", selector: "main > form > section:nth-of-type(1) > div > button:nth-of-type(1)", metadata: { controlType: "submit", formId: "settings-form" } };
const DISCARD = { handles: { element: "target.1" }, handleResolution: "named", tagName: "button", accessibleName: "Discard changes", selector: "#discard-settings", metadata: { controlType: "reset", formId: "settings-form" } };

/** What a live `adapt` run of `renamed-redesign` is held to (`apps/scenario-lab/src/scenarios/identity-drift/repair.ts`). */
const PROPOSAL_ONLY_EXPECTED: ResolvedScenarioWorkflow["expected"] = {
  actions: [{ action: "web.dom.type", outcome: "succeeded" }, { action: "web.dom.click", outcome: "failed" }],
  finalState: [{ id: "nothing-saved", subject: "save-status", predicate: "text", value: "" }],
  failure: { category: "target_not_found", code: "web.target.not_found" },
};

type Recovery = "proposed-save" | "proposed-discard" | "refused" | "none";

function patchAttempt(recovery: Recovery): { raw: Record<string, unknown>; parsed: ExistingRuntimePatchAttempt } {
  if (recovery === "refused") {
    return {
      raw: { kind: "temporary_target_override", proposalOnly: true, executed: false, preflightOk: false, issues: ["Target override is absent from current sanitized evidence."], targetOverrideRefusal: { status: "absent", reason: "action_not_repairable" }, traceStatus: "not-run" },
      parsed: { kind: "temporary_target_override", proposalOnly: true, executed: false, preflightOk: false, issueCodes: ["runtime_patch.target_override_rejected"], adaptationCreated: false, changeProposalCreated: false },
    };
  }
  return {
    raw: { kind: "temporary_target_override", proposalOnly: true, executed: false, preflightOk: true, issues: [], adaptationId: ADAPTATION_ID, changeProposalId: PROPOSAL_ID, traceStatus: "not-run" },
    parsed: { kind: "temporary_target_override", proposalOnly: true, executed: false, preflightOk: true, issueCodes: [], adaptationCreated: true, changeProposalCreated: true },
  };
}

function liveCore(recovery: Recovery) {
  const calls: string[] = [];
  const adaptationReads: Array<Record<string, unknown>> = [];
  const attempt = recovery === "none" ? undefined : patchAttempt(recovery);
  const proposed = recovery === "proposed-save" || recovery === "proposed-discard";
  const candidates = [{ candidateId: "candidate.0", outputId: "web.dom.type" }, { candidateId: "candidate.1", outputId: "web.dom.click" }];
  const grantedRunIds: string[] = [];
  const control: FlowLaneControl = {
    automationStudioCall: async (endpoint, payload) => {
      calls.push(endpoint);
      // A granted run names its own id before it starts, and Core runs it under that id.
      if (endpoint === "run-runtime-session") {
        const request = payload as Record<string, unknown>;
        calls.push(`run:${String(request.runIntent ?? "none")}`);
        grantedRunIds.push(String(request.newRunId));
        return { runtimeSession: { runId: String(request.newRunId), flowId: String(request.flowId), status: "failed" } };
      }
      if (endpoint === "list-recordings") return { recordings: [{ recordingId: "recording.one", startedAt: 0, endedAt: 1, metadata: { summaryOnly: true, eventCount: 2 } }] };
      if (endpoint === "create-recording-flow-proposals") return { proposals: [{ proposalId: "proposal.one", recordingId: "recording.one", status: "proposed", generatedAt: 1, mapper: { id: "web-recording-actions", version: "0.1" }, candidates }], issues: [] };
      if (endpoint === "review-recording-flow-proposal") return { proposal: { proposalId: "proposal.one", status: "approved", candidates, review: { decision: "approved", destination: { kind: "flow", flowId: "flow.new", created: true } } }, flow: { flowId: "flow.new" } };
      if (endpoint === "get-flow") {
        return { flow: { nodes: [
          { id: "recorded.type", definitionId: "builtin.policy.action", parameterValues: { outputId: "web.dom.type" }, metadata: { recordingCandidateId: "candidate.0" } },
          { id: "recorded.save", definitionId: "builtin.policy.action", parameterValues: { outputId: "web.dom.click" }, metadata: { recordingCandidateId: "candidate.1" } },
        ] } };
      }
      if (endpoint === "list-flow-subflows") return { subflows: [] };
      if (endpoint === "get-flow-run-detail") {
        return { runDetail: {
          summary: { runId: grantedRunIds[grantedRunIds.length - 1] ?? "run.live", status: "failed" },
          actionAttempts: [
            { attemptId: "attempt.type", nodeId: "recorded.type", definitionId: "builtin.policy.action", order: 1, status: "succeeded", startedAt: 10, finishedAt: 20 },
            { attemptId: "attempt.save", nodeId: "recorded.save", definitionId: "builtin.policy.action", order: 2, status: "failed", startedAt: 30, finishedAt: 40, failure: NOT_FOUND },
          ],
          interventions: recovery === "none" ? [] : [{ interventionId: "i.diagnosis", kind: "diagnosis" }, { interventionId: "i.patch", kind: "runtime_patch" }],
          adaptationIds: proposed ? [ADAPTATION_ID] : [],
          changeProposalIds: proposed ? [PROPOSAL_ID] : [],
          ...(attempt ? { metadata: { runtimePatchAttempts: [attempt.raw] } } : {}),
        } };
      }
      if (endpoint === "get-flow-adaptation") {
        adaptationReads.push(payload);
        return { adaptation: { adaptationId: ADAPTATION_ID, proposalId: PROPOSAL_ID, status: "proposed", patch: [{ kind: "edit_action_target", targetId: "recorded.save", summary: "Renamed.", after: recovery === "proposed-discard" ? DISCARD : RENAMED_SAVE }] } };
      }
      throw new Error(`unexpected endpoint ${endpoint}`);
    },
    selectExistingContext: async () => {},
    startPersistedFlow: async () => { throw new Error("a live run starts no session of its own"); },
    runPersistedFlow: async (input) => {
      calls.push(`run:${input.llmExecution?.purpose ?? "none"}`);
      return { session: { runId: "run.live", status: "failed" } };
    },
    getRunDetail: async (): Promise<HarnessRecoveryDetail> => ({
      interventions: [{ interventionId: "i.diagnosis", kind: "diagnosis", validationOk: true, validationCodes: [] }, { interventionId: "i.patch", kind: "runtime_patch", validationOk: true, validationCodes: [] }],
      runtimePatchAttempts: attempt ? [attempt.parsed] : [],
      adaptationIds: proposed ? [ADAPTATION_ID] : [],
      changeProposalIds: proposed ? [PROPOSAL_ID] : [],
    }),
  };
  return { control, calls, adaptationReads, grantedRunIds };
}

async function runLiveLane(recovery: Recovery, options: { purpose?: PersistedFlowLlmExecution["purpose"]; expectation?: FlowRepairExpectation | null } = {}) {
  const fake = liveCore(recovery);
  const evidence: FlowLaneEvidence[] = [];
  const identified: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => ({ ok: true, status: 200 })) as unknown as typeof globalThis.fetch;
  const expectation = options.expectation === null ? undefined : options.expectation ?? EXPECTATION;
  try {
    const outcome = runFlowLane({
      control: fake.control,
      projectId: "project.lab",
      authorizationPin: "123456",
      recordingId: "recording.one",
      recordingWait: { now: () => 0, sleep: async () => {}, intervalMs: 1, timeoutMs: 10 },
      scenario: { id: "identity-drift", recordingScript: [], expected: {} } as unknown as WebScenario,
      workflow: { expected: PROPOSAL_ONLY_EXPECTED, recordingScript: [], variant: { id: "renamed-redesign" } } as unknown as ResolvedScenarioWorkflow,
      recordingEvents: [{ type: "web.element.input_changed", count: 1 }, { type: "web.element.clicked", count: 1 }],
      facilityRunId: "run-lab",
      scenarioOrigin: "http://127.0.0.1:4310",
      runToken: "token",
      secrets: [],
      prepareFlowPage: async () => {},
      recordEvidence: async (item) => { evidence.push(item); },
      checkFinalState: async () => true,
      flowDispatchStarting: () => {},
      authorizeLiveLlm: async () => ({ grantId: "llm-grant:test", purpose: options.purpose ?? "diagnose_and_adapt" }),
      flowRunIdentified: (runId) => { identified.push(runId); },
      ...(expectation ? { repairExpectation: expectation } : {}),
    });
    return { outcome: await outcome.then((value) => ({ value }), (error: unknown) => ({ error })), evidence, identified, ...fake };
  } finally {
    globalThis.fetch = realFetch;
  }
}

test("a proposal naming the renamed Save passes a proposal-only run that ended target_not_found", async () => {
  const { outcome, evidence, identified, calls, adaptationReads } = await runLiveLane("proposed-save");
  assert.ok("value" in outcome, `the lane failed: ${"error" in outcome ? String(outcome.error) : ""}`);
  assertRunIdNamedFirst(identified);
  assert.ok(calls.includes("run:diagnose_and_adapt"));
  assert.deepEqual(adaptationReads, [{ projectId: "project.lab", flowId: "flow.new", adaptationId: ADAPTATION_ID }]);
  assert.deepEqual(outcome.value.repair, { verdict: "repaired", patchKind: "temporary_target_override", proposals: 1, mismatchedFields: [], refusalCodes: [] });
  assert.equal(evidence.length, 1);
  assert.deepEqual(evidence[0]!.observation.automationFailureExpected, { category: "target_not_found", code: "web.target.not_found" });
  assert.deepEqual(evidence[0]!.observation.automationFailureReported, { category: "target_not_found", code: "web.target.not_found" });
  const snapshot = flowLaneSnapshot(evidence[0]!);
  assert.deepEqual(snapshot.repair, outcome.value.repair);
  assert.equal(JSON.stringify(snapshot).includes("Apply changes"), false, "the snapshot carries the proposal's target");
});

test("a refused override fails the run on its repair, after the judgement and the run id were published", async () => {
  const { outcome, evidence, identified, adaptationReads } = await runLiveLane("refused");
  assert.ok("error" in outcome);
  assert.ok(outcome.error instanceof RunnerFailure && outcome.error.category === "runtime.behavior");
  assert.equal((outcome.error as Error).message, "The live repair was not the declared one: Core refused it (runtime_patch.target_override_rejected, runtime_patch.target_override_rejected.action_not_repairable)");
  assertRunIdNamedFirst(identified, "the run id was reported before the lane failed");
  assert.deepEqual(adaptationReads, []);
  assert.equal(evidence.length, 1);
  assert.deepEqual(flowLaneSnapshot(evidence[0]!).repair, {
    verdict: "refused", patchKind: "temporary_target_override", proposals: 0, mismatchedFields: [],
    refusalCodes: ["runtime_patch.target_override_rejected", "runtime_patch.target_override_rejected.action_not_repairable"],
  });
  assert.deepEqual(evidence[0]!.run.harnessRecovery.runtimePatchAttempts[0]?.issueCodes, ["runtime_patch.target_override_rejected", "runtime_patch.target_override_rejected.action_not_repairable"]);
});

test("a proposal naming Discard, or no recovery at all, fails the run on its repair", async () => {
  const discard = await runLiveLane("proposed-discard");
  assert.ok("error" in discard.outcome);
  assert.match((discard.outcome.error as Error).message, /its proposal named a different control \(accessibleName, controlType differ\)/u);
  assert.equal(flowLaneSnapshot(discard.evidence[0]!).repair?.verdict, "wrong_target");

  const quiet = await runLiveLane("none");
  assert.ok("error" in quiet.outcome);
  assert.match((quiet.outcome.error as Error).message, /Core attempted no recovery/u);
});

test("no repair is judged for a grant that cannot propose one, or a run with nothing declared", async () => {
  for (const [name, options] of [["diagnosis only", { purpose: "diagnosis_only" as const }], ["nothing declared", { expectation: null }]] as const) {
    const { outcome, evidence, adaptationReads } = await runLiveLane("refused", options);
    assert.ok("value" in outcome, `${name}: ${"error" in outcome ? String(outcome.error) : ""}`);
    assert.equal(outcome.value.repair, undefined, name);
    assert.equal(flowLaneSnapshot(evidence[0]!).repair, null, name);
    assert.deepEqual(adaptationReads, [], name);
  }
});

/** A granted run's id is named by the runner before the run starts, a lowercase UUID Core then runs under. */
function assertRunIdNamedFirst(identified: readonly string[], message?: string): void {
  assert.equal(identified.length, 1, message);
  assert.match(identified[0]!, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u, message);
}
