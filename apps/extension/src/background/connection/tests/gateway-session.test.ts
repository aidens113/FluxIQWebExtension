// Coverage of gateway-session.ts's state transitions that need no socket:
// reaching `connected` clears whatever error came before it, and no other
// state does, so a failure stays visible until the connection is actually back.

import assert from "node:assert/strict";
import test, { mock } from "node:test";

import { createClientGatewayMessage } from "@fluxiq/client-gateway-websocket";
import { HEARTBEAT_INTERVAL_MS } from "../../../shared/constants";
import type { ClientGatewayClientMessage, FluxIQSession, FluxIQSettings } from "../../../shared/protocol";
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

// A command whose result waits in the offline queue is answered with it, never
// run again (plan B3, `in-flight/command-reconciliation.ts`).
test("the offline queue is asked for a command's result by its id, and only a result answers", async () => {
  const queued: ClientGatewayClientMessage[] = [
    createClientGatewayMessage("client.recording_event", { eventId: "cmd-1", domainId: "web-automation", eventType: "dom.click", timestamp: 1, payload: { commandId: "cmd-1" } }),
    createClientGatewayMessage("client.action_result", { commandId: "cmd-2", status: "succeeded" })
  ];
  const deps: GatewaySessionDeps = {
    settings: () => ({ gatewayUrl: "ws://gateway.test", autoReconnect: false }) as FluxIQSettings,
    session: () => ({ clientId: "client-1" }) as FluxIQSession,
    persistSession: async () => undefined,
    emitStatus: () => undefined,
    reportError: () => undefined,
    clearError: () => undefined,
    beforeConnect: async () => undefined,
    queue: { queueEvent: async () => 0, readQueuedEvents: async () => queued, clearQueuedEvents: async () => undefined },
    handlers: { onServerMessage: () => undefined, onPairingRequired: () => undefined, onSessionReady: () => undefined, onCommand: () => undefined, onHeartbeat: () => undefined }
  };
  const session = new GatewaySession(deps);
  assert.deepEqual(await session.queuedActionResult("cmd-2"), { commandId: "cmd-2", status: "succeeded" });
  assert.equal(await session.queuedActionResult("cmd-1"), undefined, "a recording event is not a result");
  assert.equal(await session.queuedActionResult("cmd-3"), undefined);
});

// --- Staying awake while a person approves ------------------------------------
// t706: Chrome's MV3 idle rule stopped the service worker about 30 s after the
// pairing code showed, because nothing reset its idle timer while the session
// waited for approval. The socket closed, and a person who approved after that
// was approved for a socket that no longer existed. Each heartbeat tick now
// calls `keepAlive` while the socket is open but not connected.

/** A socket that opens on the next turn and can be dropped by the test. */
class OpeningSocket {
  static latest: OpeningSocket | undefined;
  readyState = 0;
  private readonly listeners = new Map<string, Set<(event: unknown) => void>>();
  constructor(readonly url: string) {
    OpeningSocket.latest = this;
    setTimeout(() => {
      this.readyState = 1;
      for (const listener of this.listeners.get("open") ?? []) listener({});
    }, 0);
  }
  send(): void {}
  close(): void { this.readyState = 3; }
  addEventListener(type: string, listener: (event: unknown) => void): void {
    const set = this.listeners.get(type) ?? new Set();
    set.add(listener);
    this.listeners.set(type, set);
  }
  removeEventListener(type: string, listener: (event: unknown) => void): void {
    this.listeners.get(type)?.delete(listener);
  }
  /** The worker stopping, or the network dropping: the socket closes under the session. */
  drop(): void {
    this.readyState = 3;
    for (const listener of this.listeners.get("close") ?? []) listener({ code: 1006, reason: "" });
  }
}

function tickingHarness(token: string | undefined) {
  const ticks: string[] = [];
  const deps: GatewaySessionDeps = {
    settings: () => ({ gatewayUrl: "ws://gateway.test", autoReconnect: false }) as FluxIQSettings,
    session: () => ({ clientId: "client-1", ...(token !== undefined ? { token } : {}) }) as FluxIQSession,
    persistSession: async () => undefined,
    emitStatus: () => undefined,
    reportError: () => undefined,
    clearError: () => undefined,
    beforeConnect: async () => undefined,
    queue: { queueEvent: async () => 0, readQueuedEvents: async () => [], clearQueuedEvents: async () => undefined },
    handlers: {
      onServerMessage: () => undefined,
      onPairingRequired: () => undefined,
      onSessionReady: () => undefined,
      onCommand: () => undefined,
      onHeartbeat: () => ticks.push("heartbeat"),
      keepAlive: () => ticks.push("keepAlive")
    }
  };
  return { session: new GatewaySession(deps), ticks };
}

/** Opens a session with `setInterval` faked (the socket still opens on a real timeout) and runs `body` against it. */
async function withTickingSession(token: string | undefined, body: (h: ReturnType<typeof tickingHarness>) => void | Promise<void>): Promise<void> {
  const h = tickingHarness(token);
  mock.timers.enable({ apis: ["setInterval"] });
  try {
    await withSocket(OpeningSocket, async () => {
      await h.session.connect();
      try { await body(h); } finally { h.session.closeClient(); }
    });
  } finally {
    mock.timers.reset();
  }
}

test("while a person approves pairing, every tick keeps the worker awake and sends no heartbeat", async () => {
  await withTickingSession(undefined, (h) => {
    assert.equal(h.session.state(), "pairing");
    mock.timers.tick(HEARTBEAT_INTERVAL_MS * 15);
    assert.deepEqual(h.ticks, Array(15).fill("keepAlive"), "five minutes of approval window, a keepalive every tick");
  });
});

test("while the gateway checks a saved token, every tick keeps the worker awake", async () => {
  await withTickingSession("token-1", (h) => {
    assert.equal(h.session.state(), "connecting");
    mock.timers.tick(HEARTBEAT_INTERVAL_MS * 2);
    assert.deepEqual(h.ticks, ["keepAlive", "keepAlive"]);
  });
});

test("once connected, ticks are heartbeats, as before, and no keepalive", async () => {
  await withTickingSession(undefined, (h) => {
    mock.timers.tick(HEARTBEAT_INTERVAL_MS);
    h.session.markSessionReady();
    mock.timers.tick(HEARTBEAT_INTERVAL_MS * 2);
    assert.deepEqual(h.ticks, ["keepAlive", "heartbeat", "heartbeat"]);
  });
});

test("after the socket closes, nothing ticks", async () => {
  await withTickingSession(undefined, (h) => {
    mock.timers.tick(HEARTBEAT_INTERVAL_MS);
    OpeningSocket.latest!.drop();
    assert.equal(h.session.state(), "disconnected");
    mock.timers.tick(HEARTBEAT_INTERVAL_MS * 5);
    assert.deepEqual(h.ticks, ["keepAlive"]);
  });
});

test("after the extension closes the client, nothing ticks", async () => {
  await withTickingSession(undefined, (h) => {
    h.session.closeClient();
    mock.timers.tick(HEARTBEAT_INTERVAL_MS * 5);
    assert.deepEqual(h.ticks, []);
  });
});
