// Coverage of capabilities.ts: the live-activity capability. Core sends
// `server.activity` only to a session that declared it, so it must be declared
// exactly once under Core's own id, and it must add nothing a Flow could run.

import assert from "node:assert/strict";
import test from "node:test";
import { CLIENT_GATEWAY_ACTIVITY_CAPABILITY_ID } from "@fluxiq/client-gateway-websocket";
import { WEB_AUTOMATION_FACT_KINDS, WEB_AUTOMATION_FACTS_CAPABILITY_ID, WEB_AUTOMATION_RECONCILE_CAPABILITY_ID, webAutomationGatewayCapabilities, webAutomationRuntimeCapabilities } from "../capabilities";

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

test("the client declares web.facts with its version and kinds, and it makes nothing executable", () => {
  const [facts] = webAutomationGatewayCapabilities.filter((capability) => capability.id === WEB_AUTOMATION_FACTS_CAPABILITY_ID);
  assert.equal(WEB_AUTOMATION_FACTS_CAPABILITY_ID, "web.facts");
  assert.equal(facts?.actionTypes, undefined);
  assert.equal(facts?.outputIds, undefined);
  assert.equal(facts?.metadata?.version, 1);
  assert.equal(facts?.metadata?.actionType, "web.page.facts");
  assert.deepEqual(facts?.metadata?.kinds, [...WEB_AUTOMATION_FACT_KINDS]);
  assert.ok(webAutomationRuntimeCapabilities.some((capability) => capability.id === WEB_AUTOMATION_FACTS_CAPABILITY_ID));
});

test("the client declares web.actions.reconcile version 1, and it makes nothing executable", () => {
  const [reconcile] = webAutomationGatewayCapabilities.filter((capability) => capability.id === WEB_AUTOMATION_RECONCILE_CAPABILITY_ID);
  assert.equal(WEB_AUTOMATION_RECONCILE_CAPABILITY_ID, "web.actions.reconcile");
  assert.equal(reconcile?.metadata?.version, 1);
  assert.equal(reconcile?.metadata?.interruptedStatus, "interrupted");
  assert.equal(reconcile?.actionTypes, undefined);
  assert.equal(reconcile?.outputIds, undefined);
  assert.ok(webAutomationRuntimeCapabilities.some((capability) => capability.id === WEB_AUTOMATION_RECONCILE_CAPABILITY_ID && capability.actionTypes === undefined));
});
