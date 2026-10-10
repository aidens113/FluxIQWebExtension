// The client-gateway WebSocket session: opening it, keeping it alive,
// reconnecting with backoff when it drops, and queueing outgoing messages while
// it is down. This is the seam reliability work lands on — extension reconnect,
// runtime reconnect, tab closure, network failure all pass through here.
//
// It owns the socket and everything that describes the socket's health. It owns
// no recording state: what happens to a recording when the socket drops is the
// caller's decision, reached through the handlers below.

import {
  createClientGatewayMessage,
  FluxIQClientGatewayOpenError,
  FluxIQClientGatewayWebSocketClient
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

// The persisted queue a message falls back to when the socket is down. Supplied
// by the caller so this module does not reach into extension storage itself.
export type GatewayEventQueue = {
  readonly queueEvent: (message: ClientGatewayClientMessage) => Promise<number>;
  readonly readQueuedEvents: () => Promise<ClientGatewayClientMessage[]>;
  readonly clearQueuedEvents: () => Promise<void>;
};

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
  readonly queue: GatewayEventQueue;
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
    const client = new FluxIQClientGatewayWebSocketClient({
      url: this.deps.settings().gatewayUrl,
      client: this.clientHello(),
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
    this.attachClientHandlers(client);
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

  // Sends over the open socket, or persists the message to the offline queue so
  // it survives a service-worker restart and is flushed on the next session.
  readonly send: GatewayMessageSender = async (type, payload) => {
    if (this.client?.connected) {
      await (this.client.send as (messageType: ClientGatewayClientMessage["type"], messagePayload: unknown) => Promise<unknown>)(type, payload);
      return;
    }
    const session = this.deps.session();
    const message = (createClientGatewayMessage as (
      messageType: ClientGatewayClientMessage["type"],
      messagePayload: unknown,
      options: { clientId?: string; sessionId?: string }
    ) => ClientGatewayClientMessage)(type, payload, {
      clientId: session.clientId,
      ...(session.sessionId !== undefined ? { sessionId: session.sessionId } : {})
    });
    this.queueSize = await this.deps.queue.queueEvent(message);
    this.deps.emitStatus();
  };

  /**
   * The result the offline queue holds for a command id, when it holds one: a
   * command whose result was queued while the socket was down is answered with
   * it, never run again (`in-flight/command-reconciliation.ts`, plan B3).
   */
  async queuedActionResult(commandId: string): Promise<ClientGatewayActionResult | undefined> {
    const queued = await this.deps.queue.readQueuedEvents();
    for (const message of queued) {
      if (message.type === "client.action_result" && message.payload.commandId === commandId) return message.payload;
    }
    return undefined;
  }

  async flushQueue(): Promise<void> {
    if (!this.client?.connected) return;
    const queued = await this.deps.queue.readQueuedEvents();
    for (const message of queued) {
      await (this.client.send as (messageType: ClientGatewayClientMessage["type"], messagePayload: unknown) => Promise<unknown>)(message.type, message.payload);
    }
    await this.deps.queue.clearQueuedEvents();
    this.queueSize = 0;
    this.deps.emitStatus();
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

  private attachClientHandlers(client: FluxIQClientGatewayWebSocketClient): void {
    const handlers = this.deps.handlers;
    client.on("open", () => this.onOpen());
    client.on("close", () => this.onClose());
    client.on("error", () => this.fail("WebSocket connection failed."));
    client.on("message", ({ message }) => handlers.onServerMessage(message));
    client.on("pairing_required", ({ message }) => {
      this.pairingReferenceCode = message.payload.referenceCode;
      this.setState("pairing");
      handlers.onPairingRequired(this.pairingReferenceCode, message.payload.reason);
    });
    client.on("session_ready", ({ message }) => handlers.onSessionReady(message));
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
        handlers.onCommand({ command: "evaluate_facts", check: facts }, message.id);
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
      handlers.onCommand({ command: "execute_action", action }, message.id);
    });
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.connectionState === "connected") this.deps.handlers.onHeartbeat();
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

// What a person, and the Lab, read in `lastError` when a socket never opened:
// the reason by name, so a connect that used to hang now says which way it ended.
function connectFailureMessage(error: unknown): string {
  if (!(error instanceof FluxIQClientGatewayOpenError)) return "WebSocket connection failed.";
  if (error.code === "open_timeout") return `FluxIQ did not open the connection within ${Math.max(1, Math.round((error.timeoutMs ?? 0) / 1000))} s (open_timeout).`;
  if (error.code === "closed_before_open") return "FluxIQ closed the connection before it opened (closed_before_open).";
  return "FluxIQ refused or dropped the connection before it opened (open_failed).";
}
