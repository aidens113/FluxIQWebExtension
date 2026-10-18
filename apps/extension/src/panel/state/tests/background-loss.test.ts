// When a re-read of the status says the background lost the wait the panel
// was showing: a pairing or a connection under way that a restarted worker no
// longer holds.

import assert from "node:assert/strict";
import test from "node:test";
import { statusWith } from "../../tests/status-fixture";
import { backgroundLoss } from "../background-loss";

test("a pairing the background no longer holds is a lost pairing", () => {
  const pairing = statusWith({ connectionState: "pairing", pairingReferenceCode: "114605" });
  assert.equal(backgroundLoss(pairing, statusWith()), "pairing");
  assert.equal(backgroundLoss(pairing, statusWith({ connectionState: "error" })), "pairing");
});

test("a pairing whose background gave no answer is lost too", () => {
  const pairing = statusWith({ connectionState: "pairing", pairingReferenceCode: "114605" });
  assert.equal(backgroundLoss(pairing, undefined), "pairing");
});

test("a connection under way that came back down is a lost connection", () => {
  assert.equal(backgroundLoss(statusWith({ connectionState: "connecting" }), statusWith()), "connecting");
  assert.equal(backgroundLoss(statusWith({ connectionState: "reconnecting", paired: true }), undefined), "connecting");
});

test("a wait the background still holds, or one that moved on, is not lost", () => {
  const pairing = statusWith({ connectionState: "pairing", pairingReferenceCode: "114605" });
  assert.equal(backgroundLoss(pairing, pairing), undefined);
  assert.equal(backgroundLoss(pairing, statusWith({ connectionState: "connected", paired: true })), undefined);
  assert.equal(backgroundLoss(statusWith({ connectionState: "connecting" }), pairing), undefined);
});

test("nothing was waiting: nothing is lost", () => {
  assert.equal(backgroundLoss(statusWith(), undefined), undefined);
  assert.equal(backgroundLoss(statusWith({ connectionState: "connected", paired: true }), statusWith()), undefined);
  assert.equal(backgroundLoss(undefined, statusWith()), undefined);
});
