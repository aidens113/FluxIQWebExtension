import assert from "node:assert/strict";
import test from "node:test";
import { controlExistingLlmTargetAdaptation, type ExistingTargetAdaptationControl } from "../demo-llm-adaptation-control.js";
import type { ExistingFlowAdaptation, ExistingRunDetail } from "../existing-fluxiq-control.js";

const scope = { projectId: "project.web", flowId: "flow.parent", subflowId: "subflow.owned" };
const target: ExistingFlowAdaptation = {
  adaptationId: "adaptation.target",
  projectId: scope.projectId,
  flowId: scope.flowId,
  subflowId: scope.subflowId,
  sourceRunId: "run.failed",
  status: "validated",
  adaptationKind: "runtime_patch",
  patchKinds: ["edit_action_target"],
  validationSucceededCount: 1,
  validationFailedCount: 0,
  appliedMutationCount: 0,
};

test("continues the one exact validated target adaptation directly to applied", async () => {
  const calls: string[] = [];
  const control = fakeControl(target, calls);
  const result = await controlExistingLlmTargetAdaptation(control, scope, "private-pin", "continue");
  assert.deepEqual(calls, ["list", "get:adaptation.target", "run:run.failed", "apply"]);
  assert.deepEqual(result, {
    action: "continue",
    adaptationId: "adaptation.target",
    sourceRunId: "run.failed",
    initialStatus: "validated",
    status: "applied",
    approved: false,
    applied: true,
    reverted: false,
    appliedMutationCount: 1,
    providerCallCount: 0,
  });
  assert.doesNotMatch(JSON.stringify(result), /private-pin/);
});

test("continues proposed through approval and apply without a provider operation", async () => {
  const calls: string[] = [];
  const result = await controlExistingLlmTargetAdaptation(fakeControl({ ...target, status: "proposed" }, calls), scope, "private-pin", "continue");
  assert.deepEqual(calls, ["list", "get:adaptation.target", "run:run.failed", "approve", "apply"]);
  assert.equal(result.approved, true);
  assert.equal(result.applied, true);
  assert.equal(result.providerCallCount, 0);
});

test("state is read-only for an already applied exact adaptation", async () => {
  const calls: string[] = [];
  const result = await controlExistingLlmTargetAdaptation(fakeControl({ ...target, status: "applied", appliedMutationCount: 1 }, calls), scope, "private-pin", "state");
  assert.deepEqual(calls, ["list", "get:adaptation.target", "run:run.failed"]);
  assert.equal(result.status, "applied");
  assert.equal(result.applied, false);
});

test("fails closed when applied state does not attest exactly one target mutation", async () => {
  await assert.rejects(() => controlExistingLlmTargetAdaptation(
    fakeControl({ ...target, status: "applied", appliedMutationCount: 0 }, []), scope, "private-pin", "state",
  ), /exactly one mutation/);
});

test("reverts only the exact applied one-mutation adaptation with a fixed safe reason", async () => {
  const calls: string[] = [];
  const result = await controlExistingLlmTargetAdaptation(
    fakeControl({ ...target, status: "applied", appliedMutationCount: 1 }, calls), scope, "private-pin", "revert",
  );
  assert.deepEqual(calls, ["list", "get:adaptation.target", "run:run.failed", "revert:Testing Lab rollback of the exact runtime target adaptation"]);
  assert.equal(result.status, "reverted");
  assert.equal(result.reverted, true);
  assert.equal(result.providerCallCount, 0);
  assert.doesNotMatch(JSON.stringify(result), /private-pin/);
});

test("rejects revert before apply or without a one-mutation attestation", async () => {
  for (const adaptation of [target, { ...target, status: "applied", appliedMutationCount: 0 }]) {
    const calls: string[] = [];
    await assert.rejects(() => controlExistingLlmTargetAdaptation(fakeControl(adaptation, calls), scope, "private-pin", "revert"), /Revert requires/);
    assert.ok(!calls.some(item => item.startsWith("revert:")));
  }
});

test("fails closed when more than one active non-bootstrap adaptation exists", async () => {
  const calls: string[] = [];
  const other = { ...target, adaptationId: "adaptation.other" };
  const control = fakeControl(target, calls, other);
  await assert.rejects(() => controlExistingLlmTargetAdaptation(control, scope, "private-pin", "state"), /exactly one active LLM target adaptation/);
  assert.ok(!calls.includes("approve") && !calls.includes("apply"));
});

test("fails closed on owned Subflow or source-run contract mismatch", async () => {
  const calls: string[] = [];
  await assert.rejects(() => controlExistingLlmTargetAdaptation(
    fakeControl({ ...target, subflowId: "subflow.foreign" }, calls), scope, "private-pin", "continue",
  ), /exactly one active LLM target adaptation/);
  assert.ok(!calls.includes("approve") && !calls.includes("apply"));

  const badRun = sourceRun();
  badRun.providerCallCount = 1;
  await assert.rejects(() => controlExistingLlmTargetAdaptation(
    fakeControl(target, [], undefined, badRun), scope, "private-pin", "continue",
  ), /source run does not match/);
});

function fakeControl(
  initial: ExistingFlowAdaptation,
  calls: string[],
  additional?: ExistingFlowAdaptation,
  run: ExistingRunDetail = sourceRun(),
): ExistingTargetAdaptationControl {
  let current = initial;
  const values = () => [current, ...(additional ? [additional] : [])];
  return {
    async listFlowAdaptations() {
      calls.push("list");
      return values().map(({ adaptationId, projectId, flowId, status }) => ({ adaptationId, projectId, flowId, status }));
    },
    async getFlowAdaptation(_projectId, _flowId, adaptationId) {
      calls.push(`get:${adaptationId}`);
      return values().find(item => item.adaptationId === adaptationId)!;
    },
    async getRunDetail(_projectId, runId) {
      calls.push(`run:${runId}`);
      return run;
    },
    async approveFlowAdaptation(input) {
      assert.equal(input.authorizationPin, "private-pin");
      calls.push("approve");
      current = { ...current, status: "validated" };
      return current;
    },
    async applyFlowAdaptation(input) {
      assert.equal(input.authorizationPin, "private-pin");
      calls.push("apply");
      current = { ...current, status: "applied", appliedMutationCount: 1 };
      return current;
    },
    async revertFlowAdaptation(input) {
      assert.equal(input.authorizationPin, "private-pin");
      assert.equal(input.reason, "Testing Lab rollback of the exact runtime target adaptation");
      calls.push(`revert:${input.reason}`);
      current = { ...current, status: "reverted" };
      return current;
    },
  };
}

function sourceRun(): ExistingRunDetail {
  return {
    summary: { runId: "run.failed", projectId: scope.projectId, flowId: scope.flowId, status: "failed", routeDecisionCount: 0, subflowEntryCount: 1, actionAttemptCount: 1, updatedAt: 1 },
    routeDecisions: [],
    subflows: [],
    actionAttempts: [{ attemptId: "attempt.failed", nodeId: "node.target", definitionId: "web.output.dom-click", order: 1, status: "failed", startedAt: 1 }],
    interventions: [
      { interventionId: "intervention.diagnosis", kind: "diagnosis" },
      { interventionId: "intervention.patch", kind: "runtime_patch" },
    ],
    adaptationIds: ["adaptation.target"],
    changeProposalIds: ["proposal.target"],
    providerCallCount: 2,
  };
}
