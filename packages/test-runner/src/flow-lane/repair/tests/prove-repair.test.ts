import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../../failure.js";
import { assertLiveRepairProof, type LiveRepairProof } from "../prove-repair.js";
import type { RepairReplay } from "../replay-repair.js";

/**
 * The verdict on an applied repair names what did not hold: the fixture's
 * final state, or the Flow itself. R4b (run-mv4i1cls-463e4b5c) reached its
 * state and was failed under "did not reach the fixture's expected final
 * state", which sent the reader to the wrong question.
 */

const replay = (overrides: Partial<RepairReplay> = {}): RepairReplay => ({
  index: 1, outcome: "ran", runId: "run.replay", status: "succeeded", providerCalls: 0, harnessActivations: 0,
  modelCalled: false, goalPassed: true, flowSucceeded: true, datasetsReproduced: null, ...overrides,
});

const proof = (replays: RepairReplay[]): LiveRepairProof => ({
  task: "create-flow", purpose: "explore_and_adapt", adaptationIds: ["adaptation-1"], changeProposalIds: [],
  application: { outcome: "applied", adaptations: [] }, replaysRequested: replays.length, replays,
});

const failureOf = (subject: LiveRepairProof): RunnerFailure => {
  try {
    assertLiveRepairProof(subject);
  } catch (error) {
    if (error instanceof RunnerFailure) return error;
    throw error;
  }
  assert.fail("the proof passed");
};

test("a replay whose Flow succeeded and whose goal held passes", () => {
  assert.doesNotThrow(() => assertLiveRepairProof(proof([replay()])));
});

test("an unchanged creation must carry every requested replay receipt", () => {
  const clean = { ...proof([]), adaptationIds: [], application: { outcome: "no_proposal" as const, adaptations: [] }, replayOfUnchangedCreation: true as const, replaysRequested: 1 };
  assert.throws(() => assertLiveRepairProof(clean), /requested replay/u);
});

test("an unchanged creation still fails an exact dataset mismatch", () => {
  const clean = { ...proof([replay({ datasetsReproduced: false })]), adaptationIds: [], application: { outcome: "no_proposal" as const, adaptations: [] }, replayOfUnchangedCreation: true as const };
  assert.throws(() => assertLiveRepairProof(clean), /stored other rows/u);
});

test("an unchanged creation requires real zero provider and harness counts", () => {
  for (const receipt of [replay({ providerCalls: 1 }), replay({ harnessActivations: 1 })]) {
    const clean = { ...proof([receipt]), adaptationIds: [], application: { outcome: "no_proposal" as const, adaptations: [] }, replayOfUnchangedCreation: true as const };
    assert.throws(() => assertLiveRepairProof(clean), /called the model/u);
  }
});

test("a replay that reached the goal but whose Flow did not succeed is named as that, with its shortfall", () => {
  const failure = failureOf(proof([replay({ flowSucceeded: false, flowShortfall: "act_not_done" })]));
  assert.equal(failure.message, "The applied repair did not hold: 1 of 1 replay(s) ran a Flow that did not succeed (act_not_done)");
  assert.deepEqual(failure.details?.failedReplays, [{ index: 1, status: "succeeded", goalPassed: true, flowSucceeded: false, flowShortfall: "act_not_done" }]);
});

test("a replay that missed the goal keeps its sentence, and both are named when both failed", () => {
  assert.equal(failureOf(proof([replay({ goalPassed: false })])).message, "The applied repair did not hold: 1 of 1 replay(s) did not reach the fixture's expected final state");
  const both = failureOf(proof([
    replay({ goalPassed: false }),
    replay({ index: 2, status: "failed", goalPassed: false, flowSucceeded: false, flowShortfall: "run_not_succeeded" }),
    replay({ index: 3, flowSucceeded: false, flowShortfall: "step_not_succeeded" }),
  ]));
  assert.equal(both.message, "The applied repair did not hold: 2 of 3 replay(s) did not reach the fixture's expected final state; 2 of 3 replay(s) ran a Flow that did not succeed (run_not_succeeded, step_not_succeeded)");
});
