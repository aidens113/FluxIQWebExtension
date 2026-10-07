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
  // The decision being made holds "Reading your request" (U9), so it is not a change of its own.
  assert.deepEqual(h.details(), ["Reading your request", "Trying a step on the page", "Checking the Flow does what you asked"], "in a person's words, never a tool id");
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
  h.pacer.accept(event({ phase: "exploring", label: "Clicking “Search”" }));
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

// U2 of t194 (`run-musp39u8-9ac026ab`, moments 22-34): the run's result was
// refuted after its 5 steps and a re-author repaired the Flow for four
// minutes, while the overlay and the panel said "Fixing your Flow · Step 5 of
// 5" the whole time. The re-author is not on any step of the run.
test("a run's step count does not outlive its steps into a repair of the Flow, and comes back with the re-run's steps", () => {
  const h = harness();
  h.pacer.accept(event({ phase: "running", label: "Running step 5 of 5: Reading the list", step: { index: 5, count: 5, nodeId: "n5" } }, "run"));
  assert.deepEqual(h.pacer.display()?.step, { index: 5, count: 5 });
  h.clock.advance(ACTIVITY_DETAIL_INTERVAL_MS);
  h.pacer.accept(event({ phase: "verifying", label: "The result doesn't answer the request", detail: { kind: "check", title: "Result check", status: "failed" } }, "run"));
  assert.deepEqual(h.pacer.display()?.step, { index: 5, count: 5 }, "the check is still about the run's own steps");
  h.clock.advance(ACTIVITY_DETAIL_INTERVAL_MS);
  h.pacer.accept(event({ phase: "repairing", label: "Repairing the Flow: the result check refuted its answer (attempt 1 of 3)", detail: { kind: "step", title: "Result repair started", status: "started", ref: "n5" } }, "run"));
  assert.deepEqual([h.pacer.display()?.headline, h.pacer.display()?.step], ["Fixing your Flow", null], "at once, with the repair's own headline");
  for (const [phase, label] of [["thinking", "Deciding the next step"], ["exploring", "Rerunning the search step (step 7) live"], ["verifying", "Checking the Flow does what you asked"]] as const) {
    h.clock.advance(ACTIVITY_DETAIL_INTERVAL_MS);
    h.pacer.accept(event({ phase, label }, "run"));
    assert.equal(h.pacer.display()?.step, null, `no step while the repair works: ${label}`);
  }
  assert.ok(h.shown.slice(2).every((entry) => entry.display.step === null), "never shown, not even for one change");
  h.clock.advance(ACTIVITY_DETAIL_INTERVAL_MS);
  h.pacer.accept(event({ phase: "running", label: "Running step 1 of 6: Opening the store", step: { index: 1, count: 6, nodeId: "m1" } }, "run"));
  assert.deepEqual([h.pacer.display()?.headline, h.pacer.display()?.step], ["Running your Flow", { index: 1, count: 6 }], "the repaired Flow's re-run counts its own steps");
});

test("a run recovering from a failed step keeps that step's number", () => {
  const h = harness();
  h.pacer.accept(event({ phase: "running", label: "Running step 3 of 5: Open the cart", step: { index: 3, count: 5, nodeId: "n3" } }, "run"));
  h.clock.advance(ACTIVITY_DETAIL_INTERVAL_MS);
  h.pacer.accept(event({ phase: "repairing", label: "Recovering from a failed step: Open the cart", detail: { kind: "step", title: "Open the cart", status: "failed", ref: "n3" } }, "run"));
  // Pressing the failed step again is still running the Flow (D12 of the t174 review, `run-retry.ts`).
  assert.deepEqual([h.pacer.display()?.headline, h.pacer.display()?.step], ["Running your Flow", { index: 3, count: 5 }]);
  h.clock.advance(ACTIVITY_DETAIL_INTERVAL_MS);
  h.pacer.accept(event({ phase: "repairing", label: "Working out what went wrong", detail: { kind: "thought", title: "Working out what went wrong", text: "The cart link moved to the header.", status: "succeeded" } }, "run"));
  assert.deepEqual([h.pacer.display()?.headline, h.pacer.display()?.step], ["Fixing your Flow", { index: 3, count: 5 }], "a repair of that one step is still on it");
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

// U-4 of the run-muw60j7c-bb7c9a62 UI review: the status was cut inside a word.
test("a long sentence is bounded where a word ends, never inside one", () => {
  const h = harness();
  const words = Array.from({ length: 40 }, (_, index) => `word${index}`).join(" ");
  h.pacer.accept(event({ phase: "repairing", label: words }));
  const detail = h.pacer.display()!.detail!;
  assert.ok(detail.length <= 160, detail);
  assert.ok(detail.endsWith("…"), detail);
  assert.ok(words.startsWith(`${detail.slice(0, -1)} `), `"${detail}" ends inside a word`);
});

test("no tool id or result code ever reaches the detail", () => {
  const h = harness();
  h.pacer.accept(event({ phase: "exploring", label: "Using core.run_node: web.action.rejected.not_at_start_location", detail: { kind: "tool", title: "Using core.run_node", status: "succeeded", ref: "core.run_node", text: "Result: web.action.rejected.not_at_start_location" } }));
  assert.equal(h.pacer.display()?.detail, "Trying a step on the page — not tried");
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

test("a build's repair gets its own headline at once, keeps it while the repair works, and a build that fails in it says the build failed", () => {
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
  // No Flow existed to fix: the build failed (t195 `run-musp474o-e0ed7432`, 12-failure-scenario).
  assert.deepEqual([h.pacer.display()?.headline, h.pacer.display()?.outcome], ["Build failed", "failed"]);
});

test("a run whose repair fails says it could not fix the Flow; one that only retried a step says the run failed", () => {
  const h = harness();
  h.pacer.accept(event({ phase: "running", label: "Running step 3 of 5: Open the cart", step: { index: 3, count: 5 } }, "run", "r9"));
  h.clock.advance(ACTIVITY_DETAIL_INTERVAL_MS);
  h.pacer.accept(event({ phase: "repairing", label: "Recovering from a failed step: Open the cart" }, "run", "r9"));
  // Core working out a repair of the step, not only pressing it again (D12 of the t174 review).
  h.pacer.accept(event({ phase: "repairing", label: "Working out what went wrong", detail: { kind: "thought", title: "Working out what went wrong", text: "The cart link moved to the header.", status: "succeeded" } }, "run", "r9"));
  h.pacer.accept(event({ phase: "failed", label: "Run failed", final: true }, "run", "r9"));
  assert.deepEqual([h.pacer.display()?.headline, h.pacer.display()?.outcome], ["Couldn't fix your Flow", "failed"]);
  const retried = harness();
  retried.pacer.accept(event({ phase: "running", label: "Running step 3 of 5: Open the cart", step: { index: 3, count: 5 } }, "run", "r10"));
  retried.clock.advance(ACTIVITY_DETAIL_INTERVAL_MS);
  retried.pacer.accept(event({ phase: "repairing", label: "Recovering from a failed step: Open the cart" }, "run", "r10"));
  retried.pacer.accept(event({ phase: "failed", label: "Run failed", final: true }, "run", "r10"));
  assert.deepEqual([retried.pacer.display()?.headline, retried.pacer.display()?.outcome], ["Run failed", "failed"], "nothing in the Flow was being fixed");
});

test("a run whose step is really being repaired is headed 'Fixing your Flow', and goes back to running at its next step", () => {
  const h = harness();
  h.pacer.accept(event({ phase: "running", label: "Running step 3 of 5: Open the cart", step: { index: 3, count: 5 } }, "run"));
  h.clock.advance(ACTIVITY_DETAIL_INTERVAL_MS);
  h.pacer.accept(event({ phase: "repairing", label: "Recovering from a failed step: Open the cart" }, "run"));
  assert.equal(h.pacer.display()?.headline, "Running your Flow", "a failed step alone is not a repair");
  h.clock.advance(ACTIVITY_DETAIL_INTERVAL_MS);
  h.pacer.accept(event({ phase: "repairing", label: "Working out what went wrong", detail: { kind: "thought", title: "Working out what went wrong", text: "The cart link moved to the header.", status: "succeeded" } }, "run"));
  assert.equal(h.pacer.display()?.headline, "Fixing your Flow", "Core repairing the step is");
  h.clock.advance(ACTIVITY_DETAIL_INTERVAL_MS);
  h.pacer.accept(event({ phase: "running", label: "Running step 3 of 5: Open the cart", step: { index: 3, count: 5 } }, "run"));
  assert.equal(h.pacer.display()?.headline, "Running your Flow");
});

// D12 of the t174 UI review of run-musp8nz1-dbd3905a (moment 8): the page said
// it was busy, the run pressed again, and the overlay switched to "Fixing your
// Flow · Fixing a step that didn't work" while the chat rightly said "Trying the
// step again". Nothing in the Flow was being fixed.
test("a run retrying a step the page was too busy for stays 'Running your Flow' and says why it tries again", () => {
  const h = harness();
  const step = { index: 10, count: 12, nodeId: "n10", label: "Get coupons" };
  h.pacer.accept(event({ phase: "running", label: "Running step 10 of 12: Clicking “Get coupons”", step, detail: { kind: "step", title: "Clicking “Get coupons”", status: "started", ref: "n10" } }, "run"));
  h.clock.advance(ACTIVITY_DETAIL_INTERVAL_MS);
  h.pacer.accept(event({ phase: "repairing", label: "Recovering from a failed step: Get coupons", detail: { kind: "step", title: "Clicking “Get coupons”", status: "failed", ref: "n10", text: "Result: web.action.rate_limited · Node: web.output.dom-click" } }, "run"));
  h.clock.advance(50);
  h.pacer.accept(event({ phase: "repairing", label: "Trying the step again", detail: { kind: "thought", title: "Trying the step again", text: "The step didn't work, and a step like this often works on a second try, so FluxIQ is trying it once more.", status: "succeeded", ref: "n10" } }, "run"));
  h.clock.advance(ACTIVITY_DETAIL_INTERVAL_MS);
  const retrying = h.pacer.display()!;
  assert.deepEqual([retrying.headline, retrying.detail, retrying.step], ["Running your Flow", "The page was busy, trying again", { index: 10, count: 12 }]);
  assert.ok(h.shown.every((entry) => entry.display.headline === "Running your Flow"), h.shown.map((entry) => entry.display.headline).join(", "));
  // A failure no code explains still reads as a retry, not a repair.
  const h2 = harness();
  h2.pacer.accept(event({ phase: "running", label: "Running step 2 of 3: Clicking “Next”", step: { index: 2, count: 3 } }, "run", "r2"));
  h2.clock.advance(ACTIVITY_DETAIL_INTERVAL_MS);
  h2.pacer.accept(event({ phase: "repairing", label: "Recovering from a failed step: Next", detail: { kind: "step", title: "Step failed", status: "failed", ref: "n2" } }, "run", "r2"));
  assert.deepEqual([h2.pacer.display()?.headline, h2.pacer.display()?.detail], ["Running your Flow", "That step didn't work, trying again"]);
});

// D6 of the same review (00008, moments 3 and 6): the status said "clicking
// “Voltbay…” — done" while the next step's card was already working.
test("a step that finished well never leaves '— done' up: the status keeps naming the work until the next step replaces it", () => {
  const h = harness();
  const tool = (title: string, status: "started" | "succeeded", code?: string) =>
    event({ phase: "verifying", label: status === "succeeded" ? `${title} — done` : title, detail: { kind: "tool", title, status, ref: "core.run_node", ...(code ? { text: `Result: ${code}` } : {}) } });
  h.pacer.accept(tool("Trying the Flow from the start: clicking “Voltbay”", "started"));
  h.clock.advance(ACTIVITY_DETAIL_INTERVAL_MS + 100);
  h.pacer.accept(tool("Trying the Flow from the start: clicking “Voltbay”", "succeeded", "core.replay.replayed"));
  h.clock.advance(ACTIVITY_DETAIL_INTERVAL_MS + 100);
  h.pacer.accept(tool("Trying the Flow from the start: clicking “Reject non-essential”", "started"));
  h.clock.advance(5_000);
  for (const entry of h.shown) assert.doesNotMatch(entry.display.detail ?? "", /— done$/u);
  assert.equal(h.pacer.display()?.detail, "Trying the Flow from the start: clicking “Reject non-essential”");
});

// D7 of the same review (moment 3, 00006): the status said "Deciding the next
// step" while the step the decision chose already had its card working.
test("a step that starts after the decision shows at once, never 'Deciding the next step' beside its working card", () => {
  const h = harness();
  h.pacer.accept(event({ phase: "thinking", label: "Deciding the next step", detail: { kind: "thought", title: "Deciding the next step", status: "started" } }));
  h.clock.advance(300);
  h.pacer.accept(event({ phase: "exploring", label: "Clicking “Get coupons”", detail: { kind: "tool", title: "Clicking “Get coupons”", status: "started", ref: "core.run_node" } }));
  assert.equal(h.pacer.display()?.detail, "Clicking “Get coupons”");
  assert.equal(h.shown.at(-1)?.at, 1_300, "not held back by the pace");
});

// D7: the overlay held each line for its own 1.6 s dwell on top of this pace,
// so it lagged the panel's status row, which draws the display as it comes.
// One pace for both: any three seconds show at most two paced changes.
test("any three seconds of steady work show at most two changes, the guarantee the overlay used to add on its own", () => {
  const h = harness();
  for (let index = 0; index < 60; index += 1) {
    h.pacer.accept(event({ phase: index % 2 ? "thinking" : "exploring", label: `Sentence ${index + 1}` }));
    h.clock.advance(100);
  }
  const times = h.shown.map((entry) => entry.at);
  for (const [index, at] of times.entries()) {
    const inWindow = times.filter((other) => other > at && other <= at + 3_000).length;
    assert.ok(inWindow <= 2, `${inWindow + 1} changes within 3 s from ${at} ms: ${times.join(", ")}`);
    if (index > 0) assert.ok(at - times[index - 1]! >= 1_500, `${at - times[index - 1]!} ms between two changes`);
  }
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

// A model provider outage (live run `run-muq05kas-058193f0`): the live line said
// "Thinking about the next step" for as long as anyone watched. Core now ends
// the build after three unanswered requests; its final event stops the line.
test("a build stopped by a provider outage stops working at once and says why", () => {
  const h = harness();
  h.pacer.accept(event({ phase: "thinking", label: "Deciding the next step" }));
  h.clock.advance(45_000);
  h.pacer.accept(event({ phase: "thinking", label: "The AI model provider did not answer" }));
  h.clock.advance(45_000);
  h.pacer.accept(event({ phase: "failed", label: "Build stopped: the AI model provider is not responding", final: true }));
  const last = h.shown.at(-1)!;
  assert.equal(last.at, 91_000);
  assert.equal(last.display.detail, "Build stopped: the AI model provider is not responding");
  assert.equal(last.display.outcome, "failed");
  assert.equal(last.display.working, false);
});

// D7 of the t174 UI review of run-murwd8le-79e735a8: after the person pressed
// Continue on the robot check, the overlay still said "Waiting for you", and
// the status repeated the answer ("You pressed Continue.") that the thread's
// card and the ask already said.
test("the person answers the check: the waiting headline goes at once, and the answer is not echoed as the status", () => {
  const h = harness();
  h.pacer.accept(event({ phase: "thinking", label: "Deciding the next step" }));
  h.clock.advance(100);
  const check = { kind: "tool" as const, title: "Using core.run_node", status: "succeeded" as const, ref: "core.run_node", text: "Result: web.intervention.required" };
  h.pacer.accept(event({ phase: "exploring", label: "Using core.run_node: web.intervention.required", detail: check }));
  h.clock.advance(100);
  const ask = "FluxIQ needs you: complete the check on this page, then press Continue.";
  h.pacer.accept(event({ phase: "waiting_permission", label: ask, detail: { kind: "ask", title: "Robot check", status: "started", ref: "ask-1" } }));
  assert.equal(h.pacer.display()?.outcome, "waiting");
  h.clock.advance(100);
  h.pacer.accept(event({ phase: "repairing", label: "You pressed Continue.", detail: { kind: "ask", title: "Robot check", text: "You pressed Continue.", status: "succeeded", ref: "ask-1", resolution: "answered" } }));
  const answered = h.shown.at(-1)!;
  assert.equal(answered.at, 1_300, "at once, inside the detail interval");
  assert.deepEqual([answered.display.outcome, answered.display.working, answered.display.headline], [null, true, "Fixing your Flow"], "working again, not waiting");
  assert.equal(answered.display.detail, null, "the answer is said once, by the thread, not again as the status");
  h.clock.advance(ACTIVITY_DETAIL_INTERVAL_MS);
  h.pacer.accept(event({ phase: "thinking", label: "Deciding the next step" }));
  assert.deepEqual([h.pacer.display()?.headline, h.pacer.display()?.outcome], ["Fixing your Flow", null], "the check the person completed no longer holds the headline");
});

// D10 (step 0068): the chat already said "Judging the Flow" while the status
// still said the last dry-run step "— done".
test("a new stage Core announces replaces a finished step's sentence at once", () => {
  const h = harness();
  h.pacer.accept(event({ phase: "verifying", label: "Trying the Flow from the start: clicking “Add to cart”", detail: { kind: "tool", title: "Trying the Flow from the start: clicking “Add to cart”", status: "started", ref: "core.run_node" } }));
  h.clock.advance(ACTIVITY_DETAIL_INTERVAL_MS + 500);
  h.pacer.accept(event({ phase: "verifying", label: "Trying the Flow from the start: clicking “Add to cart” — done", detail: { kind: "tool", title: "Trying the Flow from the start: clicking “Add to cart”", status: "succeeded", ref: "core.run_node", text: "Result: core.replay.replayed" } }));
  h.clock.advance(10);
  h.pacer.accept(event({ phase: "verifying", label: "Judging the Flow", detail: { kind: "note", title: "Judging the Flow", text: "The Flow was tested from its start. Judging what the test did against what you asked." } }));
  assert.equal(h.pacer.display()?.detail, "Judging the Flow", "the newest stage, not the step that finished before it");
});

// D10 (screenshot 00015): during the cross-check after a passed result check
// the overlay still said "Fixing your Flow".
test("a repaired build whose result check passes is no longer headed as a repair", () => {
  const h = harness();
  h.pacer.accept(event({ phase: "repairing", label: "Repairing the Flow: the result check refuted its answer (attempt 1 of 2)" }));
  assert.equal(h.pacer.display()?.headline, "Fixing your Flow");
  h.clock.advance(ACTIVITY_DETAIL_INTERVAL_MS);
  h.pacer.accept(event({ phase: "verifying", label: "The result answers the request", detail: { kind: "check", title: "Result check", status: "succeeded", text: "The model judged that the result answers the request." } }));
  assert.equal(h.pacer.display()?.headline, "Building your Flow");
  h.clock.advance(ACTIVITY_DETAIL_INTERVAL_MS);
  h.pacer.accept(event({ phase: "verifying", label: "Couldn't confirm the result answers the request", detail: { kind: "check", title: "Result check", status: "failed" } }));
  assert.equal(h.pacer.display()?.headline, "Building your Flow", "a failed check alone does not start a repair; Core's repairing event does");
});

// t276 item 3, U4 of run-muw60unq-591e23bd: a creation build's overlay ended "Couldn't fix your
// Flow · Build stopped: the Flow is not finished yet". "Couldn't fix" belongs to a run's failed
// repair; a row that says the build stopped, failed or was not doable ends a build, whatever
// unit of work it arrived in.
test("a settling row in Core's words for a build's ending heads the status as the build's failure, never as a failed repair", () => {
  for (const title of ["Build stopped: the Flow is not finished yet", "Not doable: this Flow could not be built", "Build failed"]) {
    const h = harness();
    h.pacer.accept(event({ phase: "repairing", label: "Repairing the Flow: the result check refuted its answer (attempt 1 of 2)", detail: { kind: "step", title: "Result repair started", status: "started" } }, "run", "r7"));
    h.pacer.accept(event({ phase: "repairing", label: "Working out what went wrong", detail: { kind: "thought", title: "Working out what went wrong", text: "The variant is still China.", status: "succeeded" } }, "run", "r7"));
    assert.equal(h.pacer.display()?.headline, "Fixing your Flow");
    h.pacer.accept(event({ phase: "failed", label: title, final: true, detail: { kind: "step", title, status: "failed" } }, "run", "r7"));
    assert.deepEqual([h.pacer.display()?.headline, h.pacer.display()?.outcome], ["Build failed", "failed"], title);
  }
  // A run's own ending still reads as the failed repair it was.
  const run = harness();
  run.pacer.accept(event({ phase: "repairing", label: "Repairing the Flow: the result check refuted its answer (attempt 1 of 2)", detail: { kind: "step", title: "Result repair started", status: "started" } }, "run", "r8"));
  run.pacer.accept(event({ phase: "failed", label: "Run failed", final: true, detail: { kind: "step", title: "Run failed", status: "failed" } }, "run", "r8"));
  assert.equal(run.pacer.display()?.headline, "Couldn't fix your Flow");
});

// W27 of the week review, run-mux74k5q-1c3c2127 (last two moments): a creation build's overlay
// still ended "Couldn't fix your Flow | Build stopped: a budget ran out" after the guard above.
// A row after the build's ending in the same unit -- a model thought keeps the action line --
// took its headline from the event's subject again. The unit keeps the kind its ending named.
test("rows after a build's ending in the same unit keep the build's failure as the headline", () => {
  for (const phase of ["failed", "thinking"] as const) {
    const h = harness();
    h.pacer.accept(event({ phase: "repairing", label: "Repairing the Flow: the result check refuted its answer (attempt 1 of 2)", detail: { kind: "step", title: "Result repair started", status: "started" } }, "run", "r9"));
    const title = "Build stopped: a budget ran out";
    h.pacer.accept(event({ phase: "failed", label: title, final: true, detail: { kind: "step", title, status: "failed" } }, "run", "r9"));
    assert.equal(h.pacer.display()?.headline, "Build failed");
    h.clock.advance(ACTIVITY_DETAIL_INTERVAL_MS);
    h.pacer.accept(event({ phase, label: "I'll re-read the page", detail: { kind: "thought", title: "Re-reading the page", text: "I'll re-read the page to find the quantity field.", status: "succeeded" } }, "run", "r9"));
    h.clock.advance(ACTIVITY_DETAIL_INTERVAL_MS);
    assert.notEqual(h.pacer.display()?.headline, "Couldn't fix your Flow", phase);
    assert.ok(h.shown.every((entry) => entry.display.headline !== "Couldn't fix your Flow"), `${phase}: ${JSON.stringify(h.shown.map((entry) => entry.display.headline))}`);
  }
});

// Lane A round 4, run-muxkzdjw-31a13429 (moments 15-16): a creation build that stopped on its call
// allowance after two repair rounds still ended on "Couldn't fix your Flow | Build stopped: a budget
// ran out". The Lab keeps no record of the events the extension received, so the row's exact shape is
// not established; these are the two ways the build's own ending sentence can still sit under a run's
// failed-repair headline.
test("a settling row whose words end the build heads the build's failure, whatever kind of row carries them", () => {
  const title = "Build stopped: a budget ran out";
  for (const detail of [undefined, { kind: "note" as const, title, status: "failed" as const }, { kind: "thought" as const, title, text: title, status: "failed" as const }]) {
    const h = harness();
    h.pacer.accept(event({ phase: "repairing", label: "Repairing the Flow: the result check refuted its answer (attempt 1 of 2)", detail: { kind: "step", title: "Result repair started", status: "started" } }, "run", "r11"));
    h.pacer.accept(event({ phase: "failed", label: title, final: true, ...(detail ? { detail } : {}) }, "run", "r11"));
    assert.deepEqual([h.pacer.display()?.headline, h.pacer.display()?.outcome], ["Build failed", "failed"], detail?.kind ?? "no detail");
  }
});

test("a unit that settled stays settled: a later row in it does not reopen the work", () => {
  for (const kind of ["build", "run"] as const) {
    const h = harness();
    h.pacer.accept(event({ phase: "repairing", label: "Repairing the Flow", detail: { kind: "note", title: "Repairing the Flow", status: "started", text: "Repairing it live." } }, kind, "u1"));
    const title = "Build stopped: a budget ran out";
    h.pacer.accept(event({ phase: "failed", label: title, final: true, detail: { kind: "step", title, status: "failed" } }, kind, "u1"));
    const settledAt = h.shown.length;
    h.clock.advance(ACTIVITY_DETAIL_INTERVAL_MS);
    h.pacer.accept(event({ phase: "thinking", label: "I will set the quantity", detail: { kind: "thought", title: "Deciding", text: "I will set the quantity to 3.", status: "succeeded" } }, kind, "u1"));
    h.clock.advance(ACTIVITY_DETAIL_INTERVAL_MS);
    h.pacer.accept(event({ phase: "exploring", label: "Clicking “+”", detail: { kind: "tool", title: "Clicking “+”", status: "started" } }, kind, "u1"));
    h.clock.advance(ACTIVITY_DETAIL_INTERVAL_MS);
    assert.deepEqual([h.pacer.display()?.headline, h.pacer.display()?.outcome, h.pacer.display()?.detail], ["Build failed", "failed", title], kind);
    const after = h.shown.slice(settledAt - 1).map((entry) => [entry.display.headline, entry.display.outcome]);
    assert.ok(after.every(([headline, outcome]) => headline === "Build failed" && outcome === "failed"), `${kind}: ${JSON.stringify(after)}`);
  }
});

// U3 of t194: the overlay said "Couldn't fix your Flow | Run failed" and
// nothing more. Core's last row now says what came back and why; the status
// shows it whole, as the chat does.
test("a failed run's status says what came back and why it failed, beside the repair's headline", () => {
  const h = harness();
  const sentence = "It returned 13 rows, but the check found they don't answer what you asked, and the fix ran out of room before it finished.";
  h.pacer.accept(event({ phase: "repairing", label: "Repairing the Flow: the result check refuted its answer (attempt 1 of 3)", detail: { kind: "step", title: "Result repair started", status: "started" } }, "run"));
  h.pacer.accept(event({ phase: "failed", label: `Run failed: ${sentence}`, final: true, detail: { kind: "step", title: "Run failed", status: "failed", text: sentence } }, "run"));
  assert.deepEqual([h.pacer.display()?.headline, h.pacer.display()?.detail, h.pacer.display()?.outcome], ["Couldn't fix your Flow", `Run failed: ${sentence}`, "failed"]);
});

// U9 of the run-musp39u8-9ac026ab UI review (moments 7, 27, 28): through a
// re-author the status alternated about once a second between "Deciding the
// next step" and the model's one-line summary of its last decision. Each
// decision opens with a reasonless "Deciding the next step" row and closes
// with its reason, so a pacer showing both flashed between them for minutes.
// The last meaningful line is held while the next decision is made. Core says
// the reason as a thought titled with what the model chose (Core's
// `runtime/activity/observer.ts`): the model's words, which the chat tells and
// the status never shows (D6 of the run-musp4h2f-72e8ed99 review).
const deciding = (kind: "build" | "run" = "build") => event({ phase: "thinking", label: "Deciding the next step", detail: { kind: "thought", title: "Deciding the next step", status: "started" } }, kind);
const decided = (title: string, text: string, kind: "build" | "run" = "build") => event({ phase: "building", label: title, detail: { kind: "thought", title, text, status: "succeeded" } }, kind);
const stepStarts = (title: string, kind: "build" | "run" = "build") => event({ phase: "exploring", label: title, detail: { kind: "tool", title, status: "started", ref: "core.run_node" } }, kind);

test("U9: a decision being made holds the last meaningful line instead of flashing 'Deciding the next step'", () => {
  const h = harness();
  const repair = "Repairing the Flow: the result check refuted its answer (attempt 1 of 3)";
  h.pacer.accept(event({ phase: "repairing", label: repair, detail: { kind: "step", title: "Result repair started", status: "started" } }, "run"));
  const first = "Adding the search-results listing step with filters, then a repeat to read every page.";
  const second = "Rerunning the search step live so the Flow reaches the results page.";
  for (const [title, text] of [["Amending the draft Flow", first], ["Clicking “Search”", second], ["Amending the draft Flow", first]] as const) {
    h.clock.advance(ACTIVITY_DETAIL_INTERVAL_MS);
    h.pacer.accept(deciding("run"));
    assert.equal(h.pacer.display()?.detail, h.shown.at(-1)!.display.detail);
    assert.notEqual(h.pacer.display()?.detail, "Deciding the next step", "held while the next decision is made");
    h.clock.advance(ACTIVITY_DETAIL_INTERVAL_MS);
    h.pacer.accept(decided(title, text, "run"));
    if (title.startsWith("Clicking")) {
      h.clock.advance(100);
      h.pacer.accept(stepStarts(title, "run"));
    }
  }
  h.clock.advance(ACTIVITY_DETAIL_INTERVAL_MS);
  h.pacer.accept(deciding("run"));
  h.clock.advance(ACTIVITY_DETAIL_INTERVAL_MS);
  assert.deepEqual(h.details(), [repair, "Clicking “Search”"], "the stage, then the step it ran, held through every decision: never the flash, never the model's reasons");
  assert.ok(h.shown.every((entry) => entry.display.headline === "Fixing your Flow"));
});

test("U9: 'Deciding the next step' shows when nothing meaningful is up, and never overtakes a line still waiting for its turn", () => {
  const h = harness();
  h.pacer.accept(deciding());
  assert.equal(h.pacer.display()?.detail, "Deciding the next step", "the first line of a unit says what it is doing");
  h.clock.advance(ACTIVITY_DETAIL_INTERVAL_MS);
  h.pacer.accept(stepStarts("Clicking “Search”"));
  h.clock.advance(100);
  h.pacer.accept(stepStarts("Clicking “Next page”"));
  h.clock.advance(100);
  h.pacer.accept(decided("Reading the list", "Reading the results list next."));
  h.clock.advance(100);
  h.pacer.accept(deciding());
  h.clock.advance(ACTIVITY_DETAIL_INTERVAL_MS);
  assert.deepEqual(h.details(), ["Deciding the next step", "Clicking “Search”", "Clicking “Next page”"], "the waiting line still reaches the screen, and the reason never does");
});

// D6 and D13 of the run-musp4h2f-72e8ed99 UI review: the status showed a
// refused edit's prose and the model's reason for its next press, and a
// thought counted as a change of the detail, so the action after it waited up
// to an interval. A thought is said in the chat; the status keeps the action.
const reasonRow = (text: string, title = "Clicking “Set as my store”") => ({ kind: "thought" as const, title, text, status: "succeeded" as const });

test("a model's thought or refusal is never the detail, and does not count as a change of it", () => {
  const h = harness();
  h.pacer.accept(event({ phase: "exploring", label: "Clicking “Change store”", detail: { kind: "tool", title: "Clicking “Change store”", status: "started", ref: "core.run_node" } }));
  h.clock.advance(ACTIVITY_DETAIL_INTERVAL_MS + 300);
  h.pacer.accept(event({ phase: "exploring", label: "Clicking “Set as my store”", detail: reasonRow("Store chooser is open; I'll press “Set as my store” for Millbrook.") }));
  h.clock.advance(50);
  h.pacer.accept(event({ phase: "building", label: "Didn't change the Flow", detail: reasonRow("That step has no such value to make vary; so this was not done: adding the pape…", "Didn't change the Flow") }));
  assert.equal(h.pacer.display()?.detail, "Clicking “Change store”", "the action line stays");
  assert.equal(h.pacer.display()?.kind, "thought", "the display says its newest event was a thought");
  assert.ok(h.details().every((detail) => !/Store chooser|no such value/u.test(detail ?? "")), `no prose ever shown: ${JSON.stringify(h.details())}`);
  h.clock.advance(50);
  h.pacer.accept(event({ phase: "exploring", label: "Clicking “Set as my store”", detail: { kind: "tool", title: "Clicking “Set as my store”", status: "started", ref: "core.run_node" } }));
  assert.equal(h.shown.at(-1)?.display.detail, "Clicking “Set as my store”", "the action shows at once: the thoughts did not restart the interval");
  assert.equal(h.shown.at(-1)?.at, 1_000 + ACTIVITY_DETAIL_INTERVAL_MS + 400);
  assert.equal(h.pacer.display()?.kind, "action");
});

test("a thought while an action waits for the interval leaves that action waiting, and it still shows", () => {
  const h = harness();
  h.pacer.accept(event({ phase: "exploring", label: "Clicking “A”" }));
  h.clock.advance(100);
  h.pacer.accept(event({ phase: "exploring", label: "Clicking “B”" }));
  h.clock.advance(100);
  h.pacer.accept(event({ phase: "exploring", label: "Clicking “C”", detail: reasonRow("Because C is next.", "Clicking “C”") }));
  h.clock.advanceTo(1_000 + ACTIVITY_DETAIL_INTERVAL_MS);
  assert.deepEqual(h.details(), ["Clicking “A”", "Clicking “B”"]);
});

test("a unit of work whose first event is a thought shows its headline with no detail; Core's deciding row is still the action", () => {
  const h = harness();
  h.pacer.accept(event({ phase: "thinking", label: "Clicking “Go”", detail: reasonRow("The form is behind it.", "Clicking “Go”") }, "build", "fresh"));
  assert.deepEqual([h.pacer.display()?.headline, h.pacer.display()?.detail, h.pacer.display()?.working], ["Building your Flow", null, true]);
  h.clock.advance(ACTIVITY_DETAIL_INTERVAL_MS);
  const outage = "The AI model provider did not answer this request. Asking it again; the build stops if it keeps not answering.";
  h.pacer.accept(event({ phase: "thinking", label: "The AI model provider did not answer", detail: { kind: "thought", title: "Deciding the next step", status: "failed", text: outage } }, "build", "fresh"));
  assert.equal(h.pacer.display()?.detail, outage, "Core's own sentence about its deciding row is status");
});
