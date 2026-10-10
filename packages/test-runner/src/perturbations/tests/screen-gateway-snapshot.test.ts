import assert from "node:assert/strict";
import test from "node:test";
import { screenGatewaySnapshot } from "../screen-gateway-snapshot.js";

test("sessions keep their status and times, audit entries since the cut keep type and command, and nothing else is kept", () => {
  const screened = screenGatewaySnapshot({
    ok: true,
    payload: {
      publicUrl: "ws://127.0.0.1:4877/client",
      sessions: [{ sessionId: "s1", clientId: "client-secret-id", status: "ready", connectedAt: 10, lastSeenAt: 20, name: "FluxIQ", metadata: { token: "t" } }],
      trustedClients: [{ tokenHash: "hash" }],
      auditLog: [
        { id: "a0", timestamp: 5, type: "session.ready", message: "old", sessionId: "s1" },
        { id: "a2", timestamp: 40, type: "session.disconnected", message: "gone", sessionId: "s1" },
        { id: "a1", timestamp: 30, type: "action.dispatched", message: "page text", sessionId: "s1", metadata: { commandId: "c1", selector: "#x" } },
      ],
    },
  }, 30);
  assert.deepEqual(screened, {
    sessions: [{ sessionId: "s1", status: "ready", connectedAt: 10, lastSeenAt: 20, disconnectedAt: null }],
    audit: [
      { timestamp: 30, sessionId: "s1", type: "action.dispatched", commandId: "c1" },
      { timestamp: 40, sessionId: "s1", type: "session.disconnected", commandId: null },
    ],
  });
});

test("a response with no snapshot says so rather than reading as no sessions", () => {
  assert.deepEqual(screenGatewaySnapshot(undefined, 0), { sessions: null, audit: null });
});
