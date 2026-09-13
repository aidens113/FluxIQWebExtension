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
  FluxIQSession,
  FluxIQSettings,
  JsonObject,
  RecordingEventPayload,
  RuntimeCommandStatus,
  ServerCommandPayload
} from "../../shared/protocol";
import { ExtensionRuntimeCommandRouter, gatewayActionResultFromBrowserResult } from "../../runtime";
import type { ActivePage } from "./active-page";
import type { ActiveRecording } from "./active-recording";
import type { ContentAttachment } from "./content-attachment";
import type { EventSequence } from "./event-sequence";
import type { GatewayMessageSender, GatewaySession } from "./gateway-session";
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
  // Re-entry through the facade for the three public paths a command can take.
  readonly recordEvent: (payload: RecordingEventPayload, tabId?: number, frameId?: number) => Promise<void>;
  readonly stopRecording: (notifyServer: boolean) => Promise<void>;
  readonly disconnect: () => void;
};

export class ServerCommandChannel {
  constructor(private readonly deps: ServerCommandChannelDeps) {}

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
    this.deps.gateway.markSessionReady();
    this.deps.onActivity("connection", "Connected to FluxIQ", "Client session ready", "success");
    await this.deps.page.sendBrowserState();
    await this.deps.gateway.flushQueue();
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
    if (payload.command === "execute_action") {
      this.applyStart(this.deps.runtimeStatus.startAction(payload.action));
      await this.deps.captureActionBoundary("before", payload.action);
      // The evidence observer brings the target page forward. Re-read Chrome's
      // authoritative active tab after that asynchronous boundary so a delayed
      // tabs.onActivated callback cannot leave runtime dispatch on a stale tab.
      await this.deps.page.refresh();
      await this.runtimeRouter().executeAction(payload.action);
    }
  }

  private runtimeRouter(): ExtensionRuntimeCommandRouter {
    return new ExtensionRuntimeCommandRouter({
      activeTabId: () => this.deps.page.tabId(),
      unsupportedPageReason: () => this.deps.page.unsupported()?.reason,
      attachTabForRecording: (tabId) => this.deps.attachment.attachTabForRecording(tabId),
      captureActiveSnapshot: (label) => this.deps.evidence.captureActiveSnapshot(label),
      sendActionResult: (result, tabId, frameId) => this.sendActionResult(result, tabId, frameId)
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
    await this.deps.send("client.action_result", gatewayActionResultFromBrowserResult(result));
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
