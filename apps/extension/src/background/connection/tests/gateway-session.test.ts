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

test("retrying now does nothing for a session nobody asked to connect, even a failed one", () => {
  const h = harness();
  h.session.markFailed();
  assert.equal(h.session.wantsConnection(), false);
  assert.equal(h.session.retryNow(), false);
  assert.equal(h.session.state(), "error");
});

// --- A socket that never opens ------------------------------------------------
// Before t174-w7, `connect()` awaited Core's `waitForOpen`, which had no
// deadline: a gateway that took the TCP connection and never answered the
// upgrade left a person's Connect -- and the Lab's `fluxiq.connect` -- waiting
// for ever, with nothing in the status to say why.

class NeverOpeningSocket {
  static created: NeverOpeningSocket[] = [];
  readyState = 0;
  closed = false;
  constructor(readonly url: string) { NeverOpeningSocket.created.push(this); }
  send(): void {}
  close(): void { this.closed = true; this.readyState = 3; }
  addEventListener(): void {}
  removeEventListener(): void {}
}

/** Runs with `impl` as the global WebSocket and the one `chrome` read the hello makes (its manifest version). */
function withSocket<T>(impl: unknown, run: () => Promise<T>): Promise<T> {
  const holder = globalThis as { WebSocket?: unknown; chrome?: unknown };
  const previous = { WebSocket: holder.WebSocket, chrome: holder.chrome };
  holder.WebSocket = impl;
  holder.chrome = { runtime: { getManifest: () => ({ version: "0.0.0-test" }) } };
  return run().finally(() => { holder.WebSocket = previous.WebSocket; holder.chrome = previous.chrome; });
}

function neverOpeningHarness(openTimeoutMs: number) {
  const events: string[] = [];
  const deps: GatewaySessionDeps = {
    settings: () => ({ gatewayUrl: "ws://gateway.test", autoReconnect: false }) as FluxIQSettings,
    session: () => ({ clientId: "client-1" }) as FluxIQSession,
    persistSession: async () => undefined,
    emitStatus: () => undefined,
    reportError: (message) => events.push(`error ${message}`),
    clearError: () => events.push("clearError"),
    beforeConnect: async () => undefined,
    queue: { queueEvent: async () => 0, readQueuedEvents: async () => [], clearQueuedEvents: async () => undefined },
    openTimeoutMs,
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

test("a connect whose socket never opens settles within its deadline and names open_timeout", { timeout: 5_000 }, async () => {
  NeverOpeningSocket.created = [];
  const h = neverOpeningHarness(30);
  await withSocket(NeverOpeningSocket, () => h.session.connect());
  assert.equal(h.session.state(), "error");
  assert.equal(h.events.length, 1);
  assert.match(h.events[0]!, /^error FluxIQ did not open the connection within .* \(open_timeout\)\.$/u);
  assert.equal(NeverOpeningSocket.created[0]!.closed, true, "the unopened socket is closed, not left to open later");
});

test("a connect superseded by a newer one says nothing about the newer attempt", { timeout: 5_000 }, async () => {
  NeverOpeningSocket.created = [];
  const h = neverOpeningHarness(40);
  await withSocket(NeverOpeningSocket, async () => {
    const first = h.session.connect();
    await new Promise((resolve) => setTimeout(resolve, 20));
    // A second Connect, or a reconnect, replaces the first attempt's socket.
    const second = h.session.connect();
    await first;
    // The first attempt's deadline has passed; the second's has not.
    assert.equal(h.session.state(), "connecting", "the superseded attempt did not mark the live one failed");
    assert.deepEqual(h.events, [], "the superseded attempt reported nothing");
    await second;
    assert.equal(h.session.state(), "error");
    assert.equal(h.events.length, 1);
  });
});
