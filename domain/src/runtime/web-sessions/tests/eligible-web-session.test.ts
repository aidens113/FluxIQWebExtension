// The one session-picking rule a web build drives a browser by.

import assert from "node:assert/strict";
import test from "node:test";
import type { ClientGatewaySession } from "@fluxiq/client-gateway-websocket";
import { isEligibleWebSession } from "..";

function session(overrides: Partial<ClientGatewaySession> = {}): ClientGatewaySession {
  return {
    sessionId: "session-1",
    clientId: "client-1",
    clientType: "extension",
    name: "FluxIQ Browser Extension",
    status: "ready",
    connectedAt: 1,
    lastSeenAt: 1,
    capabilities: [{ id: "web.actions", kind: "action", metadata: { domainId: "web-automation" } }],
    ...overrides
  };
}

test("a ready, idle extension offering this domain's web actions is eligible", () => {
  assert.equal(isEligibleWebSession(session()), true);
});

test("a session that is not ready is not eligible", () => {
  assert.equal(isEligibleWebSession(session({ status: "pairing_required" })), false);
});

test("a client that is not the extension is not eligible", () => {
  assert.equal(isEligibleWebSession(session({ clientType: "cli" } as Partial<ClientGatewaySession>)), false);
});

test("a recording session is not eligible", () => {
  assert.equal(isEligibleWebSession(session({ activeRecordingId: "rec-1" })), false);
});

test("web actions for another domain are not enough, but the snapshot action is", () => {
  assert.equal(isEligibleWebSession(session({ capabilities: [{ id: "web.actions", kind: "action", metadata: { domainId: "other" } }] })), false);
  assert.equal(isEligibleWebSession(session({ capabilities: [{ id: "web.actions", kind: "action", actionTypes: ["web.dom.capture_snapshot"] }] })), true);
  assert.equal(isEligibleWebSession(session({ capabilities: [{ id: "other.actions", kind: "action", metadata: { domainId: "web-automation" } }] })), false);
});

test("alsoDeclaring narrows to sessions that also declare that capability", () => {
  assert.equal(isEligibleWebSession(session(), "web.structure"), false);
  const declaring = session({ capabilities: [
    { id: "web.actions", kind: "action", metadata: { domainId: "web-automation" } },
    { id: "web.structure", kind: "action" }
  ] });
  assert.equal(isEligibleWebSession(declaring, "web.structure"), true);
});
