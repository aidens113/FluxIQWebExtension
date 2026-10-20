// The browser a host lease is granted on, picked by the one web session rule:
// a second session that is unpaired, merely connected, recording or gone
// neither blocks the lease nor receives it.

import assert from "node:assert/strict";
import test from "node:test";
import type { ClientGatewaySession } from "@fluxiq/client-gateway-websocket";
import { webAutomationLeasableSession } from "..";

function session(clientId: string, overrides: Partial<ClientGatewaySession> = {}): ClientGatewaySession {
  return {
    sessionId: `session-${clientId}`,
    clientId,
    clientType: "extension",
    name: "FluxIQ Browser Extension",
    status: "ready",
    connectedAt: 1,
    lastSeenAt: 1,
    capabilities: [{ id: "web.actions", kind: "action", metadata: { domainId: "web-automation" } }],
    ...overrides
  };
}

test("an unpaired, connected, recording or disconnected second session neither blocks the lease nor receives it", () => {
  const others = [
    session("unpaired", { status: "pairing_required" }),
    session("connected", { status: "connected" }),
    session("recording", { activeRecordingId: "rec-1" }),
    session("gone", { disconnectedAt: 2 })
  ];
  assert.equal(webAutomationLeasableSession([...others, session("client-a")])?.clientId, "client-a");
  assert.equal(webAutomationLeasableSession(others), undefined);
});

test("two browsers a build may drive lend neither", () => {
  assert.equal(webAutomationLeasableSession([session("client-a"), session("client-b")]), undefined);
});
