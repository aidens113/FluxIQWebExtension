// The cleared layers as they may travel (t401): each entry's kind and
// dismissal word from closed sets, nothing a producer put beside them, at most
// the bound, and nothing at all for a value with no well-formed entry.

import assert from "node:assert/strict";
import test from "node:test";
import { WEB_AUTOMATION_CLEARED_LAYERS_MAX, WEB_AUTOMATION_CLEARED_NAME_MAX, webAutomationClearedLayersValue } from "../cleared-layers";

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

// t470: the way out the clearing pressed rides beside the two words as far as this domain's server half.
test("a way out travels as a web page's address and one bounded descriptor, and is dropped otherwise", () => {
  const wayOut = { url: "https://social.test/requests", element: { tagName: "button", selector: "#ok", visibleText: "OK" } };
  assert.deepEqual(webAutomationClearedLayersValue([{ kind: "rate_limit", control: "OK", wayOut }]), [{ kind: "rate_limit", control: "OK", wayOut }]);
  for (const bad of [{ url: "file:///c:/x", element: { tagName: "button" } }, { url: "https://social.test/", element: "button" }, { url: "https://social.test/", element: { text: "x".repeat(20_000) } }, { url: 4, element: {} }, null]) {
    assert.deepEqual(webAutomationClearedLayersValue([{ kind: "rate_limit", control: "OK", wayOut: bad }]), [{ kind: "rate_limit", control: "OK" }], JSON.stringify(bad)?.slice(0, 60));
  }
});

// t516: the layer's own name and the pressed control's own name travel too, so Core can learn the interruption as a
// handler that waits for that layer by its words and presses that control. Both are the accessible names a page view
// already shows; each is collapsed to single spaces and cut at its bound, and anything else is dropped.
test("a layer's name and the name of the control pressed travel, collapsed and bounded", () => {
  assert.deepEqual(
    webAutomationClearedLayersValue([{ kind: "dialog", control: "Maybe later", name: "  Join the reading club\n for free holds ", controlName: "Maybe later,  I will browse first" }]),
    [{ kind: "dialog", control: "Maybe later", name: "Join the reading club for free holds", controlName: "Maybe later, I will browse first" }]
  );
  const [long] = webAutomationClearedLayersValue([{ kind: "dialog", control: "Close", name: "n".repeat(500), controlName: "c".repeat(500) }]) ?? [];
  assert.equal(long?.name?.length, WEB_AUTOMATION_CLEARED_NAME_MAX);
  assert.equal(long?.controlName?.length, WEB_AUTOMATION_CLEARED_NAME_MAX);
  for (const bad of [4, "   ", null, { text: "x" }]) {
    assert.deepEqual(webAutomationClearedLayersValue([{ kind: "dialog", control: "Close", name: bad, controlName: bad }]), [{ kind: "dialog", control: "Close" }], JSON.stringify(bad));
  }
});
