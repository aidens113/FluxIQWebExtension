// t968: a second request for the same connection joins the attempt under way, so
// the approval code the first one shows is not thrown away.

import assert from "node:assert/strict";
import test from "node:test";
import { joinsPendingConnect } from "..";

const current = { gatewayUrl: "ws://127.0.0.1:41002/client", coreApiUrl: "http://127.0.0.1:41001" };

test("an identical request while connecting or waiting on approval joins it", () => {
  assert.equal(joinsPendingConnect("pairing", current, { ...current }, undefined), true);
  assert.equal(joinsPendingConnect("connecting", current, { ...current }, undefined), true);
  assert.equal(joinsPendingConnect("pairing", current, {}, undefined), true, "a request naming no address asks for the ones in use");
});

test("a different address, an enrolment ticket, or no attempt under way starts over", () => {
  assert.equal(joinsPendingConnect("pairing", current, { ...current, coreApiUrl: "http://127.0.0.1:3000" }, undefined), false);
  assert.equal(joinsPendingConnect("pairing", current, { ...current, gatewayUrl: "ws://127.0.0.1:9/client" }, undefined), false);
  assert.equal(joinsPendingConnect("pairing", current, { ...current }, "ticket"), false);
  for (const state of ["disconnected", "connected", "reconnecting", "error"] as const) assert.equal(joinsPendingConnect(state, current, { ...current }, undefined), false, state);
});
