// The state columns a control offers (`../state-sources.ts`) and the item's own
// (`../own-state.ts`), with the disabled state added in t885 (R1): a run of
// options, some of which a person cannot choose, reads which ones they are.
//
// The page is the Node stub `../../tests/fake-shadow-dom.ts`, which reads the
// disabled condition the columns write.

import assert from "node:assert/strict";
import test from "node:test";
import { readField } from "../../field-reader";
import { normalizeExtractField } from "../../field-spec";
import { fakeShadowDom } from "../../tests/fake-shadow-dom";
import { ownStateMarkSources, stateMarkSources } from "..";

const dom = fakeShadowDom();
const NAME = { selector: ":scope > button", label: "button" };
const DISABLED = ':is([aria-disabled="true"], :disabled)';

test("aria-disabled, true or false, offers the disabled column; an element that states nothing offers none", () => {
  for (const written of ["true", "false"]) {
    assert.deepEqual(stateMarkSources(dom.el("button", { "aria-disabled": written }, "Size 9"), NAME, false), [
      { kind: "text", label: "button (disabled)", selector: `:scope > button${DISABLED}`, sensitive: false, mark: "state" }
    ], written);
  }
  assert.deepEqual(stateMarkSources(dom.el("button", {}, "Size 9"), NAME, false), []);
});

test("a native disabled offers the column on a form control, a field included, and not on an element it does not disable", () => {
  assert.equal(stateMarkSources(dom.el("button", { disabled: "" }, "Size 9"), NAME, false)[0]?.label, "button (disabled)");
  assert.equal(stateMarkSources(dom.el("input", { type: "checkbox", disabled: "" }), NAME, false)[0]?.label, "button (disabled)");
  assert.deepEqual(stateMarkSources(dom.el("div", { disabled: "" }, "Size 9"), NAME, false), []);
  // A field's own value says whether it is checked; only its disabled state is a column of its own.
  assert.deepEqual(stateMarkSources(dom.el("input", { type: "checkbox", "aria-checked": "true" }), NAME, false), []);
});

test("a wordless control's disabled column reads its name, and a sensitive control offers nothing", () => {
  assert.deepEqual(stateMarkSources(dom.el("button", { "aria-disabled": "true", "aria-label": "Seat 4C" }), NAME, false), [
    { kind: "attribute", label: "button (disabled)", selector: `:scope > button${DISABLED}`, attribute: "aria-label", sensitive: false, mark: "state" }
  ]);
  assert.deepEqual(stateMarkSources(dom.el("button", { "aria-disabled": "true" }, "Size 9"), NAME, true), []);
});

test("the item's own state is a column of the item itself, read only while it is on", () => {
  const seats = ["true", "false"].map((written) => dom.el("div", { role: "button", "aria-disabled": written }, "4C"));
  const [column] = ownStateMarkSources(seats[0]!);
  assert.deepEqual(column, { kind: "text", label: "item (disabled)", selector: `:scope${DISABLED}`, sensitive: false, mark: "state" });
  const reader = normalizeExtractField("taken", { kind: column!.kind, selector: column!.selector, mark: "state" })!;
  assert.deepEqual(seats.map((seat) => readField(seat, "taken", reader)), ["4C", null]);
  // A natively disabled item holds the column too, and pressed, checked and selected are offered the same way.
  assert.deepEqual(ownStateMarkSources(dom.el("button", { disabled: "", "aria-pressed": "false" }, "Mute")).map((source) => source.label), ["item (pressed)", "item (disabled)"]);
});
