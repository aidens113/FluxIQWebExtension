import assert from "node:assert/strict";
import test from "node:test";
import type { ExpectedFact } from "@fluxiq-web-extension/test-contracts";
import { createdFlowOwnPage, type LiveInstructionTask } from "../../flow-lane/index.js";
import { flowStartPage, scenarioStartUrl } from "../flow-start-page.js";

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
    for (const moment of ["build", "playback", undefined] as const) {
      const blanked = flowStartPage({ task: task(kind), moment, armedFacts: [] }) !== "scenario-start-page";
      assert.equal(blanked, required, `${kind} at ${moment ?? "no moment"}: the harness and the judgement disagree about whether the Flow must reach its own page`);
    }
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
 * **The build starts blank too, and that is what changed in t103.**
 *
 * A Flow is assembled from the steps that ran, so a model standing on the page
 * never runs the step that reaches it and cannot write one into the Flow it
 * proposes: blanking playback alone made every such Flow fail honestly, and
 * this is what lets one be built that does not. The destination is not lost
 * with the page -- the run tells Core where the Flow starts, and the domain
 * refuses every call until the Flow has got there
 * (`lane.ts`, `AS/runtime/flow-bootstrap/start-location.ts`).
 */
test("the build starts blank for a task whose Flow must reach its own page", () => {
  assert.equal(flowStartPage({ task: task("navigate-and-extract"), moment: "build", armedFacts: [] }), "blank-tab");
  assert.equal(flowStartPage({ task: task("navigate"), moment: "build", armedFacts: [] }), "blank-tab");
  // An armed rendering is still proved on a loaded page before the tab is
  // blanked, at the build as at the run.
  assert.equal(flowStartPage({ task: task("navigate-and-extract"), moment: "build", armedFacts: armed }), "blank-tab-after-proving-the-arming");
});

/**
 * A person asking for the form in front of them is on that page, at the build
 * as at the run: there is no instruction saying the Flow should have gone
 * anywhere, so nothing is taken away from it.
 */
test("a build for a task that is given its page still gets it", () => {
  assert.equal(flowStartPage({ task: task("form"), moment: "build", armedFacts: [] }), "scenario-start-page");
  assert.equal(flowStartPage({ task: task("extract"), moment: "build", armedFacts: armed }), "scenario-start-page");
  assert.equal(flowStartPage({ task: undefined, moment: "build", armedFacts: [] }), "scenario-start-page");
});

/**
 * The address the harness would have opened is the address Core is told the
 * Flow starts at. One expression, because the harness loading one page while
 * Core names another is a difference nothing would report: the Flow would
 * simply be judged for not reaching a page it had never been told about.
 */
test("the start page the harness opens and the start location Core is told are the same address", () => {
  assert.equal(scenarioStartUrl("http://127.0.0.1:53017", { startPath: "/scenarios/everything-store/" }), "http://127.0.0.1:53017/scenarios/everything-store/");
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
