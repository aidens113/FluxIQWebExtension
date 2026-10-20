// Coverage of gateway-session.ts: its state transitions (reaching `connected`
// clears whatever error came before it, and no other state does, so a failure
// stays visible until the connection is actually back), its open deadline, its
// keep-alive while a person approves, and the offline queue's binding: the trust
// lineage a socket ends in, what a message is queued under, and what a flush
// delivers or drops.

import assert from "node:assert/strict";
import test, { mock } from "node:test";

import {
  ClientGatewayOutbox,
  clientGatewayMemoryOutboxStore,
  createClientGatewayMessage,
  type ClientGatewayOutboxBinding,
  type ClientGatewayOutboxContext
} from "@fluxiq/client-gateway-websocket";
import { HEARTBEAT_INTERVAL_MS } from "../../../shared/constants";
import type { ClientGatewayClientMessage, FluxIQSession, FluxIQSettings } from "../../../shared/protocol";
import { GatewaySession, type GatewaySessionDeps } from "../gateway-session";

const noContext = (): ClientGatewayOutboxContext => ({ projectId: null, recordingId: null });

/** Deps that do nothing, for a test to override the few it watches. */
function harnessDeps(): GatewaySessionDeps {
  return {
    settings: () => ({ gatewayUrl: "ws://gateway.test", autoReconnect: false }) as FluxIQSettings,
    session: () => ({ clientId: "client-1" }) as FluxIQSession,
    persistSession: async () => undefined,
    emitStatus: () => undefined,
    reportError: () => undefined,
    clearError: () => undefined,
    beforeConnect: async () => undefined,
    outbox: new ClientGatewayOutbox(clientGatewayMemoryOutboxStore()),
    queueContext: noContext,
    handlers: {
      onServerMessage: () => undefined,
      onPairingRequired: () => undefined,
      onSessionReady: () => undefined,
      onCommand: () => undefined,
      onHeartbeat: () => undefined
    }
  };
}

function harness() {
  const events: string[] = [];
  const deps: GatewaySessionDeps = {
    ...harnessDeps(),
    emitStatus: () => events.push("emit"),
    reportError: (message) => events.push(`error ${message}`),
    clearError: () => events.push("clearError")
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
    ...harnessDeps(),
    reportError: (message) => events.push(`error ${message}`),
    clearError: () => events.push("clearError"),
    openTimeoutMs
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
// run again (plan B3, `in-flight/command-reconciliation.ts`), and only when it
// was queued under the lineage the client is in now.
test("the offline queue is asked for a command's result by its id, and only a result of this lineage answers", async () => {
  const outbox = new ClientGatewayOutbox(clientGatewayMemoryOutboxStore());
  await outbox.setLineage("lineage-1");
  const ours: ClientGatewayOutboxBinding = { session: "lineage-1", projectId: null, recordingId: null };
  await outbox.enqueue(createClientGatewayMessage("client.recording_event", { eventId: "cmd-1", domainId: "web-automation", eventType: "dom.click", timestamp: 1, payload: { commandId: "cmd-1" } }), ours);
  await outbox.enqueue(createClientGatewayMessage("client.action_result", { commandId: "cmd-2", status: "succeeded" }), ours);
  await outbox.enqueue(createClientGatewayMessage("client.action_result", { commandId: "cmd-4", status: "succeeded" }), { ...ours, session: "lineage-0" });
  const session = new GatewaySession({ ...harnessDeps(), outbox });
  assert.deepEqual(await session.queuedActionResult("cmd-2"), { commandId: "cmd-2", status: "succeeded" });
  assert.equal(await session.queuedActionResult("cmd-1"), undefined, "a recording event is not a result");
  assert.equal(await session.queuedActionResult("cmd-3"), undefined);
  assert.equal(await session.queuedActionResult("cmd-4"), undefined, "a result queued under an earlier trust is not this client's");
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
  readonly sent: string[] = [];
  send(data: string): void {
    this.sent.push(data);
  }
  close(): void { this.readyState = 3; }
  addEventListener(type: string, listener: (event: unknown) => void): void {
    const set = this.listeners.get(type) ?? new Set();
    set.add(listener);
    this.listeners.set(type, set);
  }
  removeEventListener(type: string, listener: (event: unknown) => void): void {
    this.listeners.get(type)?.delete(listener);
  }
  /** A server message arriving on the socket. */
  deliver(type: string, payload: unknown): void {
    for (const listener of this.listeners.get("message") ?? []) listener({ data: JSON.stringify({ id: `server-${type}`, type, protocolVersion: "1", timestamp: 1, payload }) });
  }
  /** The worker stopping, or the network dropping: the socket closes under the session. */
  drop(): void {
    this.readyState = 3;
    for (const listener of this.listeners.get("close") ?? []) listener({ code: 1006, reason: "" });
  }
}

function tickingHarness(token: string | undefined) {
  const ticks: string[] = [];
  const base = harnessDeps();
  const deps: GatewaySessionDeps = {
    ...base,
    session: () => ({ clientId: "client-1", ...(token !== undefined ? { token } : {}) }) as FluxIQSession,
    handlers: {
      ...base.handlers,
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

// --- The offline queue's binding ---------------------------------------------
// Queued page data reaches only the trust, project and recording it was queued
// under. A socket that resumes by token keeps the client's lineage (Core resumes
// the same trusted client and files its recording under it); one that had to
// pair, or said hello without a token, starts a new one. A flush drops whatever
// was queued under another lineage, project or recording.

function queueHarness(input: { token?: string; outbox?: ClientGatewayOutbox; context?: ClientGatewayOutboxContext; onQueueLoss?: GatewaySessionDeps["handlers"]["onQueueLoss"] }) {
  const store = clientGatewayMemoryOutboxStore();
  const outbox = input.outbox ?? new ClientGatewayOutbox(store);
  const state = { context: input.context ?? { projectId: "project-1", recordingId: null }, minted: 0, emits: 0 };
  const lineageAtReady: Array<Promise<string | undefined>> = [];
  let markReady: () => void = () => undefined;
  const ready = new Promise<void>((resolve) => {
    markReady = resolve;
  });
  const base = harnessDeps();
  const deps: GatewaySessionDeps = {
    ...base,
    session: () => ({ clientId: "client-1", ...(input.token !== undefined ? { token: input.token } : {}) }) as FluxIQSession,
    emitStatus: () => {
      state.emits += 1;
    },
    outbox,
    queueContext: () => state.context,
    mintLineage: () => `lineage-minted-${(state.minted += 1)}`,
    handlers: {
      ...base.handlers,
      onSessionReady: () => {
        // Queued behind any lineage write, so this reads what the write left.
        lineageAtReady.push(outbox.lineage());
        markReady();
      },
      ...(input.onQueueLoss !== undefined ? { onQueueLoss: input.onQueueLoss } : {})
    }
  };
  return { session: new GatewaySession(deps), outbox, store, state, lineageAtReady, ready };
}

/** Connects over an `OpeningSocket` (its hello is `sent[0]`) and runs `body` with it. */
async function withOpenSession(h: ReturnType<typeof queueHarness>, body: (socket: OpeningSocket) => Promise<void>): Promise<void> {
  await withSocket(OpeningSocket, async () => {
    await h.session.connect();
    try {
      await body(OpeningSocket.latest!);
    } finally {
      h.session.closeClient();
    }
  });
}

function bound(session: string, projectId: string | null, recordingId: string | null): ClientGatewayOutboxBinding {
  return { session, projectId, recordingId };
}

function recordingEvent(eventId: string): ClientGatewayClientMessage {
  return createClientGatewayMessage("client.recording_event", { eventId, eventType: "dom.click" });
}

test("a socket that resumes by token keeps the client's lineage, decided before the session is reported ready", async () => {
  const outbox = new ClientGatewayOutbox(clientGatewayMemoryOutboxStore());
  await outbox.setLineage("lineage-1");
  const h = queueHarness({ token: "token-1", outbox });
  await withOpenSession(h, async (socket) => {
    socket.deliver("server.session_ready", { sessionId: "wire-2", token: "token-2" });
    await h.ready;
  });
  assert.deepEqual(await Promise.all(h.lineageAtReady), ["lineage-1"]);
  assert.equal(h.state.minted, 0);
});

test("a socket that had to pair starts a new lineage, even though its hello carried a token", async () => {
  const outbox = new ClientGatewayOutbox(clientGatewayMemoryOutboxStore());
  await outbox.setLineage("lineage-1");
  const h = queueHarness({ token: "token-1", outbox });
  await withOpenSession(h, async (socket) => {
    socket.deliver("server.pairing_required", { referenceCode: "REF-1", reason: "Approve this client." });
    socket.deliver("server.session_ready", { sessionId: "wire-2", token: "token-2" });
    await h.ready;
  });
  assert.deepEqual(await Promise.all(h.lineageAtReady), ["lineage-minted-1"]);
  assert.equal(await outbox.lineage(), "lineage-minted-1");
});

test("a hello without a token starts a new lineage", async () => {
  const outbox = new ClientGatewayOutbox(clientGatewayMemoryOutboxStore());
  await outbox.setLineage("lineage-1");
  const h = queueHarness({ outbox });
  await withOpenSession(h, async (socket) => {
    socket.deliver("server.session_ready", { sessionId: "wire-2", token: "token-2" });
    await h.ready;
  });
  assert.deepEqual(await Promise.all(h.lineageAtReady), ["lineage-minted-1"]);
});

test("a message sent while the socket is down is queued under the lineage, the project and the recording", async () => {
  const h = queueHarness({ context: { projectId: "project-1", recordingId: "rec-1" } });
  await h.outbox.setLineage("lineage-1");
  await h.session.send("client.action_result", { commandId: "cmd-1", status: "succeeded" });
  await h.session.send("client.stop_recording", { recordingId: "rec-0" });
  assert.deepEqual((await h.store.read()).entries.map((entry) => entry.binding), [
    bound("lineage-1", "project-1", "rec-1"),
    bound("lineage-1", "project-1", "rec-0")
  ]);
  assert.equal(h.session.statusFields().queueSize, 2);
});

test("after session_ready a flush delivers, in order, only what this lineage, project and recording queued", async () => {
  const outbox = new ClientGatewayOutbox(clientGatewayMemoryOutboxStore());
  await outbox.setLineage("lineage-1");
  await outbox.enqueue(createClientGatewayMessage("client.action_result", { commandId: "cmd-a", status: "succeeded" }), bound("lineage-1", "project-1", null));
  await outbox.enqueue(recordingEvent("event-old-trust"), bound("lineage-0", "project-1", null));
  await outbox.enqueue(recordingEvent("event-other-project"), bound("lineage-1", "project-2", null));
  await outbox.enqueue(recordingEvent("event-other-recording"), bound("lineage-1", "project-1", "rec-other"));
  await outbox.enqueue(recordingEvent("event-ended"), bound("lineage-1", "project-1", "rec-ended"));
  await outbox.enqueue(createClientGatewayMessage("client.stop_recording", { recordingId: "rec-ended" }), bound("lineage-1", "project-1", "rec-ended"));
  await outbox.enqueue(recordingEvent("event-current"), bound("lineage-1", "project-1", "rec-1"));
  const h = queueHarness({ token: "token-1", outbox, context: { projectId: "project-1", recordingId: "rec-1" } });
  let sent: Array<{ type: string; payload: { commandId?: string; eventId?: string; recordingId?: string } }> = [];
  await withOpenSession(h, async (socket) => {
    socket.deliver("server.session_ready", { sessionId: "wire-2", token: "token-2" });
    await h.ready;
    await h.session.flushQueue();
    sent = socket.sent.slice(1).map((data) => JSON.parse(data) as (typeof sent)[number]);
  });
  assert.deepEqual(sent.map(({ type, payload }) => `${type} ${payload.commandId ?? payload.eventId ?? payload.recordingId}`), [
    "client.action_result cmd-a",
    "client.recording_event event-ended",
    "client.stop_recording rec-ended",
    "client.recording_event event-current"
  ]);
  assert.equal(await outbox.size(), 0);
  assert.equal(h.session.statusFields().queueSize, 0);
});

test("a flush sends FluxIQ the outbox's loss marker before the queued messages, then tells the caller", async () => {
  // A budget of one small entry: the second message queued drops the first.
  const outbox = new ClientGatewayOutbox(clientGatewayMemoryOutboxStore(), { limit: 1 });
  await outbox.setLineage("lineage-1");
  await outbox.enqueue(recordingEvent("event-dropped"), bound("lineage-1", "project-1", null));
  await outbox.enqueue(recordingEvent("event-kept"), bound("lineage-1", "project-1", null));
  const losses: number[] = [];
  const h = queueHarness({ token: "token-1", outbox, onQueueLoss: (loss) => losses.push(loss.count) });
  let sent: Array<{ type: string; payload: { code?: string; eventId?: string } }> = [];
  await withOpenSession(h, async (socket) => {
    socket.deliver("server.session_ready", { sessionId: "wire-2", token: "token-2" });
    await h.ready;
    await h.session.flushQueue();
    sent = socket.sent.slice(1).map((data) => JSON.parse(data) as (typeof sent)[number]);
  });
  assert.deepEqual(sent.map(({ type, payload }) => `${type} ${payload.code ?? payload.eventId}`), [
    "client.error client.outbox.entries_lost",
    "client.recording_event event-kept"
  ]);
  assert.deepEqual(losses, [1]);
  assert.equal(await outbox.lost(), undefined);
});

test("removing a queued step takes it out of the queue and the queue size", async () => {
  const h = queueHarness({});
  await h.outbox.setLineage("lineage-1");
  await h.session.send("client.recording_event", { eventId: "event-1", eventType: "dom.click" });
  await h.session.send("client.recording_event", { eventId: "event-2", eventType: "dom.click" });
  assert.equal(await h.session.removeQueuedRecordingEvent("event-1"), 1);
  assert.equal(h.session.statusFields().queueSize, 1);
  assert.equal(await h.session.removeQueuedRecordingEvent("event-1"), 0);
  assert.equal(await h.outbox.size(), 1);
});

test("a restarted worker takes its queue size from the stored queue, and publishes it only when it changed", async () => {
  const outbox = new ClientGatewayOutbox(clientGatewayMemoryOutboxStore());
  await outbox.enqueue(recordingEvent("event-1"), bound("lineage-1", null, null));
  await outbox.enqueue(recordingEvent("event-2"), bound("lineage-1", null, null));
  const h = queueHarness({ outbox });
  assert.equal(h.session.statusFields().queueSize, 0);
  assert.equal(await h.session.refreshQueueSize(), 2);
  assert.equal(h.session.statusFields().queueSize, 2);
  assert.equal(h.state.emits, 1);
  await h.session.refreshQueueSize();
  assert.equal(h.state.emits, 1);
});
