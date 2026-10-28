// A step's value witness (t772): a confirming press that reloads its page to the
// same address and replaces a value the page shows carries, on its state diff,
// each replaced value's own place with the value before (`from`) and after
// (`to`), as opaque tokens, so FluxIQ Core can see the value set back later. The
// site is a choir's rehearsal planner: the room a section rehearses in, chosen
// in a dialog and confirmed with a button that reloads the planner.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { sanitizeWebLlmSnapshotWithBindings, webControlSpotToken, webControlStates, webResetResource, webValueStates, type WebLlmSnapshotBinding } from "../../../llm-evidence";
import { webStateDiffPlaces, webStateSnapshotPlaces, webStateValueReplacements } from "..";

const PLANNER = "https://choir.test/planner";

/** A binding of `elements` at `url`, read from tab 1's top frame of one session. */
function page(elements: JsonObject[], url = PLANNER): WebLlmSnapshotBinding {
  const binding = sanitizeWebLlmSnapshotWithBindings({ url, title: "Planner", interactiveElements: elements });
  binding.resetResource = webResetResource("session.one", "tab:1:frame:0")!;
  return binding;
}

const ROOM_A = "Room A, east wing", ROOM_B = "Room B, west wing";

/**
 * The planner with `room` shown and its room chooser: `dialog` open over the page; `inline`, open in the page below the
 * room, each option's label in the room's own words; `closed` after the confirming press reloaded the planner, its
 * inline options still in the page but hidden.
 */
function planner(room: string, chooser: "dialog" | "inline" | "closed" | "none", url = PLANNER): WebLlmSnapshotBinding {
  const inDialog = chooser === "dialog" ? { context: { dialog: "Choose a room" } } : {};
  const hidden = chooser === "closed" ? { hidden: true } : {};
  return page([
    { tagName: "main", selector: "main" },
    { tagName: "h1", selector: "main > h1", visibleText: "Tenor rehearsals", parent: 0 },
    { tagName: "p", selector: "main > p:nth-of-type(1)", visibleText: room, parent: 0 },
    { tagName: "p", selector: "main > p:nth-of-type(2)", visibleText: "Thursdays at seven", parent: 0 },
    { tagName: "span", selector: "main > span", implicitRole: "button", visibleText: "Change", parent: 0 },
    ...(chooser === "none" ? [] : [
      { tagName: "div", selector: "#chooser", ...(chooser === "dialog" ? { role: "dialog", accessibleName: "Choose a room" } : {}), ...inDialog, ...hidden },
      { tagName: "label", selector: "#chooser > label:nth-of-type(1)", visibleText: ROOM_A, parent: 5, ...inDialog, ...hidden },
      { tagName: "input", selector: "#room-a", implicitRole: "radio", inputType: "radio", accessibleName: ROOM_A, checked: room === ROOM_A, parent: 6, ...inDialog, ...hidden },
      { tagName: "label", selector: "#chooser > label:nth-of-type(2)", visibleText: ROOM_B, parent: 5, ...inDialog, ...hidden },
      { tagName: "input", selector: "#room-b", implicitRole: "radio", inputType: "radio", accessibleName: ROOM_B, checked: room !== ROOM_A, parent: 8, ...inDialog, ...hidden },
      { tagName: "button", selector: "#use", implicitRole: "button", visibleText: "Use this room", parent: 5, ...inDialog, ...hidden }
    ])
  ], url);
}

const use = { definitionId: "web.output.dom-click", parameterValues: { selector: "#use" } };

function diff(before: WebLlmSnapshotBinding, after: WebLlmSnapshotBinding, documentChanged: boolean, node: { definitionId: string; parameterValues?: JsonObject } = use): JsonObject {
  return webStateDiffPlaces(webStateSnapshotPlaces(before), webStateSnapshotPlaces(after), node, documentChanged);
}

type Values = { page: string; location: string; replaced: Array<{ place: string; from: string; to: string; newValue?: true }> };

test("a confirming press in a dialog that reloads its page to the same address carries the value it replaced at its own place", () => {
  const before = planner(ROOM_A, "dialog"), after = planner(ROOM_B, "none");
  const values = diff(before, after, true).values as Values | undefined;
  assert.ok(values, "a reload to the same address still stayed on its page");
  const resource = webResetResource("session.one", "tab:1:frame:0");
  assert.equal(values.page, webControlSpotToken("scope", `${resource}\0${PLANNER}`), "the page's scope as a start-state read names it");
  assert.equal(values.location, PLANNER);
  // Only the room: the dialog's lines left with the dialog, the radios are controls, and the time did not change.
  assert.equal(values.replaced.length, 1);
  const [room] = values.replaced;
  const was = webValueStates(before), now = webValueStates(after);
  assert.equal(room!.from, was[room!.place], "from: the value its place showed before, as a read reports it");
  assert.equal(room!.to, now[room!.place], "to: the value its place shows after");
  assert.equal(room!.newValue, true, "no value of the page itself showed the new room before");
  // Opaque: no words of the page leave the domain but the location.
  const { location: _location, ...opaque } = values;
  assert.doesNotMatch(JSON.stringify(opaque), /Room|wing|Thursday|Tenor/u);
});

test("a chooser open in the page, whose option labels show the new value before the press, still yields the replacement, without newValue", () => {
  const before = planner(ROOM_A, "inline"), after = planner(ROOM_B, "closed");
  const values = diff(before, after, true).values as Values | undefined;
  assert.ok(values);
  // The labels are hidden after the reload, so they are on one side only; the room is the one place on both that changed.
  assert.equal(values.replaced.length, 1);
  const [room] = values.replaced;
  assert.equal(room!.from, webValueStates(before)[room!.place]);
  assert.equal(room!.to, webValueStates(after)[room!.place]);
  assert.equal(room!.newValue, undefined, "the option's label showed these words before the press");
});

test("the same replacement on a press that stays on its document is carried the same way", () => {
  const values = diff(planner(ROOM_A, "dialog"), planner(ROOM_B, "none"), false).values as Values | undefined;
  assert.equal(values?.replaced.length, 1);
});

test("a press that moved to another address carries no values and no control counts", () => {
  const elsewhere = planner(ROOM_B, "none", "https://choir.test/planner/basses");
  const moved = diff(planner(ROOM_A, "dialog"), elsewhere, true);
  assert.equal(moved.values, undefined);
  assert.equal(moved.controls, undefined);
});

test("a press that changed no shown value carries none", () => {
  assert.equal(diff(planner(ROOM_A, "dialog"), planner(ROOM_A, "none"), true).values, undefined, "only the dialog closed");
  assert.equal(diff(planner(ROOM_A, "inline"), planner(ROOM_A, "closed"), true).values, undefined, "only the chooser closed");
});

test("a reload to the same address carries the pressed control's counts at its place, as a press that stayed on its document does", () => {
  const toggle = (on: boolean) => page([
    { tagName: "main", selector: "main" },
    { tagName: "div", role: "button", selector: "main > div.reminder", accessibleName: on ? "Reminders on" : "Reminders off", attributes: { "aria-pressed": String(on) }, parent: 0 }
  ]);
  const before = toggle(false), after = toggle(true);
  const press = { definitionId: "web.output.dom-click", parameterValues: { selector: "main > div.reminder" } };
  const reloaded = diff(before, after, true, press);
  const spot = reloaded.spot as { place: string; state: string };
  const controls = reloaded.controls as { before: Record<string, number>; after: Record<string, number> } | undefined;
  assert.ok(controls, "the reload stayed on its page");
  assert.deepEqual(controls.before, webControlStates(before)[spot.place]);
  assert.deepEqual(controls.after, webControlStates(after)[spot.place]);
});

test("a value still on the page is no replacement; a value gone from it is, marked newValue only where the new value is new to the page", () => {
  // Two places swapping their values replace nothing: no value is gone.
  assert.deepEqual(webStateValueReplacements({ a: "first", b: "second" }, { a: "second", b: "first" }), []);
  // A row inserted above another: each positional place now shows the row above it, and every old value is still shown.
  assert.deepEqual(webStateValueReplacements({ a: "row-1", b: "row-2" }, { a: "row-0", b: "row-1", c: "row-2" }), []);
  // A real replacement: the old value gone, the new one new to the page.
  assert.deepEqual(webStateValueReplacements({ a: "old", b: "kept" }, { a: "new", b: "kept" }), [{ place: "a", from: "old", to: "new", newValue: true }]);
  // The new value was shown elsewhere before (an option's label): still a replacement, without newValue.
  assert.deepEqual(webStateValueReplacements({ a: "old", b: "new" }, { a: "new" }), [{ place: "a", from: "old", to: "new" }]);
  // A notice that left, putting the line below it at its place: the same weak shape, which Core never lets keep an act open.
  assert.deepEqual(webStateValueReplacements({ a: "notice", b: "time" }, { a: "time" }), [{ place: "a", from: "notice", to: "time" }]);
  // One value shown twice and replaced at both places is two replacements.
  assert.deepEqual(webStateValueReplacements({ a: "old", b: "old" }, { a: "new", b: "new" }), [{ place: "a", from: "old", to: "new", newValue: true }, { place: "b", from: "old", to: "new", newValue: true }]);
});
