// Remove, every way it can end: a removed step leaves and stays out; an
// unsupported Remove hides every Remove button for good and says so once;
// any other failure shows its sentence until a Remove works.

import assert from "node:assert/strict";
import test from "node:test";
import type { PanelResult } from "../../../../state";
import { REMOVE_UNSUPPORTED, reduceSteps, type StepsEvent, type StepsModel } from "../steps-model";

const rows = [
  { id: "a", label: "Clicked", detail: "\"Buy\"" },
  { id: "b", label: "Opened a page", detail: "shop.example.com" }
];
const ok: PanelResult<unknown> = { ok: true, value: { ok: true } };
const unsupported: PanelResult<unknown> = { ok: false, sentence: "This extension doesn't support that yet.", unsupported: true };
const failed: PanelResult<unknown> = { ok: false, sentence: "Couldn't reach FluxIQ.", detail: "fetch failed" };

function run(...events: StepsEvent[]): StepsModel {
  return events.reduce<StepsModel | undefined>((model, event) => reduceSteps(model, event), undefined) as StepsModel;
}

test("a removed step leaves at once and a later log read does not bring it back", () => {
  const pending = run({ type: "logRead", rows }, { type: "removeStarted", id: "a" });
  assert.deepEqual(pending.removing, ["a"]);
  const done = reduceSteps(pending, { type: "removeFinished", id: "a", result: ok });
  assert.deepEqual(done.rows.map((row) => row.id), ["b"]);
  assert.deepEqual(done.removing, []);
  const reread = reduceSteps(done, { type: "logRead", rows });
  assert.deepEqual(reread.rows.map((row) => row.id), ["b"]);
});

test("unsupported hides Remove for the rest of the panel's life and says where to delete it", () => {
  const model = run({ type: "logRead", rows }, { type: "removeStarted", id: "a" }, { type: "removeFinished", id: "a", result: unsupported });
  assert.equal(model.removable, false);
  assert.deepEqual(model.notice, { sentence: REMOVE_UNSUPPORTED });
  assert.deepEqual(model.rows, rows);
  assert.deepEqual(reduceSteps(model, { type: "removeStarted", id: "b" }).removing, [], "no Remove can start once unsupported");
  const next = reduceSteps(model, { type: "recordingEnded" });
  assert.equal(next.removable, false, "still hidden in the next recording");
  assert.equal(next.notice, undefined, "the sentence is said once, not again next recording");
});

test("another failure shows its sentence until a Remove works", () => {
  const model = run({ type: "logRead", rows }, { type: "removeStarted", id: "a" }, { type: "removeFinished", id: "a", result: failed });
  assert.deepEqual(model.notice, { sentence: "Couldn't reach FluxIQ.", detail: "fetch failed" });
  assert.equal(model.removable, true);
  assert.deepEqual(model.rows, rows, "the step stays");
  const reread = reduceSteps(model, { type: "logRead", rows });
  assert.ok(reread.notice !== undefined, "a log read does not clear it");
  const retried = run({ type: "logRead", rows }, { type: "removeStarted", id: "a" }, { type: "removeFinished", id: "a", result: failed },
    { type: "removeStarted", id: "a" }, { type: "removeFinished", id: "a", result: ok });
  assert.equal(retried.notice, undefined);
});

test("a second Remove of the same step while one is out is ignored", () => {
  const model = run({ type: "logRead", rows }, { type: "removeStarted", id: "a" }, { type: "removeStarted", id: "a" });
  assert.deepEqual(model.removing, ["a"]);
});

test("the recording ending clears the list and its removed ids", () => {
  const model = run({ type: "logRead", rows }, { type: "removeStarted", id: "a" }, { type: "removeFinished", id: "a", result: ok }, { type: "recordingEnded" });
  assert.deepEqual(model, { rows: [], removable: true, removing: [], removed: [] });
});
