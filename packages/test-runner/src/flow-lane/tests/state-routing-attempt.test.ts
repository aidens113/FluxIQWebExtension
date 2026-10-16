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

test("a field the reader reads outside its shape drops the record, so page text never reaches the bundle", () => {
  const rejected: unknown[] = [
    undefined, null, "no_match", [], {},
    { outcome: "teleported" },
    { outcome: "no_match", code: "The page said Sold out" },
    { outcome: "no_match", code: `web.${"a".repeat(120)}` },
    { outcome: "guard_stopped", code: "web.target.not_found" },
    { outcome: "guard_stopped", toNodeId: "a node with spaces" },
  ];
  for (const stateRouting of rejected) assert.equal(stateRoutingAttemptOf({ stateRouting }, 1, 2), undefined, JSON.stringify(stateRouting));
});

test("a key the reader does not know, or one this outcome does not take, is ignored: the record is kept without it", () => {
  const kept: [unknown, Record<string, unknown>][] = [
    [{ outcome: "no_match", code: "web.target.not_found", reason: "The page said Sold out" }, { outcome: "no_match", code: "web.target.not_found" }],
    [{ outcome: "no_match", candidates: 3 }, { outcome: "no_match" }],
    [{ outcome: "routed", code: "web.target.not_found" }, { outcome: "routed" }],
    [{ outcome: "effect_holds", toNodeId: "node.cart" }, { outcome: "effect_holds" }],
    [{ outcome: "no_match", toNodeId: "node.cart" }, { outcome: "no_match" }],
  ];
  for (const [stateRouting, expected] of kept) {
    const parsed = stateRoutingAttemptOf({ stateRouting }, 1, 2);
    assert.deepEqual(parsed, { ...expected, startedAt: 1, finishedAt: 2 }, JSON.stringify(stateRouting));
    assert.equal(JSON.stringify(parsed).includes("Sold out"), false);
  }
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

// Core's run detail carries the ways on a safety guard refused (t387) on every
// outcome, and from t661 why a step found no way on. A record carrying them was
// rejected whole, so a no_match whose matches were all refused read like a step
// that never consulted the page.
test("the refused guards and the no-match cause are kept, and an older Core without them still parses", () => {
  const refused = [{ guard: "repeats_lasting_act", toNodeId: "node.s4" }, { guard: "unbound_value", toNodeId: "node.cart" }];
  assert.deepEqual(stateRoutingAttemptOf({ stateRouting: { outcome: "no_match", code: "web.target.not_found", noMatchCause: "matching_steps_already_acted", refused } }, 1, 2),
    { outcome: "no_match", code: "web.target.not_found", refused, noMatchCause: "matching_steps_already_acted", startedAt: 1, finishedAt: 2 });
  assert.deepEqual(stateRoutingAttemptOf({ stateRouting: { outcome: "routed", refused: [refused[0]] } }, 1, 2), { outcome: "routed", refused: [refused[0]], startedAt: 1, finishedAt: 2 });
  assert.deepEqual(stateRoutingAttemptOf({ stateRouting: { outcome: "guard_stopped", toNodeId: "node.s4", refused } }, 1, 2), { outcome: "guard_stopped", toNodeId: "node.s4", refused, startedAt: 1, finishedAt: 2 });
  assert.deepEqual(stateRoutingAttemptOf({ stateRouting: { outcome: "no_match", refused: [] } }, 1, 2), { outcome: "no_match", startedAt: 1, finishedAt: 2 }, "an empty list is none refused");
  assert.deepEqual(stateRoutingAttemptOf({ stateRouting: { outcome: "no_match" } }, 1, 2), { outcome: "no_match", startedAt: 1, finishedAt: 2 });
});

test("a refused entry or a cause outside Core's shapes drops the record, so page text never reaches the bundle", () => {
  const rejected: unknown[] = [
    { outcome: "no_match", refused: "repeats_lasting_act" },
    { outcome: "no_match", refused: [{ guard: "the page said no", toNodeId: "node.s4" }] },
    { outcome: "no_match", refused: [{ guard: "repeats_lasting_act", toNodeId: "a node with spaces" }] },
    { outcome: "no_match", refused: [{ guard: "repeats_lasting_act" }] },
    { outcome: "no_match", noMatchCause: "The page matched no step's expected starting page." },
    { outcome: "no_match", noMatchCause: `cause_${"a".repeat(64)}` },
    { outcome: "no_match", noMatchCause: 3 },
  ];
  for (const stateRouting of rejected) assert.equal(stateRoutingAttemptOf({ stateRouting }, 1, 2), undefined, JSON.stringify(stateRouting));
  // An entry's unknown key, and a cause on an outcome that does not take one, are ignored, never copied.
  assert.deepEqual(stateRoutingAttemptOf({ stateRouting: { outcome: "no_match", refused: [{ guard: "repeats_lasting_act", toNodeId: "node.s4", why: "The page said Sold out" }] } }, 1, 2),
    { outcome: "no_match", refused: [{ guard: "repeats_lasting_act", toNodeId: "node.s4" }], startedAt: 1, finishedAt: 2 });
  assert.deepEqual(stateRoutingAttemptOf({ stateRouting: { outcome: "routed", noMatchCause: "no_step_matches_page" } }, 1, 2), { outcome: "routed", startedAt: 1, finishedAt: 2 });
  assert.deepEqual(stateRoutingAttemptOf({ stateRouting: { outcome: "guard_stopped", toNodeId: "node.s4", noMatchCause: "no_step_matches_page" } }, 1, 2), { outcome: "guard_stopped", toNodeId: "node.s4", startedAt: 1, finishedAt: 2 });
});

// t661 is in flight: if Core names the cause otherwise, or adds a field, the
// record still reaches flow-lane.json and steps/ with what the reader knows.
test("a record with the cause under another name and a future field is kept, its known fields intact, nothing unknown copied", () => {
  const stateRouting = { outcome: "no_match", code: "web.target.not_found", refused: [{ guard: "repeats_lasting_act", toNodeId: "node.s4" }], matchCause: "no_step_matches_page", closenessFloor: { words: "The page said Sold out" } };
  const parsed = stateRoutingAttemptOf({ stateRouting }, 1, 2);
  assert.deepEqual(parsed, { outcome: "no_match", code: "web.target.not_found", refused: [{ guard: "repeats_lasting_act", toNodeId: "node.s4" }], startedAt: 1, finishedAt: 2 });
  for (const unknown of ["matchCause", "no_step_matches_page", "closenessFloor", "Sold out"]) assert.equal(JSON.stringify(parsed).includes(unknown), false, unknown);
});

test("a persisted Flow run keeps a no_match whose ways on were refused, with its cause", async () => {
  const outcome = await run([
    attempt({ failure: { category: "target_not_found", code: "web.target.not_found", retryable: false, stage: "target_resolution" }, stateRouting: { outcome: "no_match", code: "web.target.not_found", noMatchCause: "matching_steps_already_acted", refused: [{ guard: "repeats_lasting_act", toNodeId: "node.s4" }] } }),
  ]);
  assert.deepEqual(outcome.actions[0]!.stateRouting, { outcome: "no_match", code: "web.target.not_found", refused: [{ guard: "repeats_lasting_act", toNodeId: "node.s4" }], noMatchCause: "matching_steps_already_acted", startedAt: 1_000, finishedAt: 1_030 });
});
