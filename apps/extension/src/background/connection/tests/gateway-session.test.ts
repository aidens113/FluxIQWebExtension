// Coverage of gateway-session.ts, the web adapter over Core's connection: the
// hello every socket opens with, where the gateway token is kept, how gateway
// commands are mapped, and that the extension's timing, queue context and loss
// handler reach Core. The connection itself -- state, open deadline, backoff,
// heartbeat, lineage, queue binding and flush -- is covered by Core's
// `client-gateway-websocket/src/connection/tests/`. Tokens here are synthetic
// placeholders.

import assert from "node:assert/strict";
import test, { mock } from "node:test";

import {
  ClientGatewayOutbox,
  clientGatewayMemoryOutboxStore,
  createClientGatewayMessage,
  type ClientGatewayOutboxBinding,
  type ClientGatewayOutboxContext
} from "@fluxiq/client-gateway-websocket";
import { AUTOMATION_STUDIO_DEFAULT_RECORDING_CAPTURE_POLICY, type AutomationStudioRecordingCapturePolicy } from "fluxiq/automation-studio/nodes";
import { HEARTBEAT_INTERVAL_MS } from "../../../shared/constants";
import type { ClientGatewayClientMessage, FluxIQSession, FluxIQSettings, ServerCommandPayload } from "../../../shared/protocol";
import { effectiveSettings } from "../../capture-policy/index";
import { GatewaySession, type GatewaySessionDeps } from "../gateway-session";

const SYNTHETIC_TOKEN = "synthetic-token.0";
const NEXT_SYNTHETIC_TOKEN = "synthetic-token.1";

/** A socket that opens on the next turn, records what is sent, and lets the test speak for the gateway. */
class OpeningSocket {
  static latest: OpeningSocket | undefined;
  readyState = 0;
  readonly sent: string[] = [];
  private readonly listeners = new Map<string, Set<(event: unknown) => void>>();
  constructor(readonly url: string) {
    OpeningSocket.latest = this;
    setTimeout(() => {
      this.readyState = 1;
      for (const listener of this.listeners.get("open") ?? []) listener({});
    }, 0);
  }
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
  deliver(type: string, payload: unknown, id = `server-${type}`): void {
    for (const listener of this.listeners.get("message") ?? []) listener({ data: JSON.stringify({ id, type, protocolVersion: "1", timestamp: 1, payload }) });
  }
  /** What the client sent, parsed. */
  messages(): Array<{ type: string; clientId?: string; payload: Record<string, unknown> }> {
    return this.sent.map((data) => JSON.parse(data) as { type: string; clientId?: string; payload: Record<string, unknown> });
  }
}

type HarnessInput = {
  session?: FluxIQSession;
  outbox?: ClientGatewayOutbox;
  context?: ClientGatewayOutboxContext;
  onQueueLoss?: GatewaySessionDeps["handlers"]["onQueueLoss"];
  keepAlive?: () => void;
  // Core's recording-capture policy the hello's effective settings are clamped by.
  policy?: AutomationStudioRecordingCapturePolicy;
};

const PERSON_SETTINGS = { gatewayUrl: "ws://gateway.test", autoReconnect: false, captureMutations: true, captureInputValues: false, captureSnapshots: true, requestsEnabled: true } as FluxIQSettings;

function harness(input: HarnessInput = {}) {
  const store = clientGatewayMemoryOutboxStore();
  const outbox = input.outbox ?? new ClientGatewayOutbox(store);
  const state = {
    session: input.session ?? ({ clientId: "client-1" } as FluxIQSession),
    context: input.context ?? { projectId: "project-1", recordingId: null },
    persisted: [] as FluxIQSession[],
    commands: [] as Array<{ payload: ServerCommandPayload; messageId: string }>,
    errors: [] as string[]
  };
  let markReady: () => void = () => undefined;
  const ready = new Promise<void>((resolve) => {
    markReady = resolve;
  });
  const deps: GatewaySessionDeps = {
    settings: () => PERSON_SETTINGS,
    effectiveSettings: () => effectiveSettings(PERSON_SETTINGS, input.policy ?? AUTOMATION_STUDIO_DEFAULT_RECORDING_CAPTURE_POLICY),
    session: () => state.session,
    persistSession: async (session) => {
      state.persisted.push(session);
      state.session = session;
    },
    emitStatus: () => undefined,
    reportError: (message) => void state.errors.push(message),
    clearError: () => undefined,
    beforeConnect: async () => undefined,
    outbox,
    queueContext: () => state.context,
    mintLineage: () => "lineage-minted",
    handlers: {
      onServerMessage: () => undefined,
      onPairingRequired: () => undefined,
      onSessionReady: () => markReady(),
      onCommand: (payload, messageId) => void state.commands.push({ payload, messageId }),
      onHeartbeat: () => undefined,
      ...(input.keepAlive !== undefined ? { keepAlive: input.keepAlive } : {}),
      ...(input.onQueueLoss !== undefined ? { onQueueLoss: input.onQueueLoss } : {})
    }
  };
  return { session: new GatewaySession(deps), outbox, store, state, ready };
}

/** Runs with the fake socket as the global WebSocket and the one `chrome` read the hello makes (its manifest version). */
async function withSocket<T>(run: () => Promise<T>): Promise<T> {
  const holder = globalThis as { WebSocket?: unknown; chrome?: unknown };
  const previous = { WebSocket: holder.WebSocket, chrome: holder.chrome };
  holder.WebSocket = OpeningSocket;
  holder.chrome = { runtime: { getManifest: () => ({ version: "0.0.0-test" }) } };
  try {
    return await run();
  } finally {
    holder.WebSocket = previous.WebSocket;
    holder.chrome = previous.chrome;
  }
}

/** Connects over an `OpeningSocket` (its hello is `sent[0]`) and runs `body` with it. */
async function withOpenSession(h: ReturnType<typeof harness>, body: (socket: OpeningSocket) => Promise<void>): Promise<void> {
  await withSocket(async () => {
    await h.session.connect();
    try {
      await body(OpeningSocket.latest!);
    } finally {
      h.session.closeClient();
    }
  });
}

/** The gateway accepting the session, and the extension marking it ready as `server-command-channel.ts` does. */
async function acceptSession(h: ReturnType<typeof harness>, socket: OpeningSocket): Promise<void> {
  socket.deliver("server.session_ready", { sessionId: "wire-2", token: NEXT_SYNTHETIC_TOKEN });
  await h.ready;
  h.session.markSessionReady();
}

const nextTurn = () => new Promise((resolve) => setTimeout(resolve, 0));

function bound(session: string, projectId: string | null, recordingId: string | null): ClientGatewayOutboxBinding {
  return { session, projectId, recordingId };
}

function recordingEvent(eventId: string): ClientGatewayClientMessage {
  return createClientGatewayMessage("client.recording_event", { eventId, eventType: "dom.click" });
}

// --- The hello ----------------------------------------------------------------

test("every socket opens with the extension's hello: identity, capabilities, domain, browser and capture settings", async () => {
  const h = harness({ session: { clientId: "client-1", token: SYNTHETIC_TOKEN } });
  let hello: ReturnType<OpeningSocket["messages"]>[number] | undefined;
  await withOpenSession(h, async (socket) => {
    hello = socket.messages()[0];
  });
  assert.equal(hello?.type, "client.hello");
  const payload = hello!.payload as {
    clientId: string; clientType: string; name: string; version: string; token?: string;
    capabilities: unknown[]; metadata: { domainId: string; browser: { extensionVersion: string }; settings: Record<string, boolean> };
  };
  assert.equal(payload.clientId, "client-1");
  assert.equal(payload.clientType, "extension");
  assert.equal(payload.name, "FluxIQ Browser Extension");
  assert.equal(payload.version, "0.0.0-test");
  assert.equal(payload.token, SYNTHETIC_TOKEN, "the saved token resumes the trusted client");
  assert.ok(payload.capabilities.length > 0);
  assert.equal(payload.metadata.domainId, "web-automation");
  assert.equal(payload.metadata.browser.extensionVersion, "0.0.0-test");
  assert.deepEqual(payload.metadata.settings, { captureMutations: true, captureInputValues: false, captureSnapshots: true });
});

test("the hello reports the settings under Core's policy, not the person's raw switches", async () => {
  const h = harness({ policy: {
    captureInputValues: { allowed: true, default: true },
    captureSnapshots: { allowed: false, default: true },
    captureMutations: { allowed: true, default: false },
    directRequests: { allowed: false }
  } });
  let hello: ReturnType<OpeningSocket["messages"]>[number] | undefined;
  await withOpenSession(h, async (socket) => {
    hello = socket.messages()[0];
  });
  const metadata = (hello!.payload as { metadata: { settings: Record<string, boolean> } }).metadata;
  assert.deepEqual(metadata.settings, { captureMutations: true, captureInputValues: false, captureSnapshots: false }, "a forbidden switch is reported off");
  assert.equal(PERSON_SETTINGS.captureSnapshots, true, "the person's preference is unchanged");
});

test("a hello without a saved token carries none", async () => {
  const h = harness();
  let hello: ReturnType<OpeningSocket["messages"]>[number] | undefined;
  await withOpenSession(h, async (socket) => {
    hello = socket.messages()[0];
  });
  assert.equal(Object.hasOwn(hello!.payload, "token"), false);
  assert.equal(h.session.state(), "pairing");
});

// --- The token ----------------------------------------------------------------

test("the token the gateway issues is kept in the session record, compacted, with where and when it connected", async () => {
  const h = harness({ session: { clientId: "client-1", projectId: "project-1", sessionId: undefined } });
  await withOpenSession(h, async (socket) => {
    await acceptSession(h, socket);
  });
  assert.equal(h.state.persisted.length, 1);
  const [written] = h.state.persisted;
  assert.equal(written!.token, NEXT_SYNTHETIC_TOKEN);
  assert.equal(written!.clientId, "client-1");
  assert.equal(written!.projectId, "project-1");
  assert.equal(written!.serverUrl, "ws://gateway.test");
  assert.equal(typeof written!.connectedAt, "number");
  assert.equal(Object.hasOwn(written!, "sessionId"), false, "an undefined field is not written");
});

// --- Gateway commands ---------------------------------------------------------

test("recording and snapshot commands reach the channel by name with their message id", async () => {
  const h = harness();
  await withOpenSession(h, async (socket) => {
    socket.deliver("server.start_recording", { recordingId: "rec-1", projectId: "project-1" }, "m-start");
    socket.deliver("server.capture_snapshot", { reason: "test" }, "m-snap");
    socket.deliver("server.stop_recording", { recordingId: "rec-1" }, "m-stop");
    await nextTurn();
  });
  assert.deepEqual(h.state.commands.map(({ payload, messageId }) => `${payload.command} ${messageId}`), [
    "start_recording m-start",
    "capture_snapshot m-snap",
    "stop_recording m-stop"
  ]);
  const start = h.state.commands[0]!.payload;
  assert.equal(start.command === "start_recording" ? start.recordingId : undefined, "rec-1");
});

test("an action of an unknown type is answered as rejected and never reaches the channel", async () => {
  const h = harness({ session: { clientId: "client-1", token: SYNTHETIC_TOKEN } });
  let sent: ReturnType<OpeningSocket["messages"]> = [];
  await withOpenSession(h, async (socket) => {
    await acceptSession(h, socket);
    socket.deliver("server.execute_action", { commandId: "cmd-unknown", actionType: "web.not.a.thing", parameters: {} }, "m-1");
    await nextTurn();
    sent = socket.messages().slice(1);
  });
  assert.deepEqual(h.state.commands, []);
  assert.equal(sent.length, 1);
  assert.equal(sent[0]!.type, "client.action_result");
  assert.equal(sent[0]!.payload.commandId, "cmd-unknown");
  assert.notEqual(sent[0]!.payload.status, "succeeded");
});

// Core writes nothing to a socket before `server.session_ready` (the old
// extension session sent over any open socket): a rejection answered while the
// gateway is still checking the token waits in the queue and goes out with the
// flush once the session is ready.
test("a rejection answered before the session is ready is queued, not written to the socket, and flushed once it is", async () => {
  const h = harness({ session: { clientId: "client-1", token: SYNTHETIC_TOKEN } });
  await h.outbox.setLineage("lineage-1");
  let beforeReady: string[] = [];
  let afterFlush: string[] = [];
  await withOpenSession(h, async (socket) => {
    socket.deliver("server.execute_action", { commandId: "cmd-early", actionType: "web.not.a.thing", parameters: {} }, "m-1");
    await nextTurn();
    beforeReady = socket.messages().map(({ type }) => type);
    await acceptSession(h, socket);
    await h.session.flushQueue();
    afterFlush = socket.messages().map(({ type }) => type);
  });
  assert.deepEqual(beforeReady, ["client.hello"]);
  assert.deepEqual(afterFlush, ["client.hello", "client.action_result"]);
});

// --- What the extension hands Core ---------------------------------------------

test("a message sent while offline is queued under the extension's project, recording and client id, and flushed after a token resume", async () => {
  const h = harness({ session: { clientId: "client-1", token: SYNTHETIC_TOKEN }, context: { projectId: "project-1", recordingId: "rec-1" } });
  await h.outbox.setLineage("lineage-1");
  await h.session.send("client.recording_event", { eventId: "event-offline", eventType: "dom.click" });
  const [entry] = (await h.store.read()).entries;
  assert.deepEqual(entry!.binding, bound("lineage-1", "project-1", "rec-1"));
  assert.equal(entry!.message.clientId, "client-1");
  assert.equal(h.session.statusFields().queueSize, 1);
  let sent: ReturnType<OpeningSocket["messages"]> = [];
  await withOpenSession(h, async (socket) => {
    await acceptSession(h, socket);
    await h.session.flushQueue();
    sent = socket.messages().slice(1);
  });
  assert.deepEqual(sent.map(({ type, payload }) => `${type} ${String(payload.eventId)}`), ["client.recording_event event-offline"]);
  assert.equal(h.session.statusFields().queueSize, 0);
});

test("a flush sends FluxIQ the outbox's loss marker before the queued messages, then tells the extension", async () => {
  // A limit of one entry: the second message queued drops the first.
  const outbox = new ClientGatewayOutbox(clientGatewayMemoryOutboxStore(), { limit: 1 });
  await outbox.setLineage("lineage-1");
  await outbox.enqueue(recordingEvent("event-dropped"), bound("lineage-1", "project-1", null));
  await outbox.enqueue(recordingEvent("event-kept"), bound("lineage-1", "project-1", null));
  const losses: number[] = [];
  const h = harness({ session: { clientId: "client-1", token: SYNTHETIC_TOKEN }, outbox, onQueueLoss: (loss) => losses.push(loss.count) });
  let sent: ReturnType<OpeningSocket["messages"]> = [];
  await withOpenSession(h, async (socket) => {
    await acceptSession(h, socket);
    await h.session.flushQueue();
    sent = socket.messages().slice(1);
  });
  assert.deepEqual(sent.map(({ type, payload }) => `${type} ${String(payload.code ?? payload.eventId)}`), [
    "client.error client.outbox.entries_lost",
    "client.recording_event event-kept"
  ]);
  assert.deepEqual(losses, [1]);
  assert.equal(await outbox.lost(), undefined);
});

// t706: Chrome's MV3 idle rule stopped the service worker about 30 s after the
// pairing code showed. The extension's keep-alive must reach Core's tick, at the
// extension's interval, for as long as a person takes to approve.
test("while a person approves pairing, the extension's keep-alive runs on every heartbeat interval", async () => {
  const ticks: string[] = [];
  const h = harness({ keepAlive: () => ticks.push("keepAlive") });
  mock.timers.enable({ apis: ["setInterval"] });
  try {
    await withOpenSession(h, async () => {
      assert.equal(h.session.state(), "pairing");
      mock.timers.tick(HEARTBEAT_INTERVAL_MS * 15);
    });
  } finally {
    mock.timers.reset();
  }
  assert.deepEqual(ticks, Array(15).fill("keepAlive"));
});
