// Coverage of agent.ts: the author of an event is read only in the contract's
// shape -- a closed role, an id-shaped brief id, a non-blank subflow name.

import assert from "node:assert/strict";
import test from "node:test";
import type { ClientGatewayActivity } from "@fluxiq/client-gateway-websocket";
import { activityAgent } from "../agent";

function event(agent: unknown): ClientGatewayActivity {
  return {
    activityId: "build-1",
    sequence: 1,
    subject: { kind: "build", id: "build-1", projectId: "p" },
    phase: "building",
    label: "Working",
    at: "2026-10-13T12:00:00.000Z",
    ...(agent === undefined ? {} : { agent: agent as NonNullable<ClientGatewayActivity["agent"]> })
  };
}

test("each role in the contract is read, with its brief and subflow", () => {
  assert.deepEqual(activityAgent(event({ role: "builder", briefId: "brief-1", subflowName: "  Search  " })), { role: "builder", briefId: "brief-1", subflowName: "Search" });
  for (const role of ["supervisor", "builder", "repair", "validator"]) assert.equal(activityAgent(event({ role }))?.role, role);
});

test("no agent, an unknown role or a malformed field is read as no author, or without that field", () => {
  assert.equal(activityAgent(event(undefined)), undefined);
  assert.equal(activityAgent(event(null)), undefined);
  assert.equal(activityAgent(event("builder")), undefined);
  assert.equal(activityAgent(event({ role: "planner" })), undefined);
  assert.equal(activityAgent(event({ role: "constructor" })), undefined, "a name inherited from Object is no role");
  assert.deepEqual(activityAgent(event({ role: "builder", briefId: "a brief with spaces", subflowName: "   " })), { role: "builder" });
  assert.deepEqual(activityAgent(event({ role: "repair", briefId: 7, subflowName: 3 })), { role: "repair" });
  assert.deepEqual(activityAgent(event({ role: "builder", briefId: "x".repeat(201) })), { role: "builder" });
});
