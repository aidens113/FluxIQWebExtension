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
  FluxIQClientGatewayWebSocketClient
} from "@fluxiq/client-gateway-websocket";
import { WEB_AUTOMATION_DOMAIN_ID } from "@fluxiq-web-extension/domain/client";
import { HEARTBEAT_INTERVAL_MS, RECONNECT_BASE_DELAY_MS, RECONNECT_MAX_DELAY_MS } from "../../shared/constants";
import { browserDescriptor } from "../../shared/browser";
import {
  browserExtensionCapabilities,
  type ClientGatewayClientHello,
  type ClientGatewayClientMessage,
  type ClientGatewayServerMessage,
  type ConnectionState,
  type FluxIQSession,
  type FluxIQSettings,
  type JsonObject,
  type ServerCommandPayload
} from "../../shared/protocol";
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
    } catch {
      this.fail("WebSocket connection failed.");
      if (this.shouldStayConnected && this.deps.settings().autoReconnect) this.scheduleReconnect();
    }
  }

  // Stops the session reconnecting on its own. Separate from closing the socket
  // so a caller can tear down in its own order.
  stopReconnecting(): void {
    this.shouldStayConnected = false;
    this.clearReconnect();
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

  private setState(state: ConnectionState): void {
    this.connectionState = state;
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
