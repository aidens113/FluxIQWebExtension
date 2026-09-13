// The recording currently in progress, and every transition into and out of
// one: the user asking to start, FluxIQ accepting or refusing that start, the
// window that starts locally when no answer arrives, and stopping.
//
// It owns the state that only exists while a recording does -- whether one is
// running, when it started, its id, how many user actions it has captured, and
// the block that stops a new one beginning -- and the handshake that negotiates
// a start with FluxIQ. Turning a browser happening into a recorded event is not
// its job; it hands those to the caller's event path.

import { WEB_AUTOMATION_DOMAIN_ID } from "@fluxiq-web-extension/domain/client";
import type {
  ActivityEntry,
  ConnectionState,
  FluxIQSession,
  FluxIQSettings,
  JsonObject,
  RecordingBlockState,
  RecordingEventPayload,
  RecordingState,
  TabDescriptor
} from "../../shared/protocol";
import type { ActivePage } from "./active-page";
import type { ActivityLog } from "./activity-log";
import { unsupportedPageForUrl } from "./browser-state";
import type { ContentAttachment } from "./content-attachment";
import type { EventSequence } from "./event-sequence";
import type { GatewayMessageSender } from "./gateway-session";
import type { NavigationRecorder } from "./navigation-recorder";
import type { PointerClickFilter } from "./pointer-click-filter";
import type { ProjectContext } from "./project-context";
import type { RecordingEvidenceReporter } from "./recording-evidence";
import { recordingActionChannels, recordingEnvironment, recordingSources } from "./recording-manifest";
import {
  isRecordingStartRefusalError,
  recordingStartRefusalBlock,
  RecordingStartHandshake,
  type RecordingStartAttempt,
  type RecordingStartRefusal
} from "./recording-start/index";
import { compactObject } from "./value-readers";

export type ActiveRecordingDeps = {
  readonly send: GatewayMessageSender;
  readonly gatewayState: () => ConnectionState;
  readonly session: () => FluxIQSession;
  readonly settings: () => FluxIQSettings;
  readonly persistSession: (session: FluxIQSession) => Promise<void>;
  readonly page: ActivePage;
  readonly projects: ProjectContext;
  readonly evidence: RecordingEvidenceReporter;
  readonly attachment: ContentAttachment;
  readonly navigation: NavigationRecorder;
  readonly clicks: PointerClickFilter;
  readonly sequence: EventSequence;
  readonly activityLog: ActivityLog;
  readonly allTabs: () => Promise<TabDescriptor[]>;
  // Re-entry through the facade: an event a lifecycle transition produces takes
  // the same public path as an event the page produced.
  readonly recordEvent: (payload: RecordingEventPayload, tabId?: number, frameId?: number) => Promise<void>;
  readonly onActivity: (kind: string, label: string, detail?: string, tone?: ActivityEntry["tone"]) => void;
  readonly emitStatus: () => void;
  // The panel error line. Dismissing the block clears only an error a refusal
  // put there, so it is read as well as written.
  readonly lastError: () => string | undefined;
  readonly setLastError: (message: string | undefined) => void;
};

export class ActiveRecording {
  private recordingState: RecordingState = "idle";
  private recordingStartedAt: number | undefined;
  private activeRecordingId: string | undefined;
  private recordingBlock: RecordingBlockState | undefined;
  private events = 0;
  private readonly handshake: RecordingStartHandshake;

  constructor(private readonly deps: ActiveRecordingDeps) {
    this.handshake = new RecordingStartHandshake({
      send: (attempt) => this.sendStart(attempt),
      beginLocally: (recordingId) => this.beginWithoutAcceptance(recordingId),
      surfaceRefusal: (refusal, attempts) => this.applyRefusal(refusal, attempts),
      noteRetry: (refusal, attempt, of, delayMs) => {
        this.deps.onActivity(
          "recording",
          "Recording start delayed",
          `${refusal.detail} Retrying in ${delayMs} ms (${attempt} of ${of}).`,
          "warning"
        );
        this.deps.emitStatus();
      }
    });
  }

  state(): RecordingState {
    return this.recordingState;
  }

  startedAt(): number | undefined {
    return this.recordingStartedAt;
  }

  recordingId(): string | undefined {
    return this.activeRecordingId;
  }

  eventCount(): number {
    return this.events;
  }

  block(): RecordingBlockState | undefined {
    return this.recordingBlock;
  }

  noteEvent(): void {
    this.events += 1;
  }

  async start(): Promise<void> {
    if (this.handshake.isPending()) {
      this.deps.onActivity("recording", "Recording is starting", "Waiting for FluxIQ project acceptance.", "warning");
      return;
    }
    if (this.deps.gatewayState() !== "connected") {
      this.deps.setLastError("Connect to FluxIQ before recording.");
      this.deps.emitStatus();
      return;
    }
    await this.deps.page.refresh();
    const unsupported = this.deps.page.unsupported();
    if (unsupported) {
      this.deps.setLastError(unsupported.reason);
      this.deps.onActivity("page", "Page cannot be recorded", unsupported.reason, "warning");
      this.deps.emitStatus();
      return;
    }
    this.resetLog();
    this.recordingBlock = undefined;
    const recordingId = `client.${this.deps.session().clientId}.${Date.now()}`;
    const startedAt = Date.now();
    const initialState = await this.deps.evidence.buildInitialRecordingState(startedAt);
    // Wording only, so it reads what is already known rather than paying for a
    // second Core lookup: the send resolves the project authoritatively, once
    // per attempt.
    this.deps.onActivity("recording", "Starting recording", this.deps.projects.current() ? "Waiting for FluxIQ project acceptance." : "Waiting for FluxIQ project context.", "warning");
    await this.handshake.begin({ recordingId, startedAt, initialState: initialState as unknown as JsonObject });
    this.deps.emitStatus();
  }

  async stop(notifyServer: boolean): Promise<void> {
    if (this.recordingState !== "recording") return;
    const recordingId = this.activeRecordingId;
    const projectId = this.deps.projects.activeRecordingProject();
    const endedAt = Date.now();
    const stopPayload = recordingId
      ? compactObject({
          recordingId,
          ...(projectId !== undefined ? { projectId } : {}),
          endedAt
        })
      : undefined;
    this.recordingState = "idle";
    this.deps.clicks.clear();
    this.activeRecordingId = undefined;
    this.deps.projects.setActiveRecordingProject(undefined);
    this.deps.onActivity("recording", "Recording stopped", `${this.events} user actions captured`, "neutral");
    this.deps.emitStatus();
    void this.deps.attachment.broadcast({ type: "recording", recording: false, settings: this.deps.settings() }, false);
    if (notifyServer && stopPayload) {
      await this.deps.send("client.stop_recording", stopPayload);
    }
  }

  dismissBlock(): void {
    this.recordingBlock = undefined;
    if (isRecordingStartRefusalError(this.deps.lastError())) this.deps.setLastError(undefined);
    this.deps.emitStatus();
  }

  async beginAccepted(recordingId: string, projectId?: string | null): Promise<void> {
    this.handshake.noteAccepted();
    if (projectId !== undefined) {
      await this.deps.persistSession(compactObject({ ...this.deps.session(), projectId }));
    }
    if (this.recordingState === "recording") {
      if (projectId !== undefined && this.deps.projects.activeRecordingProject() !== projectId) {
        this.deps.projects.setActiveRecordingProject(projectId);
        await this.deps.evidence.captureActiveSnapshot("Project-linked snapshot captured");
      }
      return;
    }
    this.resetLog();
    this.deps.navigation.clearRecordingTabs();
    this.recordingBlock = undefined;
    this.activeRecordingId = recordingId;
    this.deps.projects.setActiveRecordingProject(projectId !== undefined ? projectId : this.deps.session().projectId);
    this.events = 0;
    this.deps.activityLog.clearRecent();
    const recordingTabs = await this.deps.allTabs();
    this.recordingStartedAt = Date.now();
    this.recordingState = "recording";
    for (const tab of recordingTabs) {
      if (tab.tabId < 0 || !tab.url || unsupportedPageForUrl(tab.url)) continue;
      this.deps.navigation.seedRecordingTab(tab.tabId, tab.url, this.recordingStartedAt);
    }
    this.deps.onActivity("recording", "Recording started", this.deps.page.url() ?? "Active tab", "success");
    this.deps.emitStatus();
    const activeTabId = this.deps.page.tabId();
    if (activeTabId !== undefined) await this.deps.attachment.attachTabForRecording(activeTabId);
    await this.deps.page.sendBrowserState();
    await this.deps.recordEvent({
      kind: "browser.tab",
      sequence: this.deps.sequence.next(),
      url: this.deps.page.url() ?? "",
      title: "",
      eventTimestampMs: Date.now(),
      metadata: { recordingState: "started", recordingId }
    });
    await this.deps.evidence.captureActiveSnapshot("Initial snapshot captured");
  }

  // FluxIQ refused a start. The handshake decides whether that is retried or
  // surfaced; a refusal with no start of ours in flight is surfaced at once.
  noteStartRefusal(refusal: RecordingStartRefusal): void {
    this.handshake.noteRefusal(refusal);
  }

  // Abandons a start still waiting on FluxIQ, with its timers.
  cancelStart(): void {
    this.handshake.cancel();
  }

  // Each attempt resolves the project again rather than reusing the first
  // answer: a retry exists because FluxIQ's context moved, and the extension's
  // own view of it may have moved with it.
  private async sendStart(attempt: RecordingStartAttempt): Promise<void> {
    const projectId = await this.deps.projects.resolve(attempt.attempt === 0 ? "recording_start" : "recording_start_retry");
    await this.deps.send("client.start_recording", {
      recordingId: attempt.recordingId,
      ...(projectId ? { projectId } : {}),
      startedAt: attempt.startedAt,
      domainId: WEB_AUTOMATION_DOMAIN_ID,
      initialState: attempt.initialState,
      environment: recordingEnvironment(this.deps.session().clientId, this.deps.page.url()),
      sources: recordingSources(this.deps.session().clientId),
      actionChannels: recordingActionChannels(this.deps.session().clientId),
      metadata: {
        domainId: WEB_AUTOMATION_DOMAIN_ID,
        requestedBy: "extension-record-button",
        projectId: projectId ?? null,
        activeTabUrl: this.deps.page.url() ?? null,
        startAttempt: attempt.attempt
      }
    });
  }

  // A refusal the handshake has stopped fighting -- persistent from the first
  // answer, or transient and out of retries. Either way the recorder must not
  // be left silently idle: the block says what happened, `lastError` says it
  // on the status line, and the activity log keeps the trail.
  private applyRefusal(refusal: RecordingStartRefusal, attempts: number): void {
    this.handshake.cancel();
    if (this.recordingState === "recording") {
      this.recordingState = "idle";
      this.deps.clicks.clear();
      void this.deps.attachment.broadcast({ type: "recording", recording: false, settings: this.deps.settings() }, false);
    }
    this.recordingStartedAt = undefined;
    this.activeRecordingId = undefined;
    this.deps.projects.setActiveRecordingProject(undefined);
    this.recordingBlock = recordingStartRefusalBlock(refusal, attempts);
    this.deps.setLastError(refusal.lastError);
    this.deps.onActivity("recording", "Recording locked", refusal.detail, "warning");
    this.deps.emitStatus();
  }

  // FluxIQ did not answer the start in time. Recording begins locally so no
  // user action is lost; the project link attaches later if one arrives. A
  // refusal is not silence and never reaches here -- it goes to
  // `applyRefusal`, through a bounded retry when waiting can help.
  private async beginWithoutAcceptance(recordingId: string): Promise<void> {
    const projectId = await this.deps.projects.resolve("recording_start_timeout");
    await this.beginAccepted(recordingId, projectId ?? null);
    if (!projectId) {
      this.deps.onActivity("recording", "Project context pending", "Structured state will record; screenshots attach after FluxIQ links a project.", "warning");
      this.deps.emitStatus();
    }
  }

  private resetLog(): void {
    this.events = 0;
    this.deps.activityLog.reset();
    this.deps.clicks.clear();
  }
}
