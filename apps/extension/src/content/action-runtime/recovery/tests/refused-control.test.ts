// A disabled control's state, as the loop compares it: a bounded fingerprint of
// its text and name and whether it says it is busy -- never the words themselves
// -- held beside the result and never on it.

import assert from "node:assert/strict";
import test from "node:test";
import { noteRefusedControl, refusedControl, refusedControlChanging, type RefusedControlState } from "../refused-control";
import type { BrowserActionResult } from "../../../types";

type FakeControl = { tagName?: string; text?: string; attributes?: Record<string, string>; value?: string; busyAncestor?: boolean };

function control(fake: FakeControl): Element {
  return {
    tagName: fake.tagName ?? "BUTTON",
    textContent: fake.text ?? "",
    value: fake.value,
    getAttribute: (name: string) => fake.attributes?.[name] ?? null,
    closest: (selector: string) => {
      if (selector !== '[aria-busy="true"]') return null;
      return fake.busyAncestor || fake.attributes?.["aria-busy"] === "true" ? {} : null;
    }
  } as unknown as Element;
}

function stateOf(fake: FakeControl): RefusedControlState {
  const result = { commandId: "c1" } as BrowserActionResult;
  noteRefusedControl(result, control(fake));
  const state = refusedControl(result);
  assert.ok(state);
  return state;
}

test("the fingerprint is eight hex characters and carries none of the control's words", () => {
  const state = stateOf({ text: "Please wait 3", attributes: { "aria-label": "Confirm you are a person" } });
  assert.match(state.fingerprint, /^[0-9a-f]{8}$/u);
  assert.ok(!JSON.stringify(state).includes("Please"), "no page text is kept");
  assert.equal(state.busy, false);
});

test("a label that ticks changes the fingerprint; the same label in other whitespace does not", () => {
  assert.notEqual(stateOf({ text: "Please wait 3" }).fingerprint, stateOf({ text: "Please wait 2" }).fingerprint);
  assert.equal(stateOf({ text: "Please wait 3" }).fingerprint, stateOf({ text: "  Please\n wait 3 " }).fingerprint);
  assert.notEqual(stateOf({ text: "Send", attributes: { "aria-label": "Send in 2" } }).fingerprint, stateOf({ text: "Send", attributes: { "aria-label": "Send in 1" } }).fingerprint);
});

test("a button-like input's value is its label and is read; any other input's value is not", () => {
  assert.notEqual(
    stateOf({ tagName: "INPUT", attributes: { type: "submit" }, value: "Wait 2" }).fingerprint,
    stateOf({ tagName: "INPUT", attributes: { type: "submit" }, value: "Wait 1" }).fingerprint
  );
  assert.equal(
    stateOf({ tagName: "INPUT", attributes: { type: "text" }, value: "what a person typed" }).fingerprint,
    stateOf({ tagName: "INPUT", attributes: { type: "text" }, value: "something else" }).fingerprint
  );
});

test("busy is read off the control or anything holding it", () => {
  assert.equal(stateOf({ text: "Submit", attributes: { "aria-busy": "true" } }).busy, true);
  assert.equal(stateOf({ text: "Submit", busyAncestor: true }).busy, true);
  assert.equal(stateOf({ text: "Submit", attributes: { "aria-busy": "false" } }).busy, false);
});

test("a control is changing when it is busy or looks different from the previous attempt, and not otherwise", () => {
  const three = stateOf({ text: "Please wait 3" });
  const two = stateOf({ text: "Please wait 2" });
  const busy = stateOf({ text: "Submit", attributes: { "aria-busy": "true" } });
  assert.equal(refusedControlChanging(three, two), true);
  assert.equal(refusedControlChanging(two, stateOf({ text: "Please wait 2" })), false);
  assert.equal(refusedControlChanging(busy, busy), true, "busy is a change in progress whatever the label");
  assert.equal(refusedControlChanging(undefined, busy), true);
  assert.equal(refusedControlChanging(undefined, two), false, "nothing to compare with shows no change");
  assert.equal(refusedControlChanging(three, undefined), false, "a refusal that noted no control shows nothing");
});

test("a result with no noted control answers nothing", () => {
  assert.equal(refusedControl({ commandId: "c2" } as BrowserActionResult), undefined);
});
