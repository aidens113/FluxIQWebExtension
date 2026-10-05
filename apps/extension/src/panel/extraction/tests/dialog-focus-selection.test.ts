// The caret belongs to the control it was typed in.
//
// `dialog-focus.ts` repairs focus a redraw took away: the redrawn copy of the
// same control, else a neighbouring field, else the initial control. Only the
// first of those may inherit the captured selection. Each test wraps every
// input's own `setSelectionRange`, so the assertion is about which control was
// handed a selection, not about where a coincidentally equal caret ended up.

import assert from "node:assert/strict";
import test from "node:test";
import { createExtractionDialogFocus } from "../dialog-focus";
import { withDialogDom } from "./dialog-dom";

type World = Parameters<Parameters<typeof withDialogDom>[0]>[0];
type DialogNode = ReturnType<World["document"]["createElement"]>;
type Tracked = { row: DialogNode; input: DialogNode; calls: unknown[][] };

function tracked(input: DialogNode): unknown[][] {
  const calls: unknown[][] = [];
  const own = input.setSelectionRange.bind(input);
  input.setSelectionRange = (start: number, end: number, direction?: "forward" | "backward" | "none") => { calls.push([start, end, direction]); own(start, end, direction); };
  return calls;
}

function fieldRow(world: World, key: string): Tracked {
  const row = world.document.createElement("div"); row.className = "extraction-field"; row.dataset.field = key;
  const input = world.document.createElement("input"); input.setAttribute("type", "text"); input.className = "extraction-field-label";
  const remove = world.document.createElement("button"); remove.className = "extraction-field-remove";
  row.append(input, remove);
  return { row, input, calls: tracked(input) };
}

function setup(world: World, keys: string[]) {
  const panel = world.document.createElement("section"); panel.tabIndex = -1; panel.hidden = true;
  const label = world.document.createElement("input"); label.setAttribute("type", "text"); label.className = "dataset-label";
  const labelCalls = tracked(label);
  label.setSelectionRange(1, 1);
  const fields = world.document.createElement("div");
  const rows = new Map(keys.map((key) => [key, fieldRow(world, key)] as const));
  for (const row of rows.values()) { fields.append(row.row); row.input.value = `Column ${row.row.dataset.field}`; row.input.setSelectionRange(1, 1); row.calls.length = 0; }
  labelCalls.length = 0;
  panel.append(label, fields);
  world.host.append(panel);
  const dialog = createExtractionDialogFocus(world.native(panel), { initial: () => world.native(label), returnTo: () => undefined, busy: () => false, dismiss: () => undefined });
  dialog.open();
  labelCalls.length = 0;
  return { panel, label, labelCalls, fields, rows, dialog };
}

/** Focuses `row`'s name input with a selection of 2..4, the range no other control holds. */
function typeIn(row: Tracked): void {
  row.input.focus(); row.input.setSelectionRange(2, 4, "forward"); row.calls.length = 0;
}

test("the redrawn copy of the same field inherits the selection exactly once", async () => withDialogDom((world) => {
  const view = setup(world, ["a", "b"]);
  const a = view.rows.get("a")!; typeIn(a);
  let copy: Tracked | undefined;
  view.dialog.render(() => { copy = fieldRow(world, "a"); view.fields.insertBefore(copy.row, a.row); a.row.remove(); });
  assert.equal(world.document.activeElement, copy!.input);
  assert.deepEqual(copy!.calls, [[2, 4, "forward"]]);
  assert.deepEqual(view.rows.get("b")!.calls, []);
  assert.deepEqual(view.labelCalls, []);
}));

test("removing a field moves focus to the next field without its selection", async () => withDialogDom((world) => {
  const view = setup(world, ["a", "b"]);
  const a = view.rows.get("a")!, b = view.rows.get("b")!; typeIn(a);
  view.dialog.render(() => { a.row.remove(); });
  assert.equal(world.document.activeElement, b.input);
  assert.deepEqual(b.calls, [], "the neighbour is never handed the removed field's caret");
  assert.equal(b.input.selectionStart, 1); assert.equal(b.input.selectionEnd, 1);
}));

test("removing the last field falls back to the previous field without its selection", async () => withDialogDom((world) => {
  const view = setup(world, ["a", "b"]);
  const a = view.rows.get("a")!, b = view.rows.get("b")!; typeIn(b);
  view.dialog.render(() => { b.row.remove(); });
  assert.equal(world.document.activeElement, a.input);
  assert.deepEqual(a.calls, []);
  assert.equal(a.input.selectionStart, 1); assert.equal(a.input.selectionEnd, 1);
}));

test("removing the only field focuses the initial control and leaves its caret alone", async () => withDialogDom((world) => {
  const view = setup(world, ["a"]);
  const a = view.rows.get("a")!; typeIn(a);
  view.dialog.render(() => { a.row.remove(); });
  assert.equal(world.document.activeElement, view.label);
  assert.deepEqual(view.labelCalls, []);
  assert.equal(view.label.selectionStart, 1); assert.equal(view.label.selectionEnd, 1);
}));

test("a redrawn row without the original control does not pass the selection to any fallback", async () => withDialogDom((world) => {
  const view = setup(world, ["a", "b"]);
  const a = view.rows.get("a")!, b = view.rows.get("b")!; typeIn(a);
  view.dialog.render(() => {
    const bare = world.document.createElement("div"); bare.className = "extraction-field"; bare.dataset.field = "a";
    bare.append(world.document.createElement("button"));
    view.fields.insertBefore(bare, a.row); a.row.remove();
  });
  assert.equal(world.document.activeElement, b.input);
  assert.deepEqual(b.calls, []); assert.deepEqual(view.labelCalls, []);
}));

test("a disabled redrawn copy is not a match: focus falls back and no control inherits the caret", async () => withDialogDom((world) => {
  const view = setup(world, ["a", "b"]);
  const a = view.rows.get("a")!, b = view.rows.get("b")!; typeIn(a);
  let copy: Tracked | undefined;
  view.dialog.render(() => { copy = fieldRow(world, "a"); copy.input.disabled = true; view.fields.insertBefore(copy.row, a.row); a.row.remove(); });
  assert.notEqual(world.document.activeElement, copy!.input);
  assert.deepEqual(copy!.calls, []); assert.deepEqual(b.calls, []); assert.deepEqual(view.labelCalls, []);
}));

test("deliberate focus movement during the redraw is kept and nobody's caret changes", async () => withDialogDom((world) => {
  const view = setup(world, ["a", "b"]);
  const a = view.rows.get("a")!, b = view.rows.get("b")!; typeIn(a);
  view.dialog.render(() => { b.input.focus(); a.row.remove(); });
  assert.equal(world.document.activeElement, b.input);
  assert.deepEqual(b.calls, []); assert.deepEqual(a.calls, []);
}));

test("an unfocused or hidden document gains no focus and no selection", async () => withDialogDom((world) => {
  for (const hide of ["unfocused", "hidden"] as const) {
    const view = setup(world, ["a", "b"]);
    const a = view.rows.get("a")!, b = view.rows.get("b")!; typeIn(a);
    const calls = world.document.focusCalls.length;
    view.dialog.render(() => { a.row.remove(); if (hide === "unfocused") world.document.focused = false; else world.document.visibilityState = "hidden"; });
    assert.equal(world.document.focusCalls.length, calls, hide);
    assert.deepEqual(b.calls, [], hide);
    world.document.focused = true; world.document.visibilityState = "visible";
    view.dialog.close(); view.panel.remove();
  }
}));

test("a non-text control carries no selection, so a matched button redraw sets none", async () => withDialogDom((world) => {
  const view = setup(world, ["a"]);
  const a = view.rows.get("a")!;
  const remove = a.row.querySelector(".extraction-field-remove")!; remove.focus();
  let copy: Tracked | undefined;
  view.dialog.render(() => { copy = fieldRow(world, "a"); view.fields.insertBefore(copy.row, a.row); a.row.remove(); });
  assert.equal(world.document.activeElement, copy!.row.querySelector(".extraction-field-remove"));
  assert.deepEqual(copy!.calls, []); assert.deepEqual(view.labelCalls, []);
}));
