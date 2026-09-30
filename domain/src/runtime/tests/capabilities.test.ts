// Coverage of capabilities.ts: the live-activity capability. Core sends
// `server.activity` only to a session that declared it, so it must be declared
// exactly once under Core's own id, and it must add nothing a Flow could run.

import assert from "node:assert/strict";
import test from "node:test";
import { CLIENT_GATEWAY_ACTIVITY_CAPABILITY_ID } from "@fluxiq/client-gateway-websocket";
import { webAutomationGatewayCapabilities } from "../capabilities";

test("the client declares the live-activity stream once, under Core's id", () => {
  assert.equal(CLIENT_GATEWAY_ACTIVITY_CAPABILITY_ID, "fluxiq.activity");
  const declared = webAutomationGatewayCapabilities.filter((capability) => capability.id === CLIENT_GATEWAY_ACTIVITY_CAPABILITY_ID);
  assert.equal(declared.length, 1);
  assert.equal(declared[0]?.kind, "custom");
});

test("declaring the activity stream makes nothing executable and claims no input or output", () => {
  const [activity] = webAutomationGatewayCapabilities.filter((capability) => capability.id === CLIENT_GATEWAY_ACTIVITY_CAPABILITY_ID);
  assert.equal(activity?.actionTypes, undefined);
  assert.equal(activity?.inputIds, undefined);
  assert.equal(activity?.outputIds, undefined);
});

test("every capability id is declared once", () => {
  const ids = webAutomationGatewayCapabilities.map((capability) => capability.id);
  assert.deepEqual([...new Set(ids)], ids);
});
