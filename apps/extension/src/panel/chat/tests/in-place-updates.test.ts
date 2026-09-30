// The live line and a fold of work update in place: fifty paced displays or
// steps later they are the same elements, only their words changed, so
// neither remounts nor flickers.

import assert from "node:assert/strict";
import test from "node:test";
import type { ActivityDisplay } from "../../../shared/activity/index";
import { buildChatStream, buildChatThread } from "../stream";
import { createLiveLine, createWorkDisclosure, liveLineModel } from "../view";
import { activityEvent } from "./activity-fixture";
import { fake, withFakeDocument } from "./fake-dom";

function display(sequence: number, fields: Partial<ActivityDisplay> = {}): ActivityDisplay {
  return {
    activityId: "build:build-1",
    subjectKind: "build",
    phase: sequence % 2 === 0 ? "thinking" : "exploring",
    headline: "Building your Flow",
    detail: `Reading the page, pass ${sequence}`,
    step: { index: 1 + (sequence % 5), count: 5 },
    working: true,
    outcome: null,
    sequence,
    ...fields
  };
}

function tree(root: ReturnType<typeof fake>): unknown[] {
  return [root, ...root.descendants()];
}

test("the live line keeps every node across 50 updates and hides between units of work", async () => {
  await withFakeDocument(() => {
    const line = createLiveLine();
    line.update(liveLineModel(display(0), false));
    const root = fake(line.element);
    const before = tree(root);
    for (let sequence = 1; sequence <= 50; sequence += 1) line.update(liveLineModel(display(sequence), false));
    assert.deepEqual(tree(root), before);
    assert.equal(root.hidden, false);
    assert.equal(root.byClass("chat-live-headline")[0]!.textContent, "Building your Flow");
    assert.equal(root.byClass("chat-live-detail")[0]!.textContent, "Reading the page, pass 50");
    assert.equal(root.byClass("chat-live-step")[0]!.textContent, "Step 1 of 5");
    line.update(liveLineModel(display(51, { working: false, outcome: "done" }), false));
    assert.equal(root.hidden, true);
    assert.deepEqual(tree(root), before);
  });
});

test("the live line says a message is on its way before the first activity, and nothing when idle", () => {
  assert.deepEqual(liveLineModel(null, true), { headline: "Sending your message", detail: "", step: "", waiting: false });
  assert.equal(liveLineModel(null, false), null);
  assert.equal(liveLineModel(display(1, { working: false, outcome: "failed" }), false), null);
});

test("while the work waits for the person, the live line stays up and says what Core asked of them", async () => {
  // Core's person-needed ask at a robot check (t197): phase `waiting_permission`,
  // the ask's text as the paced display's detail. The line is no longer
  // working, so it neither pulses nor shimmers, and it is marked waiting.
  const ask = "FluxIQ needs you: complete the check on this page, then press Continue.";
  const waiting = display(9, { phase: "waiting_permission", headline: "Waiting for you", detail: ask, step: null, working: false, outcome: "waiting" });
  assert.deepEqual(liveLineModel(waiting, false), { headline: "Waiting for you", detail: ask, step: "", waiting: true });
  assert.deepEqual(liveLineModel({ ...waiting, headline: " ", detail: null }, false), { headline: "Waiting for you", detail: "", step: "", waiting: true });
  await withFakeDocument(() => {
    const line = createLiveLine();
    line.update(liveLineModel(display(1), false));
    assert.equal(line.element.getAttribute("data-state"), "working");
    line.update(liveLineModel(waiting, false));
    const root = fake(line.element);
    assert.equal(root.hidden, false);
    assert.equal(line.element.getAttribute("data-state"), "waiting");
    assert.equal(root.byClass("chat-live-detail")[0]!.textContent, ask);
  });
});

test("a fold keeps its steps' elements while steps arrive; only a step that changed is rebuilt", async () => {
  await withFakeDocument(() => {
    const fold = createWorkDisclosure(() => undefined);
    const events = [
      activityEvent(1, { detail: { kind: "step", title: "Build started", status: "started" } }),
      activityEvent(2, { phase: "thinking", detail: { kind: "thought", title: "Deciding the next step", status: "started" } })
    ];
    const render = () => fold.update(buildChatThread(buildChatStream([], events), true).live!, true);
    render();
    const root = fake(fold.element);
    const first = root.byClass("chat-step")[0]!;
    assert.equal(first.getAttribute("data-status"), "succeeded", "Build started is over once anything followed it");
    for (let sequence = 3; sequence <= 50; sequence += 1) {
      events.push(activityEvent(sequence, { phase: "thinking", detail: { kind: "thought", title: "Deciding the next step", status: "started" } }));
      render();
    }
    const steps = root.byClass("chat-step");
    assert.equal(steps.length, 50);
    assert.equal(steps[0], first, "the first step is the same element 49 steps later");
    assert.equal(root.byClass("chat-work-label")[0]!.textContent, "49 steps so far", "Started building is listed but not counted");
    assert.equal(steps[48]!.byClass("chat-step-title")[0]!.textContent, "Decided the next step");
    assert.equal(steps[49]!.byClass("chat-step-title")[0]!.textContent, "Deciding the next step");
  });
});
