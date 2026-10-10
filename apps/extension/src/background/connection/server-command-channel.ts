// What FluxIQ sends the extension, and what the extension sends back: server
// messages, the commands they carry, the runtime action each command runs, and
// the result that returns down the same channel.
//
// Command and result are one job, not two. Dispatching a command opens a
// runtime status the result closes, and a succeeded action becomes a recorded
// event as well as a reply -- so the methods that start a command and the
// methods that report its outcome only make sense beside each other.

import {
  createWebAutomationRecordingEvent,
  webAutomationActionResultPayload,
  webAutomationActionVisualTargetFromElement,
  WEB_AUTOMATION_DOMAIN_ID
} from "@fluxiq-web-extension/domain/client";
import type {
  ActivityEntry,
  BrowserActionCommand,
  BrowserActionResult,
  ClientGatewayServerMessage,
  DomSnapshot,
  FluxIQSession,
  FluxIQSettings,
  JsonObject,
  RecordingEventPayload,
  RuntimeCommandStatus,
  ServerCommandPayload
} from "../../shared/protocol";
import { DEFAULT_CORE_API_URL } from "../../shared/constants";
import { allTabFrames, sendToTab } from "../tabs";
import { ExtensionRuntimeCommandRouter, gatewayActionResultFromBrowserResult } from "../../runtime";
import type { ActivePage } from "./active-page";
import type { ActiveRecording } from "./active-recording";
import type { ContentAttachment } from "./content-attachment";
import { captureMergedTabSnapshot, type DomSnapshotPayload } from "./dom-snapshot";
import type { EventSequence } from "./event-sequence";
import type { GatewayMessageSender, GatewaySession } from "./gateway-session";
import { CommandReconciliation, frameDocumentId, inFlightRecordArea, InFlightRecordStore, SeenCommandStore } from "./in-flight/index";
import type { RecordingEvidenceReporter } from "./recording-evidence";
import { classifyRecordingStartRefusal } from "./recording-start/index";
import {
  runtimeActionLabel,
  runtimeConfirmationForActionResult,
  runtimeResultTarget,
  type RuntimeStatusTracker
} from "./runtime-status";
import { compactObject } from "./value-readers";

type SessionReadyMessage = Extract<ClientGatewayServerMessage, { type: "server.session_ready" }>;

/** The id the browser always gives a tab's main frame. */
const TOP_FRAME_ID = 0;

export type ServerCommandChannelDeps = {
  readonly send: GatewayMessageSender;
  readonly gateway: GatewaySession;
  readonly recording: ActiveRecording;
  readonly page: ActivePage;
  readonly runtimeStatus: RuntimeStatusTracker;
  readonly attachment: ContentAttachment;
  readonly evidence: RecordingEvidenceReporter;
  readonly sequence: EventSequence;
  readonly session: () => FluxIQSession;
  readonly settings: () => FluxIQSettings;
  readonly persistSession: (session: FluxIQSession) => Promise<void>;
  readonly captureActionBoundary: (phase: "before" | "after", value: BrowserActionCommand | BrowserActionResult) => Promise<void>;
  readonly setLastError: (message: string | undefined) => void;
  readonly onActivity: (kind: string, label: string, detail?: string, tone?: ActivityEntry["tone"]) => void;
  readonly emitStatus: () => void;
  /** Takes a `server.activity` payload: what FluxIQ is doing now, for the panel and the overlay. */
  readonly acceptActivity: (activity: unknown) => void;
  // Re-entry through the facade for the three public paths a command can take.
  readonly recordEvent: (payload: RecordingEventPayload, tabId?: number, frameId?: number) => Promise<void>;
  readonly stopRecording: (notifyServer: boolean) => Promise<void>;
  readonly disconnect: () => void;
  /**
   * The in-flight record and the answer to a repeated command id (plan B3).
   * Absent, the channel keeps its own in the browser's session storage.
   */
  readonly reconciliation?: CommandReconciliation;
};

export class ServerCommandChannel {
  private readonly reconciliation: CommandReconciliation;

  constructor(private readonly deps: ServerCommandChannelDeps) {
    this.reconciliation = deps.reconciliation ?? ownReconciliation(deps);
  }

  async handleMessage(message: ClientGatewayServerMessage): Promise<void> {
    this.deps.gateway.noteMessageReceived();

    if (message.type === "server.ping") {
      this.deps.gateway.noteMessageReceived();
      this.deps.emitStatus();
      return;
    }

    if (message.type === "server.error") {
      this.deps.setLastError(message.payload.message);
      // A refused recording start is scoped to the recording, not to the
      // connection: the socket is healthy and marking it failed would tear
      // down a session that is working.
      const refusal = classifyRecordingStartRefusal(message.payload);
      if (refusal) {
        this.deps.recording.noteStartRefusal(refusal);
        return;
      }
      this.deps.gateway.markFailed();
      return;
    }

    // Activity is a status display, not a command: it opens no runtime status
    // and is never answered.
    if (message.type === "server.activity") {
      this.deps.acceptActivity(message.payload);
      return;
    }

    // Core asking what became of a command whose answer never reached it (Core
    // C8): answered from what this browser kept, never by running anything.
    if (message.type === "server.reconcile_command") {
      await this.answerReconcile(message.payload.commandId);
      return;
    }

    if (message.type === "server.set_active_tab") {
      await this.handleCommand({ ...message.payload, command: "set_active_tab" }, message.id);
      return;
    }
    if (message.type === "server.disconnect") {
      this.deps.disconnect();
    }
  }

  async handleSessionReady(message: SessionReadyMessage): Promise<void> {
    await this.deps.persistSession(compactObject({
      ...this.deps.session(),
      sessionId: message.payload.sessionId,
      token: message.payload.token,
      ...(message.payload.projectId !== undefined ? { projectId: message.payload.projectId } : {}),
      serverUrl: this.deps.settings().gatewayUrl,
      connectedAt: Date.now()
    }));
    // A ready session answers every earlier error, the "Approve this client in
    // FluxIQ" a pairing left behind included.
    this.deps.setLastError(undefined);
    this.deps.gateway.markSessionReady();
    this.deps.onActivity("connection", "Connected to FluxIQ", "Client session ready", "success");
    await this.deps.page.sendBrowserState();
    await this.deps.gateway.flushQueue();
    // A command an earlier worker lost while it was in flight is reported now,
    // as interrupted with its effect unknown, never left to read as a timeout (plan B3).
    await this.reconciliation.reportLeftovers().catch((error: unknown) => this.inFlightRecordFailed(error));
  }

  async handleCommand(payload: ServerCommandPayload, messageId: string): Promise<void> {
    if (payload.command === "ping") {
      this.deps.gateway.noteMessageReceived();
      this.deps.emitStatus();
      return;
    }
    if (payload.command === "disconnect") {
      this.deps.disconnect();
      return;
    }
    if (payload.command === "start_recording") {
      await this.deps.recording.beginAccepted(payload.recordingId, payload.projectId);
      return;
    }
    if (payload.command === "stop_recording") {
      await this.deps.stopRecording(false);
      return;
    }
    if (payload.command === "set_active_tab") {
      const tabId = Number(payload.tabId);
      this.deps.page.setTabId(tabId);
      await chrome.tabs.update(tabId, { active: true });
      this.deps.emitStatus();
      return;
    }
    if (payload.command === "capture_snapshot") {
      this.startStatus({
        commandId: messageId,
        actionType: "web.dom.capture_snapshot",
        label: "Capture snapshot",
        target: this.deps.page.url()
      });
      await this.runtimeRouter().captureSnapshot();
      this.finishStatus({
        commandId: messageId,
        actionType: "web.dom.capture_snapshot",
        status: "succeeded",
        // Capturing evidence has no post-condition of its own to check.
        validation: { status: "none", reason: "evidence-only" },
        message: "Snapshot command dispatched.",
        startedAt: this.deps.runtimeStatus.current().startedAt ?? Date.now(),
        finishedAt: Date.now()
      });
      return;
    }
    if (payload.command === "evaluate_facts") {
      // A fact check is a read of the page as it stands, not a step: no
      // runtime status opens, no evidence boundary is captured, nothing is
      // recorded, and its answer goes straight back as the gateway result.
      await this.runtimeRouter().evaluateFacts(payload.check);
      return;
    }
    if (payload.command === "execute_action") {
      const commandId = payload.action.commandId;
      // A command id this worker already has an answer for -- still running,
      // just answered, queued, or lost by an earlier worker -- is answered with
      // it and never acted on twice (`in-flight/command-reconciliation.ts`).
      if (await this.reconciliation.answerRepeat(commandId) !== undefined) return;
      await this.reconciliation.begin(payload.action, this.deps.page.tabId()).catch((error: unknown) => this.inFlightRecordFailed(error));
      try {
        this.applyStart(this.deps.runtimeStatus.startAction(payload.action));
        await this.deps.captureActionBoundary("before", payload.action);
        // The evidence observer brings the target page forward. Re-read Chrome's
        // authoritative active tab after that asynchronous boundary so a delayed
        // tabs.onActivated callback cannot leave runtime dispatch on a stale tab.
        await this.deps.page.refresh();
        await this.runtimeRouter().executeAction(payload.action);
      } finally {
        this.reconciliation.release(commandId);
      }
    }
  }

  private async answerReconcile(commandId: string): Promise<void> {
    const answer = await this.reconciliation.reconcile(commandId).catch((error: unknown) => {
      this.inFlightRecordFailed(error);
      // A browser that cannot read what it kept cannot say; `unknown` never lets Core act again.
      return { commandId, state: "unknown" as const };
    });
    await this.deps.send("client.reconcile_result", answer);
  }

  /**
   * The in-flight record could not be written or read. The command still runs
   * -- refusing it over its own bookkeeping would fail a step that can work --
   * but a person reading the activity log can see the reconciliation is off.
   */
  private inFlightRecordFailed(error: unknown): void {
    this.deps.onActivity("runtime", "Could not keep the record of an action in flight", error instanceof Error ? error.message : String(error), "warning");
  }

  private runtimeRouter(): ExtensionRuntimeCommandRouter {
    return new ExtensionRuntimeCommandRouter({
      activeTabId: () => this.deps.page.tabId(),
      unsupportedPageReason: () => this.deps.page.unsupported()?.reason,
      // The panel is served from Core's own origin, and a run is usually started
      // from it: a navigation must never take that page over.
      ownOrigins: () => [this.deps.settings().coreApiUrl || DEFAULT_CORE_API_URL],
      attachTabForRecording: (tabId) => this.deps.attachment.attachTabForRecording(tabId),
      captureActiveSnapshot: (label) => this.deps.evidence.captureActiveSnapshot(label),
      sendActionResult: (result, tabId, frameId) => this.sendActionResult(result, tabId, frameId),
      sendGatewayResult: (result) => this.deps.send("client.action_result", result),
      noteDispatch: async (commandId, tabId, frameId) => {
        await this.reconciliation.dispatched(commandId, tabId, frameId).catch((error: unknown) => this.inFlightRecordFailed(error));
      },
      // The look takes in every frame (t200), merged exactly as a recorded
      // event's snapshot is, around the top frame's own capture.
      // A search's look asks every child frame for its hidden elements too.
      mergeFrameSnapshots: async (tabId, topSnapshot, waitMs, capture) =>
        await captureMergedTabSnapshot(
          { sendToTab, allTabFrames },
          tabId,
          topSnapshot as DomSnapshotPayload,
          TOP_FRAME_ID,
          { ...(waitMs === undefined ? {} : { waitMs }), ...(capture.includeHidden === true ? { includeHidden: true } : {}) }
        ) as DomSnapshot | undefined
    });
  }

  private async sendActionResult(result: BrowserActionResult, tabId?: number, frameId?: number): Promise<void> {
    this.finishStatus({
      ...result,
      ...(tabId !== undefined ? { tabId } : {}),
      ...(frameId !== undefined ? { frameId } : {})
    });
    await this.deps.captureActionBoundary("after", result);
    const visualTarget = result.visualTarget ?? (result.element
      ? webAutomationActionVisualTargetFromElement(result.element as never)
      : undefined);
    const gatewayResult = gatewayActionResultFromBrowserResult(result);
    await this.deps.send("client.action_result", gatewayResult);
    // Sent or queued: the record is cleared, and a repeat of this id is answered with this result.
    await this.reconciliation.settled(gatewayResult).catch((error: unknown) => this.inFlightRecordFailed(error));
    await this.sendRuntimeConfirmation(result, tabId, frameId);
    await this.deps.recordEvent(compactObject({
      kind: "action.result",
      sequence: this.deps.sequence.next(),
      url: result.url ?? this.deps.page.url() ?? "",
      title: result.title ?? "",
      eventTimestampMs: result.finishedAt,
      element: result.element,
      visualTarget,
      snapshot: result.snapshot,
      actionResult: result
    }), tabId, frameId);
  }

  // A succeeded runtime action is also something the recording must contain:
  // it is replayed as the recorded event a user would have produced. An action
  // that did not succeed gets no confirmation, which
  // `runtimeConfirmationForActionResult` decides. A tab confirmation's input
  // depends on the command's operation, which the result does not carry, so the
  // tracker hands back the request the action started with.
  private async sendRuntimeConfirmation(result: BrowserActionResult, tabId?: number, frameId?: number): Promise<void> {
    const confirmation = runtimeConfirmationForActionResult(result, this.deps.runtimeStatus.tabRequestFor(result.commandId));
    if (!confirmation) return;
    const event = createWebAutomationRecordingEvent({
      kind: confirmation.kind,
      sequence: this.deps.sequence.next(),
      url: result.url ?? this.deps.page.url() ?? "",
      title: result.title ?? "",
      eventTimestampMs: result.finishedAt,
      element: result.element as unknown as JsonObject | undefined,
      visualTarget: result.visualTarget as unknown as JsonObject | undefined,
      snapshot: result.snapshot as unknown as JsonObject,
      inputValue: confirmation.inputValue,
      key: confirmation.key,
      scroll: confirmation.scroll,
      tab: confirmation.tab,
      actionResult: webAutomationActionResultPayload(result as never),
      metadata: {
        domainId: WEB_AUTOMATION_DOMAIN_ID,
        inputId: confirmation.inputId,
        runtimeConfirmation: true
      }
    }, {
      ...(tabId !== undefined ? { tabId } : {}),
      ...(frameId !== undefined ? { frameId } : {})
    });
    await this.deps.send("client.recording_event", event);
  }

  private startStatus(status: Omit<RuntimeCommandStatus, "state">): void {
    this.applyStart(this.deps.runtimeStatus.start(status));
  }

  private applyStart(next: RuntimeCommandStatus): void {
    this.deps.setLastError(undefined);
    this.deps.onActivity("runtime", `Runtime started: ${next.label ?? next.actionType ?? "Command"}`, next.target, "warning");
    this.deps.emitStatus();
  }

  private finishStatus(result: BrowserActionResult & { tabId?: number; frameId?: number }): void {
    const failed = result.status !== "succeeded";
    const label = runtimeActionLabel(result.actionType);
    this.deps.runtimeStatus.finish(result);
    this.deps.page.noteActionResult(result.tabId, result.url);
    if (failed) this.deps.setLastError(result.message ?? `${label} failed.`);
    this.deps.onActivity(
      "runtime",
      failed ? `Runtime failed: ${label}` : `Runtime succeeded: ${label}`,
      result.message ?? runtimeResultTarget(result),
      failed ? "danger" : "success"
    );
    this.deps.emitStatus();
  }
}

/** The channel's own reconciliation, over the browser's session storage: records, received ids, and the offline queue. */
function ownReconciliation(deps: ServerCommandChannelDeps): CommandReconciliation {
  const area = inFlightRecordArea();
  return new CommandReconciliation({
    store: new InFlightRecordStore(area),
    seen: new SeenCommandStore(area),
    queuedResult: async (commandId) => await deps.gateway.queuedActionResult(commandId),
    send: async (result) => await deps.send("client.action_result", result),
    documentOf: frameDocumentId
  });
}
