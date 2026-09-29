// Coverage of gateway-session.ts's state transitions that need no socket:
// reaching `connected` clears whatever error came before it, and no other
// state does, so a failure stays visible until the connection is actually back.

import assert from "node:assert/strict";
import test from "node:test";

import type { FluxIQSession, FluxIQSettings } from "../../../shared/protocol";
import { GatewaySession, type GatewaySessionDeps } from "../gateway-session";

function harness() {
  const events: string[] = [];
  const deps: GatewaySessionDeps = {
    settings: () => ({ gatewayUrl: "ws://gateway.test", autoReconnect: false }) as FluxIQSettings,
    session: () => ({ clientId: "client-1" }) as FluxIQSession,
    persistSession: async () => undefined,
    emitStatus: () => events.push("emit"),
    reportError: (message) => events.push(`error ${message}`),
    clearError: () => events.push("clearError"),
    beforeConnect: async () => undefined,
    queue: { queueEvent: async () => 0, readQueuedEvents: async () => [], clearQueuedEvents: async () => undefined },
    handlers: {
      onServerMessage: () => undefined,
      onPairingRequired: () => undefined,
      onSessionReady: () => undefined,
      onCommand: () => undefined,
      onHeartbeat: () => undefined
    }
  };
  return { session: new GatewaySession(deps), events };
}

test("becoming connected clears the last error before the status is published", () => {
  const h = harness();
  h.session.markSessionReady();
  assert.equal(h.session.state(), "connected");
  assert.deepEqual(h.events, ["clearError", "emit"]);
});

test("failing or disconnecting keeps the error", () => {
  const h = harness();
  h.session.markFailed();
  h.session.markDisconnected();
  assert.deepEqual(h.events, ["emit", "emit"]);
});
