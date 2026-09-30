// Coverage of pacer.ts: what the headline says and when it changes,
// the detail's pace (at most one change per interval, the newest always shown
// in the end), steps, and that settling events skip the wait.

import assert from "node:assert/strict";
import test from "node:test";

import type { ActivityDisplay, ClientGatewayActivity } from "../../../shared/activity/index";
import { ACTIVITY_DETAIL_INTERVAL_MS, ActivityPacer } from "../pacer";
import { FakeClock } from "./fake-clock";

let sequence = 0;
function event(fields: Partial<ClientGatewayActivity> & Pick<ClientGatewayActivity, "phase" | "label">, kind: "build" | "run" = "build", id = "b1"): ClientGatewayActivity {
  sequence += 1;
  return { activityId: `${kind}:${id}`, sequence, subject: { kind, id, projectId: "p" }, at: "2026-09-29T00:00:00.000Z", ...fields };
}

function harness() {
  const clock = new FakeClock(1_000);
  const shown: Array<{ at: number; display: ActivityDisplay }> = [];
  const pacer = new ActivityPacer({ clock, onChange: (display) => shown.push({ at: clock.now(), display }) });
  return { clock, pacer, shown, details: () => shown.map((entry) => entry.display.detail) };
}

test("a build is headed 'Building your Flow' for as long as it works, whatever Core's phase says", () => {
  const h = harness();
  h.pacer.accept(event({ phase: "building", label: "Reading your request" }));
  for (const [phase, label] of [["thinking", "Deciding the next step"], ["exploring", "Using core.run_node"], ["verifying", "Checking the proposed result"]] as const) {
    h.clock.advance(ACTIVITY_DETAIL_INTERVAL_MS);
    h.pacer.accept(event({ phase, label }));
  }
  assert.deepEqual(new Set(h.shown.map((entry) => entry.display.headline)), new Set(["Building your Flow"]));
  assert.deepEqual(h.details(), ["Reading your request", "Thinking about the next step", "Trying a step on the page", "Checking the Flow does what you asked"], "in a person's words, never a tool id");
  assert.equal(h.pacer.display()?.working, true);
  assert.equal(h.pacer.display()?.outcome, null);
});

test("headlines for every outcome of a build and a run", () => {
  const cases: Array<[ClientGatewayActivity, string, ActivityDisplay["outcome"], string | null]> = [
    [event({ phase: "done", label: "Build finished: a Flow is proposed", final: true }, "build", "x1"), "Flow ready", "done", "Build finished: a Flow is proposed"],
    [event({ phase: "failed", label: "Build failed", final: true }, "build", "x2"), "Build failed", "failed", null],
    [event({ phase: "running", label: "Run started" }, "run", "x3"), "Running your Flow", null, "Run started"],
    [event({ phase: "done", label: "Run finished", final: true }, "run", "x4"), "Run finished", "done", null],
    [event({ phase: "failed", label: "Run cancelled", final: true }, "run", "x5"), "Run failed", "failed", "Run cancelled"],
    [event({ phase: "waiting_permission", label: "Run is waiting for an answer" }, "run", "x6"), "Waiting for you: answer in the FluxIQ panel", "waiting", "Run is waiting for an answer"]
  ];
  for (const [input, headline, outcome, detail] of cases) {
    const h = harness();
    h.pacer.accept(input);
    assert.equal(h.pacer.display()?.headline, headline, input.label);
    assert.equal(h.pacer.display()?.outcome, outcome, input.label);
    assert.equal(h.pacer.display()?.working, outcome === null, input.label);
    assert.equal(h.pacer.display()?.detail, detail, "Core's own sentence is kept when it is human, and dropped when it only repeats the headline");
  }
});

test("the detail changes at most once per interval; the newest waiting sentence shows when it ends", () => {
  const h = harness();
  h.pacer.accept(event({ phase: "building", label: "Reading your request" }));
  h.clock.advance(100);
  h.pacer.accept(event({ phase: "thinking", label: "Deciding the next step" }));
  h.clock.advance(100);
  h.pacer.accept(event({ phase: "exploring", label: "Using core.run_node" }));
  h.clock.advance(100);
  h.pacer.accept(event({ phase: "exploring", label: "Using core.run_node: web.inspect.succeeded" }));
  assert.deepEqual(h.details(), ["Reading your request"], "nothing more inside the interval");
  h.clock.advanceTo(1_000 + ACTIVITY_DETAIL_INTERVAL_MS);
  assert.deepEqual(h.details(), ["Reading your request", "Looking at the page — done"], "latest wins, the ones in between are skipped");
  assert.equal(h.shown[1]!.at, 1_000 + ACTIVITY_DETAIL_INTERVAL_MS);
  assert.equal(h.pacer.display()?.phase, "exploring", "the phase moves with the detail");
  assert.equal(h.clock.pending(), 0, "nothing is left waiting: no stale sentence stays up");
});

test("a sentence after a quiet interval shows at once", () => {
  const h = harness();
  h.pacer.accept(event({ phase: "building", label: "Reading your request" }));
  h.clock.advance(5_000);
  h.pacer.accept(event({ phase: "thinking", label: "Deciding the next step" }));
  assert.equal(h.shown.length, 2);
  assert.equal(h.shown[1]!.at, 6_000);
});

test("a repeated sentence is not a change and does not restart the interval", () => {
  const h = harness();
  h.pacer.accept(event({ phase: "thinking", label: "Deciding the next step" }));
  h.clock.advance(ACTIVITY_DETAIL_INTERVAL_MS);
  h.pacer.accept(event({ phase: "thinking", label: "Deciding the next step" }));
  assert.equal(h.shown.length, 1);
  h.clock.advance(10);
  h.pacer.accept(event({ phase: "exploring", label: "Using core.run_node" }));
  assert.equal(h.shown.length, 2, "the interval still counts from the last real change");
});

test("final, failed and waiting events show at once and replace a waiting sentence", () => {
  for (const settle of [
    { phase: "done", label: "Build finished: a Flow is proposed", final: true },
    { phase: "failed", label: "Build failed: no list was found", final: true },
    { phase: "waiting_permission", label: "Waiting for an answer" }
  ] as const) {
    const h = harness();
    h.pacer.accept(event({ phase: "building", label: "Reading your request" }));
    h.clock.advance(50);
    h.pacer.accept(event({ phase: "thinking", label: "Deciding the next step" }));
    h.clock.advance(50);
    h.pacer.accept(event(settle));
    assert.equal(h.shown.length, 2, settle.phase);
    assert.equal(h.shown[1]!.at, 1_100, `${settle.phase} is not held back`);
    assert.equal(h.shown[1]!.display.detail, settle.label);
    h.clock.advance(5_000);
    assert.equal(h.shown.length, 2, "the overtaken sentence never shows after it");
  }
});

test("work that resumes after waiting shows at once, headed as working again", () => {
  const h = harness();
  h.pacer.accept(event({ phase: "running", label: "Run started" }, "run"));
  h.clock.advance(1_300);
  h.pacer.accept(event({ phase: "waiting_permission", label: "Run is waiting for an answer" }, "run"));
  h.clock.advance(10);
  h.pacer.accept(event({ phase: "running", label: "Running step 3 of 4: Pay", step: { index: 3, count: 4 } }, "run"));
  assert.deepEqual(h.shown.map((entry) => entry.display.headline), ["Running your Flow", "Waiting for you: answer in the FluxIQ panel", "Running your Flow"]);
});

test("a new unit of work shows at once with its own headline", () => {
  const h = harness();
  h.pacer.accept(event({ phase: "building", label: "Reading your request" }, "build", "b1"));
  h.clock.advance(10);
  h.pacer.accept(event({ phase: "running", label: "Run started" }, "run", "r1"));
  assert.deepEqual(h.shown.map((entry) => [entry.display.activityId, entry.display.headline]), [["build:b1", "Building your Flow"], ["run:r1", "Running your Flow"]]);
});

test("a run's step comes from its step events, is kept between them, and goes when the run settles", () => {
  const h = harness();
  h.pacer.accept(event({ phase: "running", label: "Run started" }, "run"));
  assert.equal(h.pacer.display()?.step, null);
  h.clock.advance(ACTIVITY_DETAIL_INTERVAL_MS);
  h.pacer.accept(event({ phase: "running", label: "Running step 2 of 5: Open the cart", step: { index: 2, count: 5, nodeId: "n2" } }, "run"));
  assert.deepEqual(h.pacer.display()?.step, { index: 2, count: 5 });
  h.clock.advance(ACTIVITY_DETAIL_INTERVAL_MS);
  h.pacer.accept(event({ phase: "extracting", label: "Stored 12 rows" }, "run"));
  assert.deepEqual(h.pacer.display()?.step, { index: 2, count: 5 }, "an event without a step keeps the last one");
  h.pacer.accept(event({ phase: "done", label: "Run finished", final: true }, "run"));
  assert.equal(h.pacer.display()?.step, null);
});

test("fast steps are paced like any other sentence", () => {
  const h = harness();
  h.pacer.accept(event({ phase: "running", label: "Run started" }, "run"));
  for (let index = 1; index <= 10; index += 1) {
    h.clock.advance(100);
    h.pacer.accept(event({ phase: "running", label: `Running step ${index} of 10`, step: { index, count: 10 } }, "run"));
  }
  assert.equal(h.shown.length, 1, "ten steps in one second change nothing yet");
  h.clock.advanceTo(1_000 + ACTIVITY_DETAIL_INTERVAL_MS);
  assert.equal(h.shown.length, 2);
  assert.deepEqual(h.pacer.display()?.step, { index: 10, count: 10 });
});

test("whitespace is collapsed, an empty sentence reads as its phase, and a long one is bounded", () => {
  const h = harness();
  h.pacer.accept(event({ phase: "repairing", label: "  Recovering from\n a failed   step " }));
  assert.equal(h.pacer.display()?.detail, "Recovering from a failed step");
  const h2 = harness();
  h2.pacer.accept(event({ phase: "repairing", label: "   " }));
  assert.equal(h2.pacer.display()?.detail, "Fixing a step that didn't work");
  const h3 = harness();
  h3.pacer.accept(event({ phase: "repairing", label: "x".repeat(400) }));
  assert.equal(h3.pacer.display()?.detail?.length, 160);
});

test("no tool id or result code ever reaches the detail", () => {
  const h = harness();
  h.pacer.accept(event({ phase: "exploring", label: "Using core.run_node: web.action.rejected.not_at_start_location", detail: { kind: "tool", title: "Using core.run_node", status: "succeeded", ref: "core.run_node", text: "Result: web.action.rejected.not_at_start_location" } }));
  assert.equal(h.pacer.display()?.detail, "Trying a step on the page — that didn't work, trying another way");
  assert.doesNotMatch(h.pacer.display()?.detail ?? "", /\b[a-z]+\.[a-z_]+/u);
});

test("the display carries the newest sequence folded into it", () => {
  const h = harness();
  const first = event({ phase: "building", label: "Reading your request" });
  h.pacer.accept(first);
  assert.equal(h.pacer.display()?.sequence, first.sequence);
});

test("the headline is never repeated as the detail", () => {
  const h = harness();
  h.pacer.accept(event({ phase: "building", label: "Building the Flow" }));
  assert.deepEqual([h.pacer.display()?.headline, h.pacer.display()?.detail], ["Building your Flow", null]);
  h.pacer.accept(event({ phase: "done", label: "Run finished", final: true }, "run", "r9"));
  assert.deepEqual([h.pacer.display()?.headline, h.pacer.display()?.detail], ["Run finished", null]);
  for (const entry of h.shown) assert.notEqual(entry.display.detail?.toLowerCase(), entry.display.headline.toLowerCase());
});

test("a repair gets its own headline at once, keeps it while the repair works, and a failed repair says so", () => {
  const h = harness();
  h.pacer.accept(event({ phase: "building", label: "Reading your request" }));
  h.clock.advance(100);
  h.pacer.accept(event({ phase: "repairing", label: "Repairing the Flow: the result check refuted its answer (attempt 1 of 2)" }));
  assert.equal(h.shown.length, 2, "not held back by the detail interval");
  assert.equal(h.shown[1]!.display.headline, "Fixing your Flow");
  assert.equal(h.shown[1]!.display.working, true);
  for (const [phase, label] of [["thinking", "Deciding the next step"], ["exploring", "Using core.run_node"], ["building", "Amending the draft Flow"]] as const) {
    h.clock.advance(ACTIVITY_DETAIL_INTERVAL_MS);
    h.pacer.accept(event({ phase, label }));
  }
  assert.deepEqual(new Set(h.shown.slice(1).map((entry) => entry.display.headline)), new Set(["Fixing your Flow"]), "distinct from building for the whole repair");
  h.pacer.accept(event({ phase: "failed", label: "Build failed", final: true }));
  assert.deepEqual([h.pacer.display()?.headline, h.pacer.display()?.outcome], ["Couldn't fix your Flow", "failed"]);
});

test("a run that recovers goes back to running when it reports its next step", () => {
  const h = harness();
  h.pacer.accept(event({ phase: "running", label: "Running step 3 of 5: Open the cart", step: { index: 3, count: 5 } }, "run"));
  h.clock.advance(ACTIVITY_DETAIL_INTERVAL_MS);
  h.pacer.accept(event({ phase: "repairing", label: "Recovering from a failed step: Open the cart" }, "run"));
  assert.equal(h.pacer.display()?.headline, "Fixing your Flow");
  h.clock.advance(ACTIVITY_DETAIL_INTERVAL_MS);
  h.pacer.accept(event({ phase: "running", label: "Running step 3 of 5: Open the cart", step: { index: 3, count: 5 } }, "run"));
  assert.equal(h.pacer.display()?.headline, "Running your Flow");
});

test("a page that only a person can get past: the headline says so plainly, until the page lets FluxIQ through", () => {
  const h = harness();
  h.pacer.accept(event({ phase: "building", label: "Reading your request" }));
  h.clock.advance(100);
  const check = { kind: "tool" as const, title: "Using core.run_node", status: "succeeded" as const, ref: "core.run_node", text: "Result: web.intervention.required" };
  h.pacer.accept(event({ phase: "exploring", label: "Using core.run_node: web.intervention.required", detail: check }));
  assert.equal(h.shown.length, 2, "at once");
  assert.deepEqual(
    [h.pacer.display()?.headline, h.pacer.display()?.detail, h.pacer.display()?.outcome, h.pacer.display()?.working],
    ["Waiting for you: finish the check on the page", "Only a person can get past this page", "waiting", false]
  );
  h.clock.advance(ACTIVITY_DETAIL_INTERVAL_MS);
  h.pacer.accept(event({ phase: "thinking", label: "Deciding the next step" }));
  h.clock.advance(100);
  h.pacer.accept(event({ phase: "exploring", label: "Using core.run_node: web.action.rejected.not_found", detail: { ...check, text: "Result: web.action.rejected.not_found" } }));
  assert.equal(h.pacer.display()?.headline, "Waiting for you: finish the check on the page", "still waiting while Core keeps deciding");
  assert.equal(h.shown.length, 3, "and paced like any detail: the second sentence waits for the interval");
  h.clock.advance(ACTIVITY_DETAIL_INTERVAL_MS);
  h.pacer.accept(event({ phase: "exploring", label: "Using core.run_node: web.inspect.succeeded", detail: { ...check, text: "Result: web.inspect.succeeded" } }));
  assert.deepEqual([h.pacer.display()?.headline, h.pacer.display()?.outcome], ["Building your Flow", null], "the page let FluxIQ through");
});

test("Core's person-needed ask at a robot check shows at once, whole, as the waiting display's sentence", () => {
  const ask = "FluxIQ needs you: complete the check on this page, then press Continue.";
  const h = harness();
  h.pacer.accept(event({ phase: "thinking", label: "Deciding the next step" }));
  h.clock.advance(100);
  h.pacer.accept(event({ phase: "waiting_permission", label: ask }));
  const shown = h.shown.at(-1);
  assert.equal(shown?.at, 1_100, "inside the detail interval, and still shown at once");
  assert.deepEqual([shown?.display.headline, shown?.display.detail, shown?.display.outcome, shown?.display.working], ["Waiting for you: answer in the FluxIQ panel", ask, "waiting", false], "Continue and Stop are pressed in the panel");
});
