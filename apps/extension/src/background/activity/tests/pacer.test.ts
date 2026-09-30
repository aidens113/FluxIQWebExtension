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
  h.pacer.accept(event({ phase: "building", label: "Building the Flow" }));
  for (const [phase, label] of [["thinking", "Deciding the next step"], ["exploring", "Using core.run_node"], ["verifying", "Checking the proposed result"]] as const) {
    h.clock.advance(ACTIVITY_DETAIL_INTERVAL_MS);
    h.pacer.accept(event({ phase, label }));
  }
  assert.deepEqual(new Set(h.shown.map((entry) => entry.display.headline)), new Set(["Building your Flow"]));
  assert.deepEqual(h.details(), ["Building the Flow", "Deciding the next step", "Using core.run_node", "Checking the proposed result"]);
  assert.equal(h.pacer.display()?.working, true);
  assert.equal(h.pacer.display()?.outcome, null);
});

test("headlines for every outcome of a build and a run", () => {
  const cases: Array<[ClientGatewayActivity, string, ActivityDisplay["outcome"]]> = [
    [event({ phase: "done", label: "Build finished: a Flow is proposed", final: true }, "build", "x1"), "Flow ready", "done"],
    [event({ phase: "failed", label: "Build failed", final: true }, "build", "x2"), "Build failed", "failed"],
    [event({ phase: "running", label: "Run started" }, "run", "x3"), "Running your Flow", null],
    [event({ phase: "done", label: "Run finished", final: true }, "run", "x4"), "Run finished", "done"],
    [event({ phase: "failed", label: "Run cancelled", final: true }, "run", "x5"), "Run failed", "failed"],
    [event({ phase: "waiting_permission", label: "Run is waiting for an answer" }, "run", "x6"), "Waiting for you", "waiting"]
  ];
  for (const [input, headline, outcome] of cases) {
    const h = harness();
    h.pacer.accept(input);
    assert.equal(h.pacer.display()?.headline, headline, input.label);
    assert.equal(h.pacer.display()?.outcome, outcome, input.label);
    assert.equal(h.pacer.display()?.working, outcome === null, input.label);
    assert.equal(h.pacer.display()?.detail, input.label, "the detail is Core's own sentence");
  }
});

test("the detail changes at most once per interval; the newest waiting sentence shows when it ends", () => {
  const h = harness();
  h.pacer.accept(event({ phase: "building", label: "Building the Flow" }));
  h.clock.advance(100);
  h.pacer.accept(event({ phase: "thinking", label: "Deciding the next step" }));
  h.clock.advance(100);
  h.pacer.accept(event({ phase: "exploring", label: "Using core.run_node" }));
  h.clock.advance(100);
  h.pacer.accept(event({ phase: "exploring", label: "Using core.run_node: web.inspect.succeeded" }));
  assert.deepEqual(h.details(), ["Building the Flow"], "nothing more inside the interval");
  h.clock.advanceTo(1_000 + ACTIVITY_DETAIL_INTERVAL_MS);
  assert.deepEqual(h.details(), ["Building the Flow", "Using core.run_node: web.inspect.succeeded"], "latest wins, the ones in between are skipped");
  assert.equal(h.shown[1]!.at, 1_000 + ACTIVITY_DETAIL_INTERVAL_MS);
  assert.equal(h.pacer.display()?.phase, "exploring", "the phase moves with the detail");
  assert.equal(h.clock.pending(), 0, "nothing is left waiting: no stale sentence stays up");
});

test("a sentence after a quiet interval shows at once", () => {
  const h = harness();
  h.pacer.accept(event({ phase: "building", label: "Building the Flow" }));
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
    { phase: "failed", label: "Build failed", final: true },
    { phase: "waiting_permission", label: "Waiting for an answer" }
  ] as const) {
    const h = harness();
    h.pacer.accept(event({ phase: "building", label: "Building the Flow" }));
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
  assert.deepEqual(h.shown.map((entry) => entry.display.headline), ["Running your Flow", "Waiting for you", "Running your Flow"]);
});

test("a new unit of work shows at once with its own headline", () => {
  const h = harness();
  h.pacer.accept(event({ phase: "building", label: "Building the Flow" }, "build", "b1"));
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

test("whitespace is collapsed, an empty sentence is no detail, and a long one is bounded", () => {
  const h = harness();
  h.pacer.accept(event({ phase: "thinking", label: "  Deciding\n the   next step " }));
  assert.equal(h.pacer.display()?.detail, "Deciding the next step");
  const h2 = harness();
  h2.pacer.accept(event({ phase: "thinking", label: "   " }));
  assert.equal(h2.pacer.display()?.detail, null);
  const h3 = harness();
  h3.pacer.accept(event({ phase: "thinking", label: "x".repeat(400) }));
  assert.equal(h3.pacer.display()?.detail?.length, 160);
});

test("the display carries the newest sequence folded into it", () => {
  const h = harness();
  const first = event({ phase: "building", label: "Building the Flow" });
  h.pacer.accept(first);
  assert.equal(h.pacer.display()?.sequence, first.sequence);
});
