// The getting-started steps after the background lost the wait the panel was
// showing (t707 P1): the dead approval code is never shown, the person is told
// it expired, and Connect is the button.

import assert from "node:assert/strict";
import test from "node:test";
import { statusWith } from "../../tests/status-fixture";
import { startGuide, type StartGuide } from "../start-steps";

const states = (guide: StartGuide) => guide.steps.map((step) => `${step.key}:${step.state}`);

test("a lost pairing: no code, the code expired, Connect gets a new one", () => {
  const guide = startGuide(statusWith(), false, "pairing");
  assert.equal(guide.gated, true);
  assert.equal(guide.pairingCode, undefined);
  assert.deepEqual(guide.connect, { label: "Connect", action: "connect" });
  assert.deepEqual(states(guide), ["open:current", "connect:problem", "approve:todo"]);
  assert.match(guide.steps[1]?.line ?? "", /code expired/u);
  assert.match(guide.steps[1]?.line ?? "", /Connect/u);
});

test("a lost pairing whose status still says pairing (no answer) never shows the old code", () => {
  const guide = startGuide(statusWith({ connectionState: "pairing", pairingReferenceCode: "114605" }), false, "pairing");
  assert.equal(guide.pairingCode, undefined);
  assert.deepEqual(guide.connect, { label: "Connect", action: "connect" });
});

test("a lost connection attempt says the extension restarted and offers Connect", () => {
  const guide = startGuide(statusWith({ paired: true }), false, "connecting");
  assert.deepEqual(states(guide), ["open:current", "connect:problem", "approve:done"]);
  assert.match(guide.steps[1]?.line ?? "", /restarted/u);
  assert.deepEqual(guide.connect, { label: "Connect", action: "connect" });
});

test("a connected status wins over an old loss", () => {
  assert.equal(startGuide(statusWith({ connectionState: "connected", paired: true }), false, "pairing").gated, false);
});
