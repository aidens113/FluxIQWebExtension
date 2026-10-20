// The session a web build drives (Core's `pickClientGatewaySession` under the
// web criteria): the requested one only when it is eligible, otherwise the only
// eligible one. A second session that is unpaired or recording neither blocks
// the pick nor is picked; two eligible sessions and no request pick none.

import assert from "node:assert/strict";
import test from "node:test";
import type { ClientGatewaySession } from "@fluxiq/client-gateway-websocket";
import { pickWebAutomationSession } from "..";

function session(sessionId: string, overrides: Partial<ClientGatewaySession> = {}): ClientGatewaySession {
  return {
    sessionId,
    clientId: `client-${sessionId}`,
    clientType: "extension",
    name: "FluxIQ Browser Extension",
    status: "ready",
    connectedAt: 1,
    lastSeenAt: 1,
    capabilities: [{ id: "web.actions", kind: "action", metadata: { domainId: "web-automation" } }],
    ...overrides
  };
}

const unpaired = session("unpaired", { status: "pairing_required" });
const connectedOnly = session("connected-only", { status: "connected" });
const recording = session("recording", { activeRecordingId: "rec-1" });

test("the only eligible session is picked, whatever unpaired or recording sessions sit beside it", () => {
  assert.equal(pickWebAutomationSession([session("ready")])?.sessionId, "ready");
  assert.equal(pickWebAutomationSession([unpaired, connectedOnly, recording, session("ready")])?.sessionId, "ready");
});

test("an unpaired, merely connected or recording session is never picked, even alone", () => {
  assert.equal(pickWebAutomationSession([unpaired]), undefined);
  assert.equal(pickWebAutomationSession([connectedOnly]), undefined);
  assert.equal(pickWebAutomationSession([recording]), undefined);
});

test("two eligible sessions and no request pick none", () => {
  assert.equal(pickWebAutomationSession([session("one"), session("two")]), undefined);
});

test("a requested session is picked only when it is eligible", () => {
  const sessions = [session("one"), session("two"), unpaired, recording];
  assert.equal(pickWebAutomationSession(sessions, "two")?.sessionId, "two");
  assert.equal(pickWebAutomationSession(sessions, "unpaired"), undefined);
  assert.equal(pickWebAutomationSession(sessions, "recording"), undefined);
  assert.equal(pickWebAutomationSession(sessions, "missing"), undefined);
});

test("web actions offering only the snapshot action count; another domain's do not", () => {
  const snapshotOnly = session("snapshot", { capabilities: [{ id: "web.actions", kind: "action", actionTypes: ["web.dom.capture_snapshot"] }] });
  const elsewhere = session("elsewhere", { capabilities: [{ id: "web.actions", kind: "action", metadata: { domainId: "elsewhere" } }] });
  assert.equal(pickWebAutomationSession([snapshotOnly, elsewhere])?.sessionId, "snapshot");
});
