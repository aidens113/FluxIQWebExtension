// Coverage of candidate-trial.ts and the status it heads (pacer.ts,
// headline.ts): each kind of work the overlay shows is named in plain words --
// building, testing a candidate from its start, running a saved Flow, repairing
// a saved Flow -- and a candidate trial, passed or failed, never reads as a
// repair. Lane A round 4 (`run-muyrpbnk-fef374e7`): during the trial of
// revision 2 the overlay said "Fixing your Flow · Step 2 of 8", and the chat
// "Trying again didn't fix the step".

import assert from "node:assert/strict";
import test from "node:test";

import type { ActivityDisplay, ClientGatewayActivity } from "../../../shared/activity/index";
import { CandidateTrial } from "../candidate-trial";
import { activityHeadline } from "../headline";
import { ACTIVITY_DETAIL_INTERVAL_MS, ActivityPacer } from "../pacer";
import { FakeClock } from "./fake-clock";

let sequence = 0;
function event(fields: Partial<ClientGatewayActivity> & Pick<ClientGatewayActivity, "phase" | "label">, kind: "build" | "run" = "build", id = "b1"): ClientGatewayActivity {
  sequence += 1;
  return { activityId: `${kind}:${id}`, sequence, subject: { kind, id, projectId: "p" }, at: "2026-10-07T00:00:00.000Z", ...fields };
}

function harness() {
  const clock = new FakeClock(1_000);
  const shown: ActivityDisplay[] = [];
  const pacer = new ActivityPacer({ clock, onChange: (display) => shown.push(display) });
  /** Feeds each event a full interval apart, so every one is shown. */
  const feed = (...events: ClientGatewayActivity[]) => {
    for (const each of events) {
      clock.advance(ACTIVITY_DETAIL_INTERVAL_MS);
      pacer.accept(each);
    }
  };
  return { pacer, shown, feed, now: () => pacer.display()! };
}

const TITLE = "Testing the whole Flow from the start";
const trialStarted = (id = "b1") => event({ phase: "exploring", label: TITLE, detail: { kind: "tool", title: TITLE, status: "started", ref: "core.test_candidate" } }, "build", id);
const trialEnded = (code: string, id = "b1") => event({ phase: "exploring", label: `${TITLE} — didn't work`, detail: { kind: "tool", title: TITLE, status: code === "candidate.trial_yes" ? "succeeded" : "failed", ref: "core.test_candidate", text: `Result: ${code}` } }, "build", id);
const trialStep = (index: number, title: string, id = "b1") => event({ phase: "running", label: `Running step ${index} of 8: ${title}`, step: { index, count: 8, nodeId: `n${index}` }, detail: { kind: "step", title, status: "started", ref: `n${index}` } }, "build", id);
/** Core's rows for a step that failed in the trial: the recovering row, then its ladder's end, a thought. */
const trialStepFailed = (index: number, title: string, id = "b1") => [
  event({ phase: "repairing", label: `Recovering from a failed step: ${title}`, detail: { kind: "step", title, status: "failed", ref: `n${index}`, text: "Result: web.target.not_found · Node: web.output.dom-click" } }, "build", id),
  event({ phase: "repairing", label: "The quick fixes didn't help", detail: { kind: "thought", title: "The quick fixes didn't help", text: "Trying again didn't fix the step.", status: "succeeded", ref: `n${index}` } }, "build", id)
];

const REPAIR_WORDS = /\bfix|repair/iu;
const words = (display: ActivityDisplay) => `${display.headline} · ${display.detail ?? ""}`;

test("a build exploring the page is headed 'Building your Flow'", () => {
  const h = harness();
  h.feed(event({ phase: "building", label: "Reading your request" }), event({ phase: "exploring", label: "Using core.run_node" }));
  assert.deepEqual(new Set(h.shown.map((display) => display.headline)), new Set(["Building your Flow"]));
});

test("a candidate trial is headed 'Testing your Flow' with its run's steps, and a step that fails in it is never a repair", () => {
  const h = harness();
  h.feed(event({ phase: "exploring", label: "Using core.run_node" }), trialStarted());
  assert.deepEqual([h.now().headline, h.now().detail, h.now().step], ["Testing your Flow", TITLE, null], "the trial opens with no step of the build's carried in");
  h.feed(trialStep(1, "Opening the start page"), trialStep(2, "Clicking “Collected”"));
  assert.deepEqual([h.now().headline, h.now().step], ["Testing your Flow", { index: 2, count: 8 }]);
  h.feed(...trialStepFailed(2, "Clicking “Collected”"));
  const failedStep = h.now();
  assert.deepEqual([failedStep.headline, failedStep.detail, failedStep.phase, failedStep.step], ["Testing your Flow", "A step didn't work in the test: it wasn't on the page", "running", { index: 2, count: 8 }]);
  const during = h.shown.slice(1);
  assert.ok(during.every((display) => !REPAIR_WORDS.test(words(display))), during.map(words).join(" | "));
  assert.ok(during.every((display) => display.phase !== "repairing"), "a trial is coloured as running, not repairing");
});

test("a failed trial says the test failed and what comes next, then the build goes on as building, never as fixing", () => {
  const h = harness();
  h.feed(trialStarted(), trialStep(1, "Opening the start page"), trialStep(2, "Clicking “Collected”"), ...trialStepFailed(2, "Clicking “Collected”"), trialEnded("candidate.trial_execution_failed"));
  const ended = h.now();
  assert.deepEqual([ended.headline, ended.detail, ended.step, ended.working], ["Building your Flow", "The test failed: a step didn't work. Next: changing the Flow and testing again", null, true]);
  // The decision after it holds the verdict's line, and the build's next steps carry no trial step count.
  h.feed(event({ phase: "thinking", label: "Deciding the next step", detail: { kind: "thought", title: "Deciding the next step", status: "started" } }));
  assert.equal(h.now().detail, ended.detail);
  h.feed(event({ phase: "exploring", label: "Using core.run_node" }), event({ phase: "building", label: "Saving the Flow's steps" }));
  assert.ok(h.shown.every((display) => !REPAIR_WORDS.test(words(display))), h.shown.map(words).join(" | "));
  assert.equal(h.now().headline, "Building your Flow");
  assert.equal(h.now().step, null);
});

test("each trial verdict is said as the test's own result", () => {
  const cases: Array<[string, string]> = [
    ["candidate.trial_yes", "The test passed: the Flow did what you asked"],
    ["candidate.trial_no", "The test failed: the Flow didn't do what you asked. Next: changing it and testing again"],
    ["candidate.trial_execution_failed", "The test failed: a step didn't work. Next: changing the Flow and testing again"],
    ["candidate.trial_unsure", "The test couldn't be judged. Next: testing the Flow again"],
    ["candidate.trial_not_judged", "The test couldn't be judged. Next: testing the Flow again"],
    ["candidate.trial_stale_revision", "The test didn't run. Next: deciding what to do"]
  ];
  for (const [code, detail] of cases) {
    const h = harness();
    h.feed(trialStarted(`v-${code}`), trialStep(1, "Opening the start page", `v-${code}`), trialEnded(code, `v-${code}`));
    assert.deepEqual([h.now().headline, h.now().detail], ["Building your Flow", detail], code);
    assert.ok(!REPAIR_WORDS.test(words(h.now())), code);
  }
});

test("a build that ends during its trial says the build failed, never that a fix failed", () => {
  const h = harness();
  h.feed(trialStarted(), trialStep(2, "Clicking “Collected”"), ...trialStepFailed(2, "Clicking “Collected”"), event({ phase: "failed", label: "Build stopped: a budget ran out", final: true }));
  // "Build stopped" is only Core's bare cancellation label (pacer.ts); a stop with a cause reads as the build's failure.
  assert.deepEqual([h.now().headline, h.now().outcome], ["Build failed", "failed"]);
  const h2 = harness();
  h2.feed(trialStarted("b2"), ...trialStepFailed(2, "Clicking “Collected”", "b2"), event({ phase: "failed", label: "Build failed", final: true }, "build", "b2"));
  assert.deepEqual([h2.now().headline, h2.now().outcome], ["Build failed", "failed"]);
});

test("a saved Flow's run is 'Running your Flow', and its repair is still 'Fixing your Flow'", () => {
  const h = harness();
  h.feed(event({ phase: "running", label: "Running step 3 of 5: Open the cart", step: { index: 3, count: 5 } }, "run", "r1"));
  assert.equal(h.now().headline, "Running your Flow");
  h.feed(
    event({ phase: "repairing", label: "Recovering from a failed step: Open the cart" }, "run", "r1"),
    event({ phase: "repairing", label: "Working out what went wrong", detail: { kind: "thought", title: "Working out what went wrong", text: "The cart link moved to the header.", status: "succeeded" } }, "run", "r1")
  );
  assert.equal(h.now().headline, "Fixing your Flow");
  h.feed(event({ phase: "failed", label: "Run failed", final: true }, "run", "r1"));
  assert.equal(h.now().headline, "Couldn't fix your Flow");
});

test("a build's repair of a refuted answer outside any trial is still 'Fixing your Flow'", () => {
  const h = harness();
  h.feed(trialStarted(), trialEnded("candidate.trial_yes"), event({ phase: "repairing", label: "Repairing the Flow: the result check refuted its answer (attempt 1 of 2)" }));
  assert.equal(h.now().headline, "Fixing your Flow");
});

test("the trial is opened and closed only by the build's core.test_candidate row", () => {
  const trial = new CandidateTrial();
  assert.equal(trial.observe(event({ phase: "exploring", label: "Saving the Flow's steps", detail: { kind: "tool", title: "Saving the Flow's steps", status: "started", ref: "core.submit_candidate" } })).testing, false);
  assert.deepEqual(trial.observe(trialStarted()), { testing: true, startedNow: true, endedNow: false, line: null });
  assert.equal(trial.observe(trialStep(1, "Opening the start page")).testing, true);
  // A new unit of work starts outside any trial.
  assert.equal(trial.observe(trialStep(1, "Opening the start page", "other")).testing, false);
  assert.deepEqual(trial.observe(trialStarted("b3")).startedNow, true);
  // A unit that settles with its trial open closes it.
  assert.equal(trial.observe(event({ phase: "failed", label: "Build failed", final: true }, "build", "b3")).testing, false);
  assert.equal(trial.observe(trialStep(1, "Opening the start page", "b3")).testing, false);
});

test("the headline names a test above a repair, and a failed test is never a failed fix", () => {
  assert.equal(activityHeadline("build", null, { testing: true }), "Testing your Flow");
  assert.equal(activityHeadline("build", null, { testing: true, repairing: true }), "Testing your Flow");
  assert.equal(activityHeadline("run", "failed", { testing: true, repairing: true }), "Run failed");
  assert.equal(activityHeadline("build", "waiting", { testing: true, waitingOn: "check" }), "Waiting for you: finish the check on the page");
});
