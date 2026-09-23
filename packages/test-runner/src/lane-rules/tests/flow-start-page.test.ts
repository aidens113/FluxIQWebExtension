import assert from "node:assert/strict";
import test from "node:test";
import type { ExpectedFact } from "@fluxiq-web-extension/test-contracts";
import { createdFlowOwnPage, type LiveInstructionTask } from "../../flow-lane/index.js";
import { flowStartPage } from "../flow-start-page.js";

const task = (kind: LiveInstructionTask["kind"]): Pick<LiveInstructionTask, "kind"> => Object.freeze({ kind });
const armed: readonly ExpectedFact[] = Object.freeze([{ id: "winter-notice", subject: "document", predicate: "visible", value: true }]);

/**
 * `run-mudwci8d-de88aa32`, 2026-09-23: a `navigate-and-extract` task whose Flow
 * held no navigation node and no URL, whose first action was a click, and which
 * resolved that click only because the harness had just loaded the store's home
 * page. Under this rule it is left the blank tab instead, so the Flow's own
 * first step is the one it is being measured on.
 */
test("a task whose instruction is to go somewhere is left the blank tab a browser opens on", () => {
  assert.equal(flowStartPage({ task: task("navigate-and-extract"), moment: "playback", armedFacts: [] }), "blank-tab");
  assert.equal(flowStartPage({ task: task("navigate"), moment: "playback", armedFacts: [] }), "blank-tab");
});

test("a task that is given its page keeps being given it, because that is where the person asking is", () => {
  assert.equal(flowStartPage({ task: task("form"), moment: "playback", armedFacts: [] }), "scenario-start-page");
  assert.equal(flowStartPage({ task: task("extract"), moment: "playback", armedFacts: [] }), "scenario-start-page");
});

/**
 * The harness may present a page exactly when the judgement does not hold the
 * Flow to reaching one. Read from the judgement's own rule rather than restated,
 * so the two cannot drift: a copy that fell behind would either fail a task that
 * was handed its page or pass a Flow the harness had carried.
 */
test("the harness blanks the tab for exactly the tasks the judgement holds to reaching their own page", () => {
  const shape = Object.freeze({ nodeCount: 1, actionNodeCount: 1, actionTypes: {}, extractNodes: 0, navigationNodes: 0 });
  for (const kind of ["navigate", "navigate-and-extract", "form", "extract"] as const) {
    const required = createdFlowOwnPage({ id: "t", scenarioId: "s", kind, instruction: "i", judgeBy: "playback-goal" }, shape).required;
    const blanked = flowStartPage({ task: task(kind), moment: "playback", armedFacts: [] }) !== "scenario-start-page";
    assert.equal(blanked, required, `${kind}: the harness and the judgement disagree about whether the Flow must reach its own page`);
  }
});

/**
 * A variant's rendering is proved on a loaded page or not at all, and "the
 * fixture did not arm as declared" must never arrive disguised as "the Flow
 * failed". So the armed page is loaded, checked, and then left behind.
 */
test("an armed rendering is proved on a loaded page first, and the Flow still starts blank", () => {
  assert.equal(flowStartPage({ task: task("navigate-and-extract"), moment: "playback", armedFacts: armed }), "blank-tab-after-proving-the-arming");
  assert.equal(flowStartPage({ task: task("form"), moment: "playback", armedFacts: armed }), "scenario-start-page");
});

/**
 * Exploration reads the page FluxIQ is proposing a Flow for. Blanking it would
 * change which Flow gets written, which is a measurement decision rather than a
 * harness fix, so the build keeps its page.
 */
test("the build keeps its page, whatever the task's kind", () => {
  assert.equal(flowStartPage({ task: task("navigate-and-extract"), moment: "build", armedFacts: [] }), "scenario-start-page");
  assert.equal(flowStartPage({ task: task("navigate-and-extract"), moment: "build", armedFacts: armed }), "scenario-start-page");
});

/**
 * The repair lane prepares with no moment named, and it replays the same created
 * Flow: a repaired Flow that still cannot reach its own page must not be carried
 * there either. The recorded-Flow lane also names no moment, and has no task --
 * its Flow replays a script that began on the page it was recorded from.
 */
test("an unnamed preparation is a run, not a build, and the recorded lane keeps its page", () => {
  assert.equal(flowStartPage({ task: task("navigate-and-extract"), moment: undefined, armedFacts: [] }), "blank-tab");
  assert.equal(flowStartPage({ task: undefined, moment: undefined, armedFacts: [] }), "scenario-start-page");
  assert.equal(flowStartPage({ task: undefined, moment: "playback", armedFacts: [] }), "scenario-start-page");
});
