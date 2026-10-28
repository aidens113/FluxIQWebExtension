// One Flow's dialog views (`../views.ts`, t748 U1, t781): a newer capture of a dialog replaces its view's controls,
// keeps a handle it shows in another state at the same place, and says for each handle the newest capture that showed
// it. A target here is its name, its dialog and its place.

import assert from "node:assert/strict";
import test from "node:test";
import { createWebLlmStepViews } from "..";

type Target = { name: string; dialog?: string; place: string };
const POST = "https://photos.test/p/kiln-1/";
const DIALOG = "Post by kiln.theory";
const control = (name: string, place: string): Target => ({ name, dialog: DIALOG, place });

function views() {
  return createWebLlmStepViews<Target>((_earlier, target) => target, (target) => target.dialog !== undefined, (target) => ({ exact: target.place, loose: target.place }));
}
/** Where `handle` stands after the tile's press `t1` opened the dialog. */
const standing = (steps: ReturnType<typeof views>, handle: string) => steps.standing(handle, POST, [{ press: "t1" }]);

test("a newer capture that shows the Like as Unlike under another handle keeps the Like's handle, shown in the capture that showed it", () => {
  const steps = views();
  steps.captured(POST, DIALOG, 7, new Map([["t593", control("Like", "act1")], ["t452", control("Close", "close")]]), false);
  steps.pressedInto("t1", POST, DIALOG);
  steps.captured(POST, DIALOG, 13, new Map([["t724", control("Unlike", "act1")], ["t452", control("Close", "close")]]), false);
  assert.deepEqual(standing(steps, "t593"), { target: control("Like", "act1"), shownIn: { view: 7, location: POST } });
  assert.deepEqual(standing(steps, "t724"), { target: control("Unlike", "act1"), shownIn: { view: 13, location: POST } });
  assert.deepEqual(standing(steps, "t452")?.shownIn, { view: 13, location: POST });
});

test("a newer capture with nothing at a control's place lets it go", () => {
  const steps = views();
  steps.captured(POST, DIALOG, 7, new Map([["t593", control("Like", "act1")], ["t452", control("Close", "close")]]), false);
  steps.pressedInto("t1", POST, DIALOG);
  steps.captured(POST, DIALOG, 13, new Map([["t452", control("Close", "close")]]), false);
  assert.equal(standing(steps, "t593"), undefined);
});

test("a capture cut short only adds, each earlier handle still with the capture that showed it", () => {
  const steps = views();
  steps.captured(POST, DIALOG, 7, new Map([["t593", control("Like", "act1")]]), false);
  steps.pressedInto("t1", POST, DIALOG);
  steps.captured(POST, DIALOG, 13, new Map([["t452", control("Close", "close")]]), true);
  assert.deepEqual(standing(steps, "t593")?.shownIn, { view: 7, location: POST });
  assert.deepEqual(standing(steps, "t452")?.shownIn, { view: 13, location: POST });
});

test("controls outside a dialog are no part of its view, and a capture with no dialog changes nothing", () => {
  const steps = views();
  steps.captured(POST, DIALOG, 7, new Map([["t593", control("Like", "act1")], ["t9", { name: "Post 1", place: "tile1" }]]), false);
  steps.captured(POST, "", 8, new Map([["t20", { name: "Like", place: "page1" }]]), false);
  steps.pressedInto("t1", POST, DIALOG);
  assert.equal(standing(steps, "t9"), undefined);
  assert.deepEqual(standing(steps, "t593")?.shownIn, { view: 7, location: POST });
});
