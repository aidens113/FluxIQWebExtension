import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../../failure.js";
import type { CreatedFlowShape } from "../flow-shape.js";
import type { LiveInstructionTask } from "../instruction-task.js";
import { assertCreatedFlowReachesItsOwnPage, createdFlowOwnPage } from "../own-page.js";

const shape = (navigationNodes: number): CreatedFlowShape =>
  Object.freeze({ nodeCount: 7, actionNodeCount: 5, actionTypes: {}, extractNodes: 1, navigationNodes });

const task = (kind: LiveInstructionTask["kind"]): LiveInstructionTask =>
  Object.freeze({ id: "store-first-page", scenarioId: "everything-store", kind, instruction: "Collect the first page.", judgeBy: "expected-dataset", expectedDatasetId: "extract-first-page" });

/**
 * `run-mudwci8d-de88aa32`, 2026-09-23: a `navigate-and-extract` task produced a
 * seven-node Flow with `navigationNodes: 0` and no URL anywhere in it. It ran
 * only because `prepareFlowPage("playback")` had loaded the store's home page
 * for it; from a blank tab its first step would click "Not now" on whatever
 * happened to be there.
 */
test("a task whose instruction begins by going somewhere needs a Flow that can go there", () => {
  const missing = createdFlowOwnPage(task("navigate-and-extract"), shape(0));
  assert.deepEqual(missing, { required: true, navigationNodes: 0, reached: false });
  assert.throws(
    () => assertCreatedFlowReachesItsOwnPage(missing, { flowId: "flow.created", taskId: "store-first-page", taskKind: "navigate-and-extract" }),
    (error: unknown) => {
      assert.ok(error instanceof RunnerFailure);
      assert.equal(error.category, "runtime.behavior");
      assert.match(error.message, /holds no node that reaches its own page/u);
      assert.match(error.message, /the harness had already loaded the page for it/u);
      assert.equal(error.details?.code, "flow_lane.flow_does_not_reach_its_page");
      assert.equal(error.details?.navigationNodes, 0);
      return true;
    },
  );

  const carried = createdFlowOwnPage(task("navigate"), shape(1));
  assert.deepEqual(carried, { required: true, navigationNodes: 1, reached: true });
  assertCreatedFlowReachesItsOwnPage(carried, { flowId: "flow.created", taskId: "store-first-page", taskKind: "navigate" });
});

/**
 * The distinction is the task's, never the Flow's. A person asking for a form
 * to be filled in, or for the page in front of them to be read, starts on that
 * page, so a Flow for one of those is right to hold no navigation node.
 */
test("a form or extract task works on the page it was given, so it is not held to reaching one", () => {
  for (const kind of ["form", "extract"] as const) {
    const ownPage = createdFlowOwnPage(task(kind), shape(0));
    assert.deepEqual(ownPage, { required: false, navigationNodes: 0, reached: true }, kind);
    assertCreatedFlowReachesItsOwnPage(ownPage, { flowId: "flow.created", taskId: "store-first-page", taskKind: kind });
  }
});
