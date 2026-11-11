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
// A managed host the engine launched is enrolled instead of paired: its connect
// carries a one-time enrolment ticket, held here in memory only and handed to
// the first hello that has no token. Until that session is ready, nothing falls
// back to pairing: a refusal (`server.error` with an `enrolment.*` code) or a
// socket lost before `server.session_ready` ends the attempt in an error, and
// the launcher that holds the next ticket tries again.
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
import { browserClientLabel, browserDescriptor } from "../../shared/browser";
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

// Why the last enrolment ended without a session: Core's refusal code and
// words, or only words when the connection was lost before Core answered.
// Never the ticket.
export type GatewayEnrolmentFailure = { readonly code?: string; readonly message: string };

export type GatewaySessionDeps = {
  readonly settings: () => FluxIQSettings;
  // The settings the recorder actually uses: the person's, with Core's
  // recording-capture policy applied (`capture-policy/effective-settings.ts`).
  // The hello reports these, so the gateway hears what this client captures
  // rather than what the person asked for.
  readonly effectiveSettings: () => FluxIQSettings;
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
  private readonly enrolment: EnrolmentAttempt;

  constructor(deps: GatewaySessionDeps) {
    const enrolment = new EnrolmentAttempt();
    super({
      url: () => deps.settings().gatewayUrl,
      hello: () => extensionHello(deps.session(), deps.effectiveSettings()),
      tokenStorage: sessionTokenStorage(deps),
      // Core's transport asks only for a hello with no token, once.
      enrolment: { take: () => enrolment.take() },
      ...(deps.openTimeoutMs !== undefined ? { openTimeoutMs: deps.openTimeoutMs } : {}),
      // A reconnect during an enrolment would have no ticket and so would pair: the launcher retries instead.
      autoReconnect: () => !enrolment.pending() && deps.settings().autoReconnect,
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
    this.enrolment = enrolment;
    this.on("message", ({ message }) => this.noteEnrolmentRefusal(message));
    this.on("pairing_required", () => this.endEnrolment({ message: "FluxIQ asked this browser to pair while it was enrolling, so the attempt was ended." }));
    // Only the current socket's close: Core's handler, which runs first, leaves the connection disconnected
    // (no reconnect while enrolling). A socket this connect replaced closes later and leaves it connecting.
    this.on("close", () => {
      if (this.state() === "disconnected") this.endEnrolment({ message: "The connection to FluxIQ closed before this browser was enrolled." });
    });
    this.on("session_ready", () => this.enrolment.settle());
    const { onCommand } = deps.handlers;
    this.on("start_recording", ({ message }) => onCommand({ ...message.payload, command: "start_recording" }, message.id));
    this.on("stop_recording", ({ message }) => onCommand({ ...message.payload, command: "stop_recording" }, message.id));
    this.on("capture_snapshot", ({ message }) => onCommand({ ...message.payload, command: "capture_snapshot" }, message.id));
    this.on("execute_action", ({ message }) => this.mapExecuteAction(message));
  }

  /**
   * The next connect enrols with `ticket` instead of pairing, or, with none, is
   * an ordinary connect that forgets how the last enrolment ended. A stored
   * token is dropped first: a launcher enrols only when it did not resume, and a
   * hello carrying a token never spends its ticket.
   */
  async prepareConnect(ticket?: string): Promise<void> {
    if (ticket === undefined) {
      this.enrolment.forget();
      return;
    }
    this.enrolment.hold(ticket);
    if (this.deps.session().token !== undefined) await sessionTokenStorage(this.deps).clear?.();
  }

  /** Why the last enrolment ended without a session, until the next connect or a ready session. */
  enrolmentFailure(): GatewayEnrolmentFailure | undefined {
    return this.enrolment.failure();
  }

  private noteEnrolmentRefusal(message: ClientGatewayServerMessage): void {
    if (message.type !== "server.error" || !message.payload.code?.startsWith(ENROLMENT_REFUSAL_PREFIX)) return;
    this.endEnrolment({ code: message.payload.code, message: message.payload.message });
  }

  // Ends an enrolment still waiting for its session, and with it any reconnect:
  // the next hello would carry no ticket and pair. Nothing to do otherwise.
  private endEnrolment(failure: GatewayEnrolmentFailure): void {
    if (!this.enrolment.fail(failure)) return;
    this.stopReconnecting();
    this.closeClient();
    this.markFailed();
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
// domain it serves and what it captures under Core's recording-capture policy
// (the effective settings, never the person's raw switches). The token, when the session holds one.
function extensionHello(session: FluxIQSession, settings: FluxIQSettings): ClientGatewayConnectionHello {
  return {
    clientId: session.clientId,
    clientType: "extension",
    name: browserClientLabel(browserDescriptor().userAgent, browserDescriptor().platform),
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

/** The `server.error` codes Core refuses an enrolment ticket with (`enrolment.unknown`, `.expired`, `.used`, `.revoked`, `.domain_mismatch`). */
const ENROLMENT_REFUSAL_PREFIX = "enrolment.";

/**
 * One enrolment: the ticket, held until the first hello without a token takes
 * it, and whether the attempt still waits for its session or how it failed.
 * The ticket lives only here, in the worker's memory: never in settings,
 * storage, a status or a log.
 */
class EnrolmentAttempt {
  private ticket: string | undefined;
  private waiting = false;
  private ended: GatewayEnrolmentFailure | undefined;

  hold(ticket: string): void {
    this.ticket = ticket;
    this.waiting = true;
    this.ended = undefined;
  }

  /** The held ticket, once: a reconnect never resends it. */
  take(): string | undefined {
    const ticket = this.ticket;
    this.ticket = undefined;
    return ticket;
  }

  pending(): boolean {
    return this.waiting;
  }

  /** The session is ready: the enrolment is over, and the token it brought is stored as a pairing's is. */
  settle(): void {
    this.ticket = undefined;
    this.waiting = false;
    this.ended = undefined;
  }

  /** Records how a waiting enrolment failed; false when none was waiting. The first failure stands. */
  fail(failure: GatewayEnrolmentFailure): boolean {
    if (!this.waiting) return false;
    this.ticket = undefined;
    this.waiting = false;
    this.ended = failure;
    return true;
  }

  forget(): void {
    this.ticket = undefined;
    this.waiting = false;
    this.ended = undefined;
  }

  failure(): GatewayEnrolmentFailure | undefined {
    return this.ended;
  }
}
