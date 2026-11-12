// The session a web build drives (Core's `pickClientGatewaySession` under the
// web criteria): the requested one only when it is eligible, otherwise the only
// eligible one. A second session that is unpaired or recording neither blocks
// the pick nor is picked; two eligible sessions and no request pick none.

import assert from "node:assert/strict";
import test from "node:test";
import type { ClientGatewaySession } from "@fluxiq/client-gateway-websocket";
import { pickWebAutomationSession } from "..";
import { AutomationStudioHostLeaseScope, AutomationStudioHostResourceScheduler } from "fluxiq/automation";

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

test("an engine-managed browser is unavailable outside its run lease", () => {
  assert.equal(pickWebAutomationSession([session("managed", { managedHostId: "host-1" })]), undefined);
  assert.equal(pickWebAutomationSession([session("managed", { managedHostId: "host-1" }), session("personal")])?.sessionId, "personal");
});

test("a lease selects exactly its browser for both execution and evidence, never a requested neighbour", async () => {
  const scope = new AutomationStudioHostLeaseScope(new AutomationStudioHostResourceScheduler({
    capacity: 1,
    acquire: () => ({ resourceKey: "managed:host-2", epoch: 1, sessionId: "two" }),
    release: () => undefined
  }));
  await scope.run({ role: "fluxnode-run", briefId: "run-1" }, async () => {
    const sessions = [session("one", { managedHostId: "host-1" }), session("two", { managedHostId: "host-2" })];
    assert.equal(pickWebAutomationSession(sessions)?.sessionId, "two");
    assert.equal(pickWebAutomationSession(sessions, "one"), undefined);
    assert.equal(pickWebAutomationSession([sessions[0]!]), undefined);
    assert.equal(pickWebAutomationSession([session("two", { status: "disconnected" }), sessions[0]!]), undefined);
  });
});

test("a callback from a released lease cannot fall back to a personal browser", async () => {
  const scope = new AutomationStudioHostLeaseScope(new AutomationStudioHostResourceScheduler({ capacity: 1,
    acquire: () => ({ resourceKey: "host-one", epoch: 1, sessionId: "managed" }), release: () => undefined }));
  let resume = (): void => undefined;
  const gate = new Promise<void>((resolve) => { resume = resolve; });
  let late: Promise<unknown>;
  await scope.run({ role: "fluxnode-run", briefId: "old-run" }, async () => {
    late = gate.then(() => pickWebAutomationSession([session("personal")]));
  });
  resume();
  await assert.rejects(late!, /lease/iu);
});
