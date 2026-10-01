import assert from "node:assert/strict";
import test from "node:test";
import { extractionFieldRowElement } from "../field-row";
import { extractionDraftFromProposal } from "../view-model";
import { proposalFixture } from "./proposal-fixture";
import { withDialogDom } from "./dialog-dom";

test("column group and action names identify the current column", async () => withDialogDom(world => {
  const field = extractionDraftFromProposal(proposalFixture(), "Synthetic dataset").fields[0]!;
  const row = extractionFieldRowElement(field, { rename() {}, changeKind() {}, changeHandling() {}, remove() {} });
  world.native(world.host).append(row);
  const mounted = world.host.querySelector(".extraction-field")!;
  assert.equal(mounted.getAttribute("role"), "group");
  assert.match(mounted.getAttribute("aria-label") ?? "", /Name/u);
  assert.match(mounted.querySelector(".extraction-field-kind")?.getAttribute("aria-label") ?? "", /Name/u);
  assert.equal(mounted.querySelector(".extraction-field-remove")?.getAttribute("aria-label"), "Remove Name");
  assert.equal(mounted.querySelector(".extraction-field-remove")?.textContent, "Remove");
}));

test("raw input keeps spaces while explicit change retains original normalization", async () => withDialogDom(world => {
  const source = extractionDraftFromProposal(proposalFixture(), "Synthetic dataset").fields[0]!;
  const inputs: string[] = [], changes: string[] = [];
  const row = extractionFieldRowElement(source, { inputName: (_key, raw) => inputs.push(raw), rename: (_key, label) => changes.push(label), changeKind() {}, changeHandling() {}, remove() {} });
  world.native(world.host).append(row);
  const name = world.host.querySelector(".extraction-field-label")!;
  name.value = "  Two words  "; name.dispatch("input");
  assert.deepEqual(inputs, ["  Two words  "]); assert.deepEqual(changes, []);
  assert.equal(name.value, "  Two words  ");
  name.dispatch("change"); assert.deepEqual(changes, ["Two words"]); assert.equal(name.value, "Two words");
  name.value = "   "; name.dispatch("change"); assert.deepEqual(changes, ["Two words", "Name"]);
}));

test("raw and committed rename update column-specific accessible names safely", async () => withDialogDom(world => {
  const source = extractionDraftFromProposal(proposalFixture(), "Synthetic dataset").fields[0]!;
  world.native(world.host).append(extractionFieldRowElement(source, { rename() {}, changeKind() {}, changeHandling() {}, remove() {} }));
  const row = world.host.querySelector(".extraction-field")!, name = row.querySelector(".extraction-field-label")!;
  const children = row.descendants().length;
  name.value = "<img src=synthetic.invalid> New"; name.dispatch("input");
  assert.equal(row.getAttribute("aria-label"), "Column <img src=synthetic.invalid> New");
  assert.equal(row.querySelector(".extraction-field-remove")!.getAttribute("aria-label"), "Remove <img src=synthetic.invalid> New");
  assert.equal(row.querySelector(".extraction-field-kind")!.getAttribute("aria-label"), "What <img src=synthetic.invalid> New reads");
  assert.equal(row.querySelector(".extraction-field-handling")!.getAttribute("aria-label"), "How to handle <img src=synthetic.invalid> New");
  assert.equal(row.descendants().length, children, "names are text attributes, never markup");
  name.value = " "; name.dispatch("input"); assert.equal(row.getAttribute("aria-label"), "Column Unnamed column");
  name.dispatch("change"); assert.equal(row.getAttribute("aria-label"), "Column Name");
}));

test("native kind/remove/checked-radio events retain source-key identity and focusable privacy note", async () => withDialogDom(world => {
  const source = extractionDraftFromProposal(proposalFixture(), "Synthetic dataset").fields[0]!;
  const calls: unknown[][] = [];
  world.native(world.host).append(extractionFieldRowElement(source, { rename() {}, changeKind: (...args) => calls.push(args), changeHandling: (...args) => calls.push(args), remove: (...args) => calls.push(args) }));
  const row = world.host.querySelector(".extraction-field")!, kind = row.querySelector(".extraction-field-kind")!;
  kind.value = "link"; kind.dispatch("change");
  const excluded = row.querySelectorAll("input").find(input => input.type === "radio" && input.value === "exclude")!;
  excluded.checked = false; excluded.dispatch("change"); assert.deepEqual(calls, [["name", "link"]]);
  excluded.checked = true; excluded.dispatch("change"); row.querySelector(".extraction-field-remove")!.dispatch("click");
  assert.deepEqual(calls, [["name", "link"], ["name", "exclude"], ["name"]]);
  const note = row.querySelector(".info-hint")!; assert.equal(note.tabIndex, 0); assert.match(note.getAttribute("aria-label") ?? "", /never read/u);
}));
