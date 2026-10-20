// The extension's client-gateway session: the web adapter over Core's
// reconnecting connection (`FluxIQClientGatewayConnection`). Core owns the
// socket, its state, the reconnect backoff, the heartbeat and keep-alive ticks,
// the trust lineage, the offline queue's binding and flush, the loss hand-off
// and the wording of a socket that never opened. Core also writes nothing to a
// socket until `server.session_ready`: a socket still pairing, or whose token
// the gateway is still checking, queues instead. This file supplies what only
// the extension knows: the hello it opens each socket with, where the gateway
// token is kept (the session record, compacted on every write), the extension's
// timing, and how a gateway command becomes a command the server command
// channel runs (`server-command-channel.ts`).
//
// It is a subclass rather than a wrapper so the connection's whole public
// surface -- `send`, `connect`, `flushQueue`, `statusFields` and the rest -- is
// the session's without a delegating method for each.

import {
  FluxIQClientGatewayConnection,
  type ClientGatewayConnectionHandlers,
  type ClientGatewayConnectionHello,
  type ClientGatewayConnectionSender,
  type ClientGatewayConnectionStatus,
  type ClientGatewayConnectionTokenStorage,
  type ClientGatewayOutbox,
  type ClientGatewayOutboxContext
} from "@fluxiq/client-gateway-websocket";
import { WEB_AUTOMATION_DOMAIN_ID, webAutomationFactCheckFromGatewayCommand } from "@fluxiq-web-extension/domain/client";
import { HEARTBEAT_INTERVAL_MS, RECONNECT_BASE_DELAY_MS, RECONNECT_MAX_DELAY_MS } from "../../shared/constants";
import { browserDescriptor } from "../../shared/browser";
import {
  browserExtensionCapabilities,
  type ClientGatewayActionResult,
  type ClientGatewayServerMessage,
  type FluxIQSession,
  type FluxIQSettings,
  type JsonObject,
  type ServerCommandPayload
} from "../../shared/protocol";
import { browserActionFromGatewayCommand, gatewayActionResultFromRejection, isWebAutomationActionRejection } from "../../runtime";
import { compactObject } from "./value-readers";

// Sends one client message to the gateway, or queues it while the session is
// not ready. Named so collaborators that only need to send share this exact
// signature rather than restating it.
export type GatewayMessageSender = ClientGatewayConnectionSender;

// The connection-health fields the extension status carries.
export type GatewayStatusFields = ClientGatewayConnectionStatus;

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
  // The offline queue a message falls back to while the session is not ready,
  // kept for the browser session (`outbox/store.ts`). Supplied by the caller so
  // this module does not reach into extension storage itself.
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

// Core's connection handlers (server messages, pairing, session ready, the
// heartbeat, the MV3 keep-alive while a person approves, a reported queue
// loss), plus the command the extension mapped from a gateway command.
export type GatewaySessionHandlers = ClientGatewayConnectionHandlers & {
  readonly onCommand: (payload: ServerCommandPayload, messageId: string) => void;
};

type ExecuteActionMessage = Extract<ClientGatewayServerMessage, { type: "server.execute_action" }>;

export class GatewaySession extends FluxIQClientGatewayConnection {
  private readonly deps: GatewaySessionDeps;

  constructor(deps: GatewaySessionDeps) {
    super({
      url: () => deps.settings().gatewayUrl,
      hello: () => extensionHello(deps.session(), deps.settings()),
      tokenStorage: sessionTokenStorage(deps),
      ...(deps.openTimeoutMs !== undefined ? { openTimeoutMs: deps.openTimeoutMs } : {}),
      autoReconnect: () => deps.settings().autoReconnect,
      reconnectBaseDelayMs: RECONNECT_BASE_DELAY_MS,
      reconnectMaxDelayMs: RECONNECT_MAX_DELAY_MS,
      heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
      outbox: deps.outbox,
      context: deps.queueContext,
      clientId: () => deps.session().clientId,
      ...(deps.mintLineage !== undefined ? { mintLineage: deps.mintLineage } : {}),
      beforeConnect: deps.beforeConnect,
      emitStatus: deps.emitStatus,
      reportError: deps.reportError,
      clearError: deps.clearError,
      handlers: deps.handlers
    });
    this.deps = deps;
    const { onCommand } = deps.handlers;
    this.on("start_recording", ({ message }) => onCommand({ ...message.payload, command: "start_recording" }, message.id));
    this.on("stop_recording", ({ message }) => onCommand({ ...message.payload, command: "stop_recording" }, message.id));
    this.on("capture_snapshot", ({ message }) => onCommand({ ...message.payload, command: "capture_snapshot" }, message.id));
    this.on("execute_action", ({ message }) => this.mapExecuteAction(message));
  }

  // A gateway action becomes a fact check or a browser action for the channel,
  // or is answered here when it cannot be read: nothing is dispatched to the page.
  private mapExecuteAction(message: ExecuteActionMessage): void {
    const { onCommand } = this.deps.handlers;
    // A fact check is not a web action: it is answered by its own route
    // (`runtime/fact-check-runner.ts`), or refused here when unreadable.
    const facts = webAutomationFactCheckFromGatewayCommand(message.payload);
    if (facts !== undefined) {
      if (isWebAutomationActionRejection(facts)) {
        this.reportRejection(gatewayActionResultFromRejection(facts), "Could not report a rejected fact check.");
        return;
      }
      onCommand(withLease({ command: "evaluate_facts", check: facts }, message.payload.lease), message.id);
      return;
    }
    const action = browserActionFromGatewayCommand(message.payload);
    if (isWebAutomationActionRejection(action)) {
      this.reportRejection(gatewayActionResultFromRejection(action), "Could not report a rejected action.");
      return;
    }
    // The lease rides beside the mapped action, which keeps only the fields it knows.
    onCommand(withLease({ command: "execute_action", action }, message.payload.lease), message.id);
  }

  private reportRejection(result: ClientGatewayActionResult, fallback: string): void {
    void this.send("client.action_result", result).catch((error: unknown) => {
      this.deps.reportError(error instanceof Error ? error.message : fallback);
    });
  }
}

// What every socket opens with: who this client is, what it can do, which
// domain it serves and what it captures. The token, when the session holds one.
function extensionHello(session: FluxIQSession, settings: FluxIQSettings): ClientGatewayConnectionHello {
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

// The gateway token lives in the session record, which the caller persists. A
// write keeps the rest of the record and notes where and when it connected; a
// clear keeps only what identifies the client, its session and its project.
function sessionTokenStorage(deps: GatewaySessionDeps): ClientGatewayConnectionTokenStorage {
  return {
    read: () => deps.session().token,
    write: async (token) => {
      await deps.persistSession(compactObject({
        ...deps.session(),
        token,
        serverUrl: deps.settings().gatewayUrl,
        connectedAt: Date.now()
      }));
    },
    clear: async () => {
      const session = deps.session();
      await deps.persistSession(compactObject({
        clientId: session.clientId,
        sessionId: session.sessionId,
        projectId: session.projectId,
        serverUrl: deps.settings().gatewayUrl,
        connectedAt: session.connectedAt
      }));
    }
  };
}

/** The command with the host lease it came under, when it came under one; the channel checks it (`server-command-channel.ts`). */
function withLease<TCommand extends Extract<ServerCommandPayload, { command: "execute_action" | "evaluate_facts" }>>(command: TCommand, lease: TCommand["lease"]): TCommand {
  return lease === undefined ? command : { ...command, lease };
}
