// The header line and the live line update in place: fifty paced displays
// later they are the same elements, only their words changed, so neither
// remounts nor flickers.

import assert from "node:assert/strict";
import test from "node:test";
import type { ActivityDisplay } from "../../../shared/activity/index";
import { chatHeaderModel, createChatHeader } from "../header";
import { createLiveLine, liveLineModel } from "../view";
import { relayState } from "./activity-fixture";
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

test("the header keeps every node across 50 status changes", async () => {
  await withFakeDocument(() => {
    const header = createChatHeader(() => undefined);
    const snapshot = (value: ActivityDisplay | null) => ({ reach: "ready" as const, state: relayState([], { display: value }), overlaySaving: false });
    header.render(chatHeaderModel(snapshot(display(0)), true));
    const root = fake(header.element);
    const before = tree(root);
    for (let sequence = 1; sequence <= 50; sequence += 1) header.render(chatHeaderModel(snapshot(display(sequence, { headline: `Headline ${sequence}` })), true));
    assert.deepEqual(tree(root), before);
    assert.equal(root.byClass("chat-status")[0]!.textContent, "Headline 50");
    header.render(chatHeaderModel(snapshot(display(51, { working: false, outcome: "done", headline: "Your Flow is ready" })), true));
    assert.deepEqual(tree(root), before);
    assert.equal(root.byClass("chat-status")[0]!.getAttribute("data-tone"), "success");
  });
});

test("the header renders the paced display, not the latest raw event", () => {
  const raw = { activityId: "build-1", sequence: 9, subject: { kind: "build" as const, id: "b", projectId: "p" }, phase: "exploring" as const, label: "raw event label", at: "2026-09-29T12:00:00.000Z" };
  const model = chatHeaderModel({ reach: "ready", state: relayState([raw], { display: display(3) }), overlaySaving: false }, true);
  assert.equal(model.status, "Building your Flow");
  assert.equal(model.working, true);
  assert.equal(chatHeaderModel({ reach: "ready", state: relayState([raw], { display: null }), overlaySaving: false }, true).status, "");
});

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
  assert.deepEqual(liveLineModel(null, true), { headline: "Sending your message", detail: "", step: "" });
  assert.equal(liveLineModel(null, false), null);
  assert.equal(liveLineModel(display(1, { working: false, outcome: "failed" }), false), null);
});
