import assert from "node:assert/strict";
import test from "node:test";
import { executeRecordedFlowRun, type PersistedFlowRunControl } from "../persisted-flow-run.js";
import { stateRoutingAttemptOf } from "../state-routing-attempt.js";

// Core's run detail says what the runtime made of the page when a step could
// not run (`!FluxIQ` `service/summaries/state-routing.ts`, t250). A failed step
// whose routing found no way on otherwise reads exactly like one that never
// consulted the page.

const attempt = (overrides: Record<string, unknown> = {}) => ({ attemptId: "store.attempt.1", nodeId: "node.store", definitionId: "builtin.policy.action", order: 0, status: "failed", route: "failed", startedAt: 1_000, finishedAt: 1_030, ...overrides });

function control(actionAttempts: unknown[]): PersistedFlowRunControl {
  return {
    selectExistingContext: async () => undefined,
    startPersistedFlow: async () => ({ runId: "run.one" }),
    runPersistedFlow: async () => ({ session: { runId: "run.one", status: "failed" } }),
    automationStudioCall: async () => ({ runDetail: { summary: { runId: "run.one", status: "failed" }, actionAttempts, interventions: [] } }),
  } as unknown as PersistedFlowRunControl;
}

const run = async (actionAttempts: unknown[]) => await executeRecordedFlowRun(control(actionAttempts), { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab", actionTypes: new Map([["node.store", "web.dom.click"]]) });

test("each closed shape is kept with the attempt's epoch-ms span", () => {
  for (const outcome of ["no_match", "unobserved", "no_pre_states"]) {
    assert.deepEqual(stateRoutingAttemptOf({ stateRouting: { outcome, code: "web.target.not_found" } }, 1_000, 1_030), { outcome, code: "web.target.not_found", startedAt: 1_000, finishedAt: 1_030 });
  }
  assert.deepEqual(stateRoutingAttemptOf({ stateRouting: { outcome: "no_match" } }, 1_000, undefined), { outcome: "no_match", startedAt: 1_000, finishedAt: 1_000 }, "a code Core dropped stays dropped; no finish is the start");
  assert.deepEqual(stateRoutingAttemptOf({ stateRouting: { outcome: "guard_stopped", code: "executor.ready_state.not_shown", toNodeId: "node.cart" } }, 5, 5), { outcome: "guard_stopped", code: "executor.ready_state.not_shown", toNodeId: "node.cart", startedAt: 5, finishedAt: 5 });
  for (const outcome of ["routed", "effect_holds"]) assert.deepEqual(stateRoutingAttemptOf({ stateRouting: { outcome } }, 1, 2), { outcome, startedAt: 1, finishedAt: 2 });
});

test("anything outside Core's closed shapes is dropped, so page text never reaches the bundle", () => {
  const rejected: unknown[] = [
    undefined, null, "no_match", [], {},
    { outcome: "teleported" },
    { outcome: "no_match", code: "The page said Sold out" },
    { outcome: "no_match", code: `web.${"a".repeat(120)}` },
    { outcome: "no_match", code: "web.target.not_found", reason: "The page said Sold out" },
    { outcome: "no_match", candidates: 3 },
    { outcome: "routed", code: "web.target.not_found" },
    { outcome: "effect_holds", toNodeId: "node.cart" },
    { outcome: "guard_stopped", code: "web.target.not_found" },
    { outcome: "guard_stopped", toNodeId: "a node with spaces" },
    { outcome: "no_match", toNodeId: "node.cart" },
  ];
  for (const stateRouting of rejected) assert.equal(stateRoutingAttemptOf({ stateRouting }, 1, 2), undefined, JSON.stringify(stateRouting));
});

test("a persisted Flow run carries the consultation on a failed action and on a routed one beside its skip", async () => {
  const outcome = await run([
    attempt({ failure: { category: "target_not_found", code: "web.target.not_found", retryable: false, stage: "target_resolution" }, stateRouting: { outcome: "no_match", code: "web.target.not_found" } }),
    attempt({ attemptId: "store.attempt.2", status: "succeeded", route: "state_routed", startedAt: 2_000, finishedAt: 2_010, skipped: { reason: "state_routed", code: "web.target.not_found", toNodeId: "node.search", direction: "forward" }, stateRouting: { outcome: "effect_holds" } }),
    attempt({ attemptId: "store.attempt.3", status: "succeeded", route: "success", startedAt: 3_000, finishedAt: 3_010 }),
  ]);
  const [failed, routed, ran] = outcome.actions;
  assert.equal(failed!.status, "failed");
  assert.deepEqual(failed!.stateRouting, { outcome: "no_match", code: "web.target.not_found", startedAt: 1_000, finishedAt: 1_030 });
  assert.equal(routed!.status, "skipped");
  assert.deepEqual(routed!.stateRouting, { outcome: "effect_holds", startedAt: 2_000, finishedAt: 2_010 });
  assert.equal(routed!.skipped?.reason, "state_routed");
  assert.equal("stateRouting" in ran!, false);
});
