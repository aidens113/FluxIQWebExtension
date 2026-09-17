// `withSelectorMemo` keeps answers only for the call it wraps. These rows pin
// the three properties that make that safe: nothing is kept outside a scope, a
// nested call joins the outer scope rather than starting a second one, and the
// scope ends -- even when the capture throws -- so the next action's selectors
// are measured against the page as it then is.

import assert from "node:assert/strict";
import test from "node:test";
import { activeSelectorMemo, withSelectorMemo } from "../selector-memo";

test("outside a scope nothing is kept", () => {
  assert.equal(activeSelectorMemo(), undefined);
});

test("a scope offers one memo to everything it runs, a nested scope joins it, and it ends with the call", () => {
  const seen = withSelectorMemo(() => {
    const outer = activeSelectorMemo();
    assert.ok(outer);
    const inner = withSelectorMemo(() => activeSelectorMemo());
    assert.equal(inner, outer);
    // The nested call returning does not end the outer scope.
    assert.equal(activeSelectorMemo(), outer);
    return outer;
  });
  assert.ok(seen);
  assert.equal(activeSelectorMemo(), undefined);
  const next = withSelectorMemo(() => activeSelectorMemo());
  assert.notEqual(next, seen, "a new capture starts from nothing");
});

test("a capture that throws still ends its scope", () => {
  assert.throws(() => withSelectorMemo(() => {
    throw new Error("capture failed");
  }), /capture failed/);
  assert.equal(activeSelectorMemo(), undefined);
});
