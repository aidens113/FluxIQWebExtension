// The cleared layers as they may travel (t401): each entry's kind and
// dismissal word from closed sets, nothing a producer put beside them, at most
// the bound, and nothing at all for a value with no well-formed entry.

import assert from "node:assert/strict";
import test from "node:test";
import { WEB_AUTOMATION_CLEARED_LAYERS_MAX, webAutomationClearedLayersValue } from "../cleared-layers";

test("well-formed entries are copied, kind and control alone", () => {
  assert.deepEqual(
    webAutomationClearedLayersValue([{ kind: "rate_limit", control: "OK", label: "OK", text: "You're going too fast" }, { kind: "dialog", control: "Not now" }]),
    [{ kind: "rate_limit", control: "OK" }, { kind: "dialog", control: "Not now" }]
  );
});

test("an entry with a word outside the closed sets is dropped, never guessed at", () => {
  assert.deepEqual(
    webAutomationClearedLayersValue([{ kind: "dialog", control: "Try again" }, { kind: "robot_check", control: "Close" }, { kind: "consent", control: "Reject" }]),
    [{ kind: "consent", control: "Reject" }]
  );
});

test("anything that is not a list with a well-formed entry is nothing", () => {
  for (const value of [undefined, null, "OK", {}, [], [null], [{ kind: "dialog" }], [{ control: "Close" }], [["dialog", "Close"]]]) {
    assert.equal(webAutomationClearedLayersValue(value), undefined, JSON.stringify(value));
  }
});

test("at most the bound travels", () => {
  const many = Array.from({ length: WEB_AUTOMATION_CLEARED_LAYERS_MAX + 5 }, () => ({ kind: "dialog", control: "Close" }));
  assert.equal(webAutomationClearedLayersValue(many)?.length, WEB_AUTOMATION_CLEARED_LAYERS_MAX);
});
