// The review after a recording, every path: it appears when a recording ends
// while connected, walks offer -> analyzing -> preview -> testing -> tested ->
// saved, falls back to FluxIQ on `unsupported` at any step, keeps the preview
// through a failure, and ignores replies that arrive after it moved on.

import assert from "node:assert/strict";
import test from "node:test";
import type { RecordingState } from "../../../../shared/protocol";
import type { PanelResult } from "../../../state";
import { statusWith } from "../../../tests/status-fixture";
import { NOTHING_TO_PREVIEW, reduceReview, type ReviewEvent, type ReviewModel } from "../review-model";
import { REVIEW_COPY, reviewView } from "../review-view";

const status = (recordingState: RecordingState, connected = true): ReviewEvent => ({
  type: "status",
  status: statusWith({ recordingState, connectionState: connected ? "connected" : "disconnected", paired: true })
});
const ok = (value: unknown): PanelResult<unknown> => ({ ok: true, value });
const unsupported: PanelResult<unknown> = { ok: false, sentence: "This extension doesn't support that yet.", unsupported: true };
const failed: PanelResult<unknown> = { ok: false, sentence: "Couldn't reach FluxIQ.", detail: "fetch failed" };
const generated = ok({ ok: true, payload: { result: { proposal: { id: "p1" }, flow: { id: "f1", name: "Reorder beans", nodes: [{ label: "Open the shop" }] } } } });
const passed = ok({ ok: true, payload: { runSummary: { status: "succeeded" }, interventionCount: 2 } });
const notPassed = ok({ ok: true, payload: { runSummary: { status: "failed" }, interventionCount: 0 } });

function run(...events: ReviewEvent[]): ReviewModel {
  return events.reduce<ReviewModel | undefined>((model, event) => reduceReview(model, event), undefined) as ReviewModel;
}

const ended = [status("recording"), status("idle")];

test("the review offers itself when a recording ends while connected, paused included", () => {
  assert.equal(run(...ended).phase.name, "offer");
  assert.equal(run(status("paused"), status("idle")).phase.name, "offer");
  assert.equal(run(status("recording"), status("paused")).phase.name, "hidden", "pausing is still recording");
  assert.equal(run(status("recording"), status("idle", false)).phase.name, "hidden", "not while disconnected");
  assert.equal(run(status("idle")).phase.name, "hidden", "the first status is only the baseline");
  assert.equal(run(...ended, status("idle")).phase.name, "offer", "a later idle status leaves it");
});

test("it stays until Done or a new recording", () => {
  assert.equal(run(...ended, { type: "dismiss" }).phase.name, "hidden");
  assert.equal(run(...ended, { type: "generate" }, status("recording")).phase.name, "hidden");
});

test("the happy path: analyzing, building, preview, test, save", () => {
  const analyzing = run(...ended, { type: "generate" });
  assert.equal(reviewView(analyzing.phase).sentence, REVIEW_COPY.analyzing);
  const building = reduceReview(analyzing, { type: "building" });
  assert.equal(reviewView(building.phase).sentence, REVIEW_COPY.building);
  const preview = reduceReview(building, { type: "generated", result: generated });
  assert.equal(preview.phase.name, "preview");
  const shown = reviewView(preview.phase);
  assert.equal(shown.preview?.name, "Reorder beans");
  assert.deepEqual(shown.buttons.map((button) => button.label), [REVIEW_COPY.save, REVIEW_COPY.test, REVIEW_COPY.done]);
  const testing = reduceReview(preview, { type: "test" });
  assert.equal(testing.phase.name, "testing");
  const tested = reduceReview(testing, { type: "testFinished", result: passed });
  const testedView = reviewView(tested.phase);
  assert.equal(testedView.sentence, "The test run worked.");
  assert.equal(testedView.note, "AI activated 2 times");
  const saving = reduceReview(tested, { type: "save" });
  assert.equal(saving.phase.name, "saving");
  const saved = reduceReview(saving, { type: "saveFinished", result: ok({ ok: true, payload: { flow: {} } }) });
  assert.equal(reviewView(saved.phase).sentence, "Saved. Find it under Recent automations.");
});

test("a test that did not succeed still lets the person save", () => {
  const model = run(...ended, { type: "generate" }, { type: "generated", result: generated }, { type: "test" }, { type: "testFinished", result: notPassed });
  const view = reviewView(model.phase);
  assert.equal(view.sentence, "The test run didn't finish. You can still save it and fix it in FluxIQ.");
  assert.equal(view.note, undefined);
  assert.equal(reduceReview(model, { type: "save" }).phase.name, "saving");
});

test("unsupported at any step goes to FluxIQ", () => {
  const atGenerate = run(...ended, { type: "generate" }, { type: "generated", result: unsupported });
  const atTest = run(...ended, { type: "generate" }, { type: "generated", result: generated }, { type: "test" }, { type: "testFinished", result: unsupported });
  const atSave = run(...ended, { type: "generate" }, { type: "generated", result: generated }, { type: "save" }, { type: "saveFinished", result: unsupported });
  for (const model of [atGenerate, atTest, atSave]) {
    const view = reviewView(model.phase);
    assert.equal(model.phase.name, "unavailable");
    assert.equal(view.sentence, "Finish this automation in FluxIQ: it has your recording.");
    assert.equal(view.openFluxIQ, true);
  }
});

test("a failure says why and keeps the preview when there is one", () => {
  const atGenerate = run(...ended, { type: "generate" }, { type: "generated", result: failed });
  assert.deepEqual(atGenerate.phase, { name: "failed", sentence: "Couldn't reach FluxIQ.", detail: "fetch failed", preview: undefined });
  assert.deepEqual(reviewView(atGenerate.phase).buttons.map((button) => button.action), ["generate", "dismiss"]);
  assert.equal(reduceReview(atGenerate, { type: "generate" }).phase.name, "analyzing", "Try again generates again");
  const atSave = run(...ended, { type: "generate" }, { type: "generated", result: generated }, { type: "save" }, { type: "saveFinished", result: failed });
  assert.equal(atSave.phase.name, "failed");
  assert.equal(reviewView(atSave.phase).preview?.name, "Reorder beans");
  assert.equal(reduceReview(atSave, { type: "save" }).phase.name, "saving");
  const empty = run(...ended, { type: "generate" }, { type: "generated", result: ok({ ok: true, payload: {} }) });
  assert.deepEqual(empty.phase, { name: "failed", sentence: NOTHING_TO_PREVIEW });
});

test("a reply that arrives after the review moved on is ignored", () => {
  const dismissed = run(...ended, { type: "generate" }, { type: "dismiss" }, { type: "generated", result: generated });
  assert.equal(dismissed.phase.name, "hidden");
  const offer = run(...ended, { type: "testFinished", result: passed }, { type: "saveFinished", result: ok({}) });
  assert.equal(offer.phase.name, "offer");
  const preview = run(...ended, { type: "generate" }, { type: "generated", result: generated });
  assert.equal(reduceReview(preview, { type: "generated", result: generated }).phase, preview.phase);
  assert.equal(reduceReview(preview, { type: "building" }).phase, preview.phase);
});

test("busy phases disable everything but Done", () => {
  for (const events of [[{ type: "generate" }], [{ type: "generate" }, { type: "generated", result: generated }, { type: "test" }]] as ReviewEvent[][]) {
    const view = reviewView(run(...ended, ...events).phase);
    assert.equal(view.busy, true);
    assert.deepEqual(view.buttons.map((button) => button.action), ["dismiss"]);
  }
  assert.equal(reviewView(run(status("idle")).phase).hidden, true);
  assert.equal(reviewView(run(...ended).phase).buttons[0]?.label, "Turn this recording into an automation");
});

test("one AI intervention is one time", () => {
  const model = run(...ended, { type: "generate" }, { type: "generated", result: generated }, { type: "test" },
    { type: "testFinished", result: ok({ payload: { runSummary: { status: "succeeded" }, interventionCount: 1 } }) });
  assert.equal(reviewView(model.phase).note, "AI activated 1 time");
});
