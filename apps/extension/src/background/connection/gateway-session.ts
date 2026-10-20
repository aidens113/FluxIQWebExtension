// The client-gateway WebSocket session: opening it, keeping it alive,
// reconnecting with backoff when it drops, and queueing outgoing messages while
// it is down, each bound to the trust lineage, project and recording it was
// queued under (Core's `ClientGatewayOutbox`). This is the seam reliability work lands on — extension reconnect,
// runtime reconnect, tab closure, network failure all pass through here.
//
// It owns the socket and everything that describes the socket's health. It owns
// no recording state: what happens to a recording when the socket drops is the
// caller's decision, reached through the handlers below.

import {
  clientGatewayLineageAfterReady,
  clientGatewayOutboxBinding,
  createClientGatewayMessage,
  FluxIQClientGatewayOpenError,
  FluxIQClientGatewayWebSocketClient,
  type ClientGatewayOutbox,
  type ClientGatewayOutboxContext,
  type ClientGatewayOutboxLoss
} from "@fluxiq/client-gateway-websocket";
import { WEB_AUTOMATION_DOMAIN_ID } from "@fluxiq-web-extension/domain/client";
import { HEARTBEAT_INTERVAL_MS, RECONNECT_BASE_DELAY_MS, RECONNECT_MAX_DELAY_MS } from "../../shared/constants";
import { browserDescriptor } from "../../shared/browser";
import {
  browserExtensionCapabilities,
  type ClientGatewayActionResult,
  type ClientGatewayClientHello,
  type ClientGatewayClientMessage,
  type ClientGatewayServerMessage,
  type ConnectionState,
  type FluxIQSession,
  type FluxIQSettings,
  type JsonObject,
  type ServerCommandPayload
} from "../../shared/protocol";
import { webAutomationFactCheckFromGatewayCommand } from "@fluxiq-web-extension/domain/client";
import { browserActionFromGatewayCommand, gatewayActionResultFromRejection, isWebAutomationActionRejection } from "../../runtime";
import { compactObject } from "./value-readers";

type SessionReadyMessage = Extract<ClientGatewayServerMessage, { type: "server.session_ready" }>;

// Sends one client message to the gateway. Named so collaborators that only
// need to send share this exact signature rather than restating it.
export type GatewayMessageSender = <TType extends ClientGatewayClientMessage["type"]>(
  type: TType,
  payload: Extract<ClientGatewayClientMessage, { type: TType }>["payload"]
) => Promise<void>;

export type GatewaySessionDeps = {
  readonly settings: () => FluxIQSettings;
  readonly session: () => FluxIQSession;
  // Replaces the caller's session record and persists it. Called when the
  // gateway issues or clears a token.
  readonly persistSession: (session: FluxIQSession) => Promise<void>;
  readonly emitStatus: () => void;
  // Reported connection failures. The caller owns the message the panel shows.
  readonly reportError: (message: string) => void;
  readonly clearError: () => void;
  // Run before a socket is opened, so the session starts against a current
  // view of the active tab.
  readonly beforeConnect: () => Promise<void>;
  // The offline queue a message falls back to when the socket is down, kept
  // for the browser session (`outbox/store.ts`). Supplied by the caller so this
  // module does not reach into extension storage itself.
  readonly outbox: ClientGatewayOutbox;
  // The project and recording the client is in now: what a queued message is
  // bound to, and what a flush delivers to.
  readonly queueContext: () => ClientGatewayOutboxContext;
  // A new trust lineage id, for a socket that had to pair. Tests fix it.
  readonly mintLineage?: () => string;
  readonly handlers: GatewaySessionHandlers;
  // How long a socket is given to open. Omitted in the extension, which takes
  // Core's `CLIENT_GATEWAY_OPEN_TIMEOUT_MS`; tests shorten it.
  readonly openTimeoutMs?: number;
};

export type GatewaySessionHandlers = {
  readonly onServerMessage: (message: ClientGatewayServerMessage) => void;
  readonly onPairingRequired: (referenceCode: string | undefined, reason: string) => void;
  readonly onSessionReady: (message: SessionReadyMessage) => void;
  readonly onCommand: (payload: ServerCommandPayload, messageId: string) => void;
  // Fired on every heartbeat tick while the session is connected.
  readonly onHeartbeat: () => void;
  // Fired on every heartbeat tick while the socket is open but not yet
  // connected (`pairing`, `connecting`): nothing crosses the socket then, so the
  // extension resets the service worker's idle timer here, or Chrome stops it
  // about 30 s in, long before a person has had time to approve (t706). Not a
  // gateway message: an unpaired session may not send client data.
  readonly keepAlive?: () => void;
  // After a flush that sent FluxIQ the outbox's loss marker: how many queued
  // messages were dropped before they could be sent, and why (count cap, byte
  // budget, a refused storage write). The caller tells the person.
  readonly onQueueLoss?: (loss: ClientGatewayOutboxLoss) => void;
};

// The connection-health fields the extension status carries.
export type GatewayStatusFields = {
  connectionState: ConnectionState;
  queueSize: number;
  lastMessageAt: number | undefined;
  pairingReferenceCode: string | undefined;
};

export class GatewaySession {
  private client: FluxIQClientGatewayWebSocketClient | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private reconnectAttempt = 0;
  private connectionState: ConnectionState = "disconnected";
  private lastMessageAt: number | undefined;
  private pairingReferenceCode: string | undefined;
  private queueSize = 0;
  private shouldStayConnected = false;
  // The trust lineage the last ready socket ended in, once this worker has
  // seen or read one. Not the wire `sessionId`, which Core mints per socket.
  private lineage: string | undefined;

  constructor(private readonly deps: GatewaySessionDeps) {}

  state(): ConnectionState {
    return this.connectionState;
  }

  statusFields(): GatewayStatusFields {
    return {
      connectionState: this.connectionState,
      queueSize: this.queueSize,
      lastMessageAt: this.lastMessageAt,
      pairingReferenceCode: this.pairingReferenceCode
    };
  }

  async connect(): Promise<void> {
    this.shouldStayConnected = true;
    this.clearReconnect();
    this.setState("connecting");
    await this.deps.beforeConnect();
    await this.client?.close();
    const hello = this.clientHello();
    const client = new FluxIQClientGatewayWebSocketClient({
      url: this.deps.settings().gatewayUrl,
      client: hello,
      WebSocketImpl: WebSocket as never,
      ...(this.deps.openTimeoutMs !== undefined ? { openTimeoutMs: this.deps.openTimeoutMs } : {}),
      tokenStorage: {
        read: () => this.deps.session().token,
        write: async (token) => {
          const session = this.deps.session();
          await this.deps.persistSession(compactObject({
            ...session,
            token,
            serverUrl: this.deps.settings().gatewayUrl,
            connectedAt: Date.now()
          }));
        },
        clear: async () => {
          const session = this.deps.session();
          await this.deps.persistSession(compactObject({
            clientId: session.clientId,
            sessionId: session.sessionId,
            projectId: session.projectId,
            serverUrl: this.deps.settings().gatewayUrl,
            connectedAt: session.connectedAt
          }));
        }
      }
    });
    this.client = client;
    this.attachClientHandlers(client, Boolean(hello.token));
    try {
      await client.connect();
    } catch (error) {
      // An attempt a newer connect() replaced -- a second Connect, a reconnect --
      // owns nothing any more: failing here would mark the live attempt failed
      // and schedule a reconnect that closes its socket.
      if (this.client !== client) return;
      this.fail(connectFailureMessage(error));
      if (this.shouldStayConnected && this.deps.settings().autoReconnect) this.scheduleReconnect();
    }
  }

  // Stops the session reconnecting on its own. Separate from closing the socket
  // so a caller can tear down in its own order.
  stopReconnecting(): void {
    this.shouldStayConnected = false;
    this.clearReconnect();
  }

  /**
   * Tries again at once when the session is waiting out a backoff, or failed
   * while it still wants to be connected, and starts the backoff over. For the
   * moments something says the way to FluxIQ may be open again -- the network
   * came back, a wake-up alarm fired -- so a person does not wait up to
   * `RECONNECT_MAX_DELAY_MS` for a retry already due. A session the person
   * disconnected, or one already connecting or connected, is left alone.
   */
  retryNow(): boolean {
    if (!this.shouldStayConnected) return false;
    if (this.connectionState !== "reconnecting" && this.connectionState !== "error") return false;
    this.reconnectAttempt = 0;
    this.connect().catch((error: unknown) => {
      this.fail(error instanceof Error ? error.message : "WebSocket connection failed.");
    });
    return true;
  }

  /** The session was asked to connect and has not been told to stop. */
  wantsConnection(): boolean {
    return this.shouldStayConnected;
  }

  closeClient(): void {
    this.stopHeartbeat();
    void this.client?.close();
    this.client = null;
  }

  markDisconnected(): void {
    this.setState("disconnected");
  }

  markSessionReady(): void {
    this.pairingReferenceCode = undefined;
    this.setState("connected");
  }

  markFailed(): void {
    this.setState("error");
  }

  noteMessageReceived(): void {
    this.lastMessageAt = Date.now();
  }

  // Sends over the open socket, or queues the message under its binding so it
  // survives a service-worker restart and is flushed on the next session that
  // is still in the same lineage, project and recording.
  readonly send: GatewayMessageSender = async (type, payload) => {
    if (this.client?.connected) {
      await (this.client.send as (messageType: ClientGatewayClientMessage["type"], messagePayload: unknown) => Promise<unknown>)(type, payload);
      return;
    }
    const context = this.deps.queueContext();
    const session = this.deps.session();
    const message = (createClientGatewayMessage as (
      messageType: ClientGatewayClientMessage["type"],
      messagePayload: unknown,
      options: { clientId?: string; sessionId?: string }
    ) => ClientGatewayClientMessage)(type, payload, {
      clientId: session.clientId,
      ...(session.sessionId !== undefined ? { sessionId: session.sessionId } : {})
    });
    this.queueSize = await this.deps.outbox.enqueue(message, clientGatewayOutboxBinding(message, await this.currentLineage(), context));
    this.deps.emitStatus();
  };

  /**
   * The result the offline queue holds for a command id, when it holds one: a
   * command whose result was queued while the socket was down is answered with
   * it, never run again (`in-flight/command-reconciliation.ts`, plan B3).
   *
   * Only a result queued under the current lineage answers: one queued under
   * an earlier trust is never delivered, so it cannot answer either.
   *
   * The wire lets a client report `interrupted` (Core's contract, C8); this
   * extension still reports a leftover as `unknown` or `failed` with the
   * payload marker, so a queued `interrupted` is read as `unknown`: never as
   * "did not act" (`ClientGatewayOutbox.actionResult`).
   */
  async queuedActionResult(commandId: string): Promise<ClientGatewayActionResult | undefined> {
    return await this.deps.outbox.actionResult(commandId, await this.currentLineage());
  }

  /**
   * Delivers, in queue order, what was queued under the current lineage and
   * project for no recording, the current recording, or a recording that ended
   * while the socket was down, and drops everything else
   * (`clientGatewayOutboxDeliverable`). A send failing mid-flush keeps the
   * undelivered tail and rethrows.
   */
  async flushQueue(): Promise<void> {
    const client = this.client;
    if (!client?.connected) return;
    const current = { session: await this.currentLineage(), ...this.deps.queueContext() };
    const send = client.send as (messageType: ClientGatewayClientMessage["type"], messagePayload: unknown) => Promise<unknown>;
    try {
      // A loss the outbox recorded goes to FluxIQ first, as one marker, and
      // then to the person: dropped messages are never dropped silently.
      const { lost } = await this.deps.outbox.flush(current, async (message) => await send.call(client, message.type, message.payload));
      if (lost) this.deps.handlers.onQueueLoss?.(lost);
    } finally {
      await this.refreshQueueSize();
    }
  }

  /** Removes the queued recording events sent under `eventId` (a step removed before it was sent), and answers how many there were. */
  async removeQueuedRecordingEvent(eventId: string): Promise<number> {
    const removed = await this.deps.outbox.removeRecordingEvent(eventId);
    if (removed > 0) await this.refreshQueueSize();
    return removed;
  }

  /**
   * Reads the queue size from the stored queue, which outlives this worker,
   * and publishes it when it changed. A restarted worker starts at zero.
   */
  async refreshQueueSize(): Promise<number> {
    const size = await this.deps.outbox.size();
    if (size !== this.queueSize) {
      this.queueSize = size;
      this.deps.emitStatus();
    }
    return size;
  }

  // The lineage queued messages are bound to now: the one this worker last
  // decided, else the stored one, else none yet ("", which no ready socket
  // ever ends in).
  private async currentLineage(): Promise<string> {
    this.lineage ??= await this.deps.outbox.lineage();
    return this.lineage ?? "";
  }

  // Decided on `server.session_ready`, before the caller hears of it: a socket
  // whose hello carried a token and that was not asked to pair resumed the same
  // trusted client, so it keeps the stored lineage; any other starts a new one,
  // and nothing queued under the old trust is delivered to the new.
  private async adoptLineage(resumed: boolean): Promise<void> {
    const mint = this.deps.mintLineage ?? (() => globalThis.crypto.randomUUID());
    let stored: string | undefined;
    try {
      stored = await this.deps.outbox.lineage();
    } catch (error) {
      // Unreadable: a fresh lineage in memory, so nothing queued is delivered to a trust it may not belong to.
      this.lineage = mint();
      throw error;
    }
    const next = clientGatewayLineageAfterReady({ stored, resumed, mint });
    this.lineage = next;
    if (next !== stored) await this.deps.outbox.setLineage(next);
  }

  // Reaching `connected` ends whatever went wrong before it: a failed socket, a
  // wait for approval, a refused reconnect. An error that outlived the
  // connection it described would sit under a green "Connected" and read as
  // current, so it is cleared on every transition into `connected`.
  private setState(state: ConnectionState): void {
    this.connectionState = state;
    if (state === "connected") this.deps.clearError();
    this.deps.emitStatus();
  }

  private onOpen(): void {
    this.reconnectAttempt = 0;
    this.deps.clearError();
    this.setState(this.deps.session().token ? "connecting" : "pairing");
    this.startHeartbeat();
  }

  private onClose(): void {
    this.stopHeartbeat();
    this.client = null;
    if (this.shouldStayConnected && this.deps.settings().autoReconnect) {
      this.scheduleReconnect();
    } else {
      this.setState("disconnected");
    }
  }

  private fail(message: string): void {
    this.deps.reportError(message);
    this.setState("error");
  }

  private clientHello(): Omit<ClientGatewayClientHello, "token"> & { token?: string } {
    const session = this.deps.session();
    const settings = this.deps.settings();
    return {
      clientId: session.clientId,
      clientType: "extension",
      name: "FluxIQ Browser Extension",
      version: browserDescriptor().extensionVersion,
      ...(session.token !== undefined ? { token: session.token } : {}),
      capabilities: browserExtensionCapabilities,
      metadata: {
        domainId: WEB_AUTOMATION_DOMAIN_ID,
        browser: browserDescriptor() as unknown as JsonObject,
        settings: {
          captureMutations: settings.captureMutations,
          captureInputValues: settings.captureInputValues,
          captureSnapshots: settings.captureSnapshots
        }
      }
    };
  }

  private attachClientHandlers(client: FluxIQClientGatewayWebSocketClient, helloCarriedToken: boolean): void {
    const handlers = this.deps.handlers;
    // Whether this socket resumed the trusted client: its hello carried a token
    // and FluxIQ did not ask it to pair (`adoptLineage`).
    let pairingAsked = false;
    client.on("open", () => this.onOpen());
    client.on("close", () => this.onClose());
    client.on("error", () => this.fail("WebSocket connection failed."));
    client.on("message", ({ message }) => handlers.onServerMessage(message));
    client.on("pairing_required", ({ message }) => {
      pairingAsked = true;
      this.pairingReferenceCode = message.payload.referenceCode;
      this.setState("pairing");
      handlers.onPairingRequired(this.pairingReferenceCode, message.payload.reason);
    });
    client.on("session_ready", ({ message }) => {
      // The session is reported ready even when the lineage could not be
      // stored: the queue is then judged against the lineage held in memory.
      void this.adoptLineage(helloCarriedToken && !pairingAsked)
        .catch((error: unknown) => this.deps.reportError(error instanceof Error ? error.message : "Could not store the offline queue's lineage."))
        .then(() => handlers.onSessionReady(message));
    });
    client.on("start_recording", ({ message }) => handlers.onCommand({ ...message.payload, command: "start_recording" }, message.id));
    client.on("stop_recording", ({ message }) => handlers.onCommand({ ...message.payload, command: "stop_recording" }, message.id));
    client.on("capture_snapshot", ({ message }) => handlers.onCommand({ ...message.payload, command: "capture_snapshot" }, message.id));
    client.on("execute_action", ({ message }) => {
      // A fact check is not a web action: it is answered by its own route
      // (`runtime/fact-check-runner.ts`), or refused here when unreadable.
      const facts = webAutomationFactCheckFromGatewayCommand(message.payload);
      if (facts !== undefined) {
        if (isWebAutomationActionRejection(facts)) {
          void this.send("client.action_result", gatewayActionResultFromRejection(facts)).catch((error: unknown) => {
            this.deps.reportError(error instanceof Error ? error.message : "Could not report a rejected fact check.");
          });
          return;
        }
        handlers.onCommand(withLease({ command: "evaluate_facts", check: facts }, message.payload.lease), message.id);
        return;
      }
      const action = browserActionFromGatewayCommand(message.payload);
      // An unknown action type is answered here; nothing is dispatched to the page.
      if (isWebAutomationActionRejection(action)) {
        void this.send("client.action_result", gatewayActionResultFromRejection(action)).catch((error: unknown) => {
          this.deps.reportError(error instanceof Error ? error.message : "Could not report a rejected action.");
        });
        return;
      }
      // The lease rides beside the mapped action, which keeps only the fields it knows.
      handlers.onCommand(withLease({ command: "execute_action", action }, message.payload.lease), message.id);
    });
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.connectionState === "connected") this.deps.handlers.onHeartbeat();
      else if (this.connectionState === "pairing" || this.connectionState === "connecting") this.deps.handlers.keepAlive?.();
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = undefined;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.setState("reconnecting");
    const delay = Math.min(RECONNECT_MAX_DELAY_MS, RECONNECT_BASE_DELAY_MS * 2 ** this.reconnectAttempt);
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => void this.connect(), delay);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
  }
}

/** The command with the host lease it came under, when it came under one; the channel checks it (`server-command-channel.ts`). */
function withLease<TCommand extends Extract<ServerCommandPayload, { command: "execute_action" | "evaluate_facts" }>>(command: TCommand, lease: TCommand["lease"]): TCommand {
  return lease === undefined ? command : { ...command, lease };
}

// What a person, and the Lab, read in `lastError` when a socket never opened:
// the reason by name, so a connect that used to hang now says which way it ended.
function connectFailureMessage(error: unknown): string {
  if (!(error instanceof FluxIQClientGatewayOpenError)) return "WebSocket connection failed.";
  if (error.code === "open_timeout") return `FluxIQ did not open the connection within ${Math.max(1, Math.round((error.timeoutMs ?? 0) / 1000))} s (open_timeout).`;
  if (error.code === "closed_before_open") return "FluxIQ closed the connection before it opened (closed_before_open).";
  return "FluxIQ refused or dropped the connection before it opened (open_failed).";
}
