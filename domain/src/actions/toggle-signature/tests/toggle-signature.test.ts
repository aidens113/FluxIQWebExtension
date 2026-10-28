import assert from "node:assert/strict";
import test from "node:test";
import { webToggleSignatureOf, webToggleSignatureShown, webToggleSignatureValue, type WebToggleReading } from "..";

const named = (name: string): WebToggleReading => ({ states: {}, name });

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
