// One place token per act (Core P4 / W4). A library catalogue lists two entries
// on two pages, each with its own Reserve toggle in no row, and one looped step
// presses Reserve on each (pass 1 and pass 2). Each pass's act must name its
// control by one token wherever the domain reports it: the step diff's `spot`
// (`place`), its `controls` counts (keyed by that place, before and after), its
// replaced values (same page scope and location) and a control receipt read on
// the same page (`webControlStates`, as a start-state read answers it). The two
// passes' tokens differ, since a place includes its page's address
// (`place-per-page.test.ts`), and Core compares by one place per act.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { sanitizeWebLlmSnapshotWithBindings, webControlSpotToken, webControlStates, webResetResource, webValueStates, type WebLlmSnapshotBinding } from "../..";
import { webStateDiffPlaces, webStateSnapshotPlaces } from "../../../state-diff/places";

/** Entry `n` of the catalogue as read at its page, its Reserve toggle `reserved` or not and `copies` shown on the shelf. */
function entry(n: number, reserved: boolean, copies: number): WebLlmSnapshotBinding {
  const binding = sanitizeWebLlmSnapshotWithBindings({
    url: `https://catalogue.test/entries/${n}/`,
    title: `Entry ${n}`,
    interactiveElements: [
      { tagName: "main", selector: "main" },
      { tagName: "p", selector: "main > p", visibleText: `${copies} copies on the shelf`, parent: 0 },
      { tagName: "button", implicitRole: "button", selector: "#reserve", accessibleName: reserved ? "Cancel reservation" : "Reserve", attributes: { "aria-pressed": String(reserved) }, parent: 0 }
    ] as JsonObject[]
  });
  binding.resetResource = webResetResource("session.one", "tab:1:frame:0")!;
  return binding;
}

const press = { definitionId: "web.output.dom-click", parameterValues: { selector: "#reserve" } };
type Controls = { page: string; location: string; before: Record<string, number>; after: Record<string, number> };
type Values = { page: string; location: string; replaced: Array<{ place: string; from: string; to: string }> };

/** The pass on entry `n`: Reserve pressed, the toggle flipping and a copy leaving the shelf; the page not left. */
function pass(n: number) {
  const before = entry(n, false, 3), after = entry(n, true, 2);
  const diff = webStateDiffPlaces(webStateSnapshotPlaces(before), webStateSnapshotPlaces(after), press, false);
  return { before, after, diff, spot: diff.spot as JsonObject, controls: diff.controls as Controls, values: diff.values as Values };
}

test("each pass's act carries its page's one place token in its spot, its control counts, its values and a receipt read there", () => {
  for (const n of [1, 2]) {
    const { before, after, spot, controls, values } = pass(n);
    const place = spot.place;
    assert.equal(typeof place, "string", `pass ${n}: the spot names the control's place`);
    // The control counts are keyed by exactly that place on both sides.
    assert.deepEqual(Object.keys(webControlStates(before)), [place as string]);
    assert.deepEqual(Object.keys(webControlStates(after)), [place as string]);
    assert.deepEqual(controls.before, webControlStates(before)[place as string]);
    assert.deepEqual(controls.after, webControlStates(after)[place as string]);
    assert.notDeepEqual(controls.before, controls.after, "the toggle's state moved");
    // The values name the same page scope and location as the controls and the spot.
    assert.equal(values.page, controls.page);
    assert.equal(values.location, controls.location);
    assert.equal(spot.scope, controls.page);
    assert.equal(controls.location, `https://catalogue.test/entries/${n}/`);
    assert.equal(values.replaced.length, 1);
    assert.equal(values.replaced[0]!.from, webValueStates(before)[values.replaced[0]!.place]);
    assert.equal(values.replaced[0]!.to, webValueStates(after)[values.replaced[0]!.place]);
    // And the page token is the one a start-state read names the page by.
    assert.equal(controls.page, webControlSpotToken("scope", `${spot.resource}\0${controls.location}`));
  }
});

test("the two passes' acts carry different place tokens, each consistent in itself", () => {
  const first = pass(1), second = pass(2);
  assert.notEqual(first.spot.place, second.spot.place);
  assert.notEqual(first.controls.page, second.controls.page);
  // Neither pass's counts appear under the other's place.
  assert.equal(webControlStates(second.after)[first.spot.place as string], undefined);
  assert.equal(webControlStates(first.after)[second.spot.place as string], undefined);
});
