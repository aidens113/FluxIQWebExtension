import assert from "node:assert/strict";
import test from "node:test";
import { webToggleOutput, webToggleSignatureOf, webToggleSignatureShown, webToggleSignatureValue, type WebToggleReading } from "..";

const named = (name: string): WebToggleReading => ({ states: {}, name });

test("toggle output retains observed pre-state and supports legacy after-only observations", () => {
  const signature = webToggleSignatureOf(named("Save"), named("Unsave"))!;
  const beforeSignature = webToggleSignatureOf(named("Unsave"), named("Save"))!;
  assert.deepEqual(webToggleOutput(signature, beforeSignature), { signature, beforeSignature });
  assert.deepEqual(webToggleOutput(signature), { signature });
});

test("a name flipping Save to Unsave gains unsave and loses save, whatever the row", () => {
  const signature = webToggleSignatureOf(named("Save Senior Engineer"), named("Unsave Senior Engineer"));
  assert.deepEqual(signature, { via: "name", gains: ["unsave"], loses: ["save"] });
  assert.equal(webToggleSignatureShown(signature!, named("Unsave Product Designer")), true);
  assert.equal(webToggleSignatureShown(signature!, named("Save Product Designer")), false);
});

test("a stated state that flipped is the attribute signature; no change says nothing", () => {
  const was: WebToggleReading = { states: { "aria-pressed": false }, name: "Like" };
  const now: WebToggleReading = { states: { "aria-pressed": true }, name: "Like" };
  const signature = webToggleSignatureOf(was, now);
  assert.deepEqual(signature, { via: "attribute", attribute: "aria-pressed", to: true });
  assert.equal(webToggleSignatureShown(signature!, now), true);
  assert.equal(webToggleSignatureShown(signature!, was), false);
  assert.equal(webToggleSignatureOf(was, was), undefined);
  assert.equal(webToggleSignatureOf(named("Like"), named("like")), undefined);
});

test("a parameter is a signature only when it is exactly one", () => {
  assert.deepEqual(webToggleSignatureValue({ via: "name", gains: ["unsave"], loses: [] }), { via: "name", gains: ["unsave"], loses: [] });
  assert.deepEqual(webToggleSignatureValue({ via: "attribute", attribute: "checked", to: false }), { via: "attribute", attribute: "checked", to: false });
  assert.equal(webToggleSignatureValue({ via: "name", gains: [], loses: [] }), undefined);
  assert.equal(webToggleSignatureValue({ via: "attribute", attribute: "aria-hidden", to: true }), undefined);
  assert.equal(webToggleSignatureValue({ via: "name", gains: [], loses: ["x"], extra: 1 }), undefined);
  assert.equal(webToggleSignatureValue("x"), undefined);
});

const classed = (...levels: string[][]): WebToggleReading => ({ states: {}, name: "", classes: levels });

test("a span whose class gains a token gives the class signature, matched on another row's element", () => {
  const signature = webToggleSignatureOf(classed(["icon", "heart"]), classed(["icon", "heart", "heartOn"]));
  assert.deepEqual(signature, { via: "class", gains: ["heartOn"], loses: [] });
  assert.equal(webToggleSignatureShown(signature!, classed(["icon", "heart", "heartOn"])), true);
  assert.equal(webToggleSignatureShown(signature!, classed(["icon", "heart"])), false);
});

test("a wrapper's class counts when the element's own did not change", () => {
  const signature = webToggleSignatureOf(classed(["a"], ["wrap"]), classed(["a"], ["wrap", "saved"]));
  assert.deepEqual(signature, { via: "class", gains: ["saved"], loses: [] });
  assert.equal(webToggleSignatureShown(signature!, classed(["a"], ["wrap", "saved"])), true);
});

test("transient class tokens are ignored, and a press changing only those says nothing", () => {
  assert.equal(webToggleSignatureOf(classed(["btn"]), classed(["btn", "is-Hover", "focus-visible", "btn--loading", "isActive", "disabled"])), undefined);
  assert.deepEqual(webToggleSignatureOf(classed(["btn", "on"]), classed(["btn", "hover"])), { via: "class", gains: [], loses: ["on"] });
});

test("a name or attribute change wins over a class change; a class parameter must be exactly one", () => {
  assert.equal(webToggleSignatureOf({ states: {}, name: "Save", classes: [["a"]] }, { states: {}, name: "Unsave", classes: [["a", "on"]] })?.via, "name");
  assert.deepEqual(webToggleSignatureValue({ via: "class", gains: ["on"], loses: [] }), { via: "class", gains: ["on"], loses: [] });
  assert.equal(webToggleSignatureValue({ via: "class", gains: [], loses: [] }), undefined);
});
