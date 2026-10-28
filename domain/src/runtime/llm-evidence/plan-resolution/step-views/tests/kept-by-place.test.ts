// Which handles a dialog view keeps that its newer capture no longer shows (`../kept-by-place.ts`, t781): a handle
// whose control the newer capture shows at its place under a handle new to the view -- a toggle in its other state --
// and none other. A control here is its two places alone, written `exact|loose`.

import assert from "node:assert/strict";
import test from "node:test";
import { webLlmKeptByPlace } from "..";

type Control = { exact: string; loose: string };
const at = (exact: string, loose = exact.replace(/\d+/gu, "")): Control => ({ exact, loose });
const placesOf = (control: Control): Control => control;
const kept = (earlier: Record<string, Control>, newer: Record<string, Control>): string[] =>
  [...webLlmKeptByPlace(new Map(Object.entries(earlier)), new Map(Object.entries(newer)), placesOf)].sort();

test("a handle whose place the newer capture shows under a handle new to the view is kept", () => {
  assert.deepEqual(kept({ t593: at("like1"), t596: at("comment2") }, { t724: at("like1"), t596: at("comment2") }), ["t593"]);
});

test("every toggle at its own exact place is kept, however many share a loose place", () => {
  assert.deepEqual(kept({ t593: at("act1"), t594: at("act2"), t595: at("act3") }, { t724: at("act1"), t594: at("act2"), t725: at("act3") }), ["t593", "t595"]);
});

test("each earlier state of one control is kept beside the next", () => {
  assert.deepEqual(kept({ t593: at("act1"), t724: at("act1") }, { t800: at("act1") }), ["t593", "t724"]);
});

test("a control with nothing new at its place is gone: a section that closed keeps nothing", () => {
  assert.deepEqual(kept({ t593: at("act1"), t596: at("act2"), t452: at("close1") }, { t452: at("close1") }), []);
});

test("rows that shift up into a removed row's address keep their own handles and keep nothing", () => {
  assert.deepEqual(kept({ t10: at("row1"), t11: at("row2"), t12: at("row3") }, { t11: at("row1"), t12: at("row2") }), []);
});

test("a control of another kind at the place -- its tag, role or context differ, so its place does -- keeps nothing", () => {
  assert.deepEqual(kept({ t593: at("act1|button") }, { t724: at("act1|link") }), []);
});

test("where positions moved, one dropped control and one new handle at a loose place leave nothing to choose, and it is kept", () => {
  assert.deepEqual(kept({ t593: at("a2-like", "like"), t596: at("a2-comment", "comment") }, { t724: at("a3-like", "like"), t596: at("a3-comment", "comment") }), ["t593"]);
});

test("where positions moved and a loose place holds two dropped controls or two new handles, nothing there is kept", () => {
  assert.deepEqual(kept({ t593: at("a2-1", "act"), t594: at("a2-2", "act") }, { t724: at("a3-1", "act") }), [], "two dropped controls");
  assert.deepEqual(kept({ t593: at("a2-1", "act") }, { t724: at("a3-1", "act"), t725: at("a3-2", "act") }), [], "two new handles");
});

test("a new handle matched at an exact place is not matched again at a loose one", () => {
  assert.deepEqual(kept({ t593: at("a2-1", "act"), t594: at("a1-1", "act") }, { t724: at("a2-1", "act") }), ["t593"]);
});

test("a capture with no handle new to the view keeps nothing it dropped", () => {
  assert.deepEqual(kept({ t593: at("act1"), t596: at("act2") }, { t596: at("act2") }), []);
});
