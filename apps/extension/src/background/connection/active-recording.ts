// The recording currently in progress, and every transition into and out of
// one: the user asking to start, FluxIQ accepting or refusing that start, the
// window that starts locally when no answer arrives, and stopping.
//
// It owns the state that only exists while a recording does -- whether one is
// running, when it started, its id, how many user actions it has captured, and
// the block that stops a new one beginning -- and the handshake that negotiates
// a start with FluxIQ. Turning a browser happening into a recorded event is not
// its job; it hands those to the caller's event path.
//
// A recording starts once. FluxIQ's acknowledgement can race the local start,
// arrive twice, name another recording, or cross this client's own Stop on the
// wire; `beginAccepted` and `beginOnce` decide each of those.

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
import type { ScriptedNavigationIntent } from "./scripted-navigation/index";
import { recordingActionChannels, recordingEnvironment, recordingSources } from "./recording-manifest";
import {
  isRecordingStartRefusalError,
  recordingStartRefusalBlock,
  RecordingStartHandshake,
  type RecordingStartAttempt,
  type RecordingStartRefusal
} from "./recording-start/index";
import { compactObject } from "./value-readers";

// How long a start waits on its project lookup before going on without a
// project. The lookup reads FluxIQ's gateway snapshot over HTTP with no timeout
// of its own (`core-api.ts`), and the local fallback waits for the start's send,
// which waits for the lookup: unbounded, one stalled lookup would hold that
// fallback off for good. Twice the acceptance window, so a slow FluxIQ still
// answers while a user who pressed Record is still watching.
export const RECORDING_START_PROJECT_LOOKUP_BOUND_MS = 1_500;

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
  readonly scriptedNavigation: ScriptedNavigationIntent;
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

type StartUnderWay = {
  readonly recordingId: string;
  // Settles, and never rejects, once the start has finished or failed.
  readonly finished: Promise<void>;
};

type StopUnderWay = {
  // Every caller crossing the same stop boundary observes this exact result.
  readonly finished: Promise<void>;
};

type UiStartUnderWay = {
  cancelled: boolean;
  finished: Promise<void>;
};

export class ActiveRecording {
  private recordingState: RecordingState = "idle";
  private recordingStartedAt: number | undefined;
  private activeRecordingId: string | undefined;
  private recordingBlock: RecordingBlockState | undefined;
  private events = 0;
  // A start already decided that has not yet reached `recording`.
  private starting: StartUnderWay | undefined;
  // Installed synchronously for every Stop that owns lifecycle work, including
  // work which has not reached `recording` yet. Starts arriving afterwards
  // wait behind this owner; callers crossing it share its exact result.
  private stopRequest: StopUnderWay | undefined;
  // Covers the pre-handshake work too, so simultaneous UI presses released
  // behind a Stop cannot both pass the handshake's pending check.
  private uiStart: UiStartUnderWay | undefined;
  // The initial marker is the one event an accepted start must publish even
  // when Stop already owns the lifecycle. This flag is true only for the
  // synchronous admission of that marker, never across its asynchronous send.
  private admittingInitialMarker = false;
  // The recording this client last stopped: FluxIQ's acknowledgement of it can
  // still be on the wire.
  private stoppedRecordingId: string | undefined;
  // The recording whose start last gave up on its project lookup at the bound.
  private lookupBoundReachedFor: string | undefined;
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

  acceptsEvents(): boolean {
    return this.recordingState === "recording"
      && (this.stopRequest === undefined || this.admittingInitialMarker);
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

  start(): Promise<void> {
    if (this.uiStart) return this.uiStart.finished;
    const uiStart = { cancelled: false, finished: Promise.resolve() };
    const finished = this.startAfterStop(uiStart);
    uiStart.finished = finished;
    this.uiStart = uiStart;
    void finished.then(
      () => { if (this.uiStart === uiStart) this.uiStart = undefined; },
      () => { if (this.uiStart === uiStart) this.uiStart = undefined; }
    );
    return finished;
  }

  private async startAfterStop(uiStart: UiStartUnderWay): Promise<void> {
    await this.settleCapturedStop();
    if (uiStart.cancelled) return;
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
    if (uiStart.cancelled) return;
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
    if (uiStart.cancelled) return;
    // Server and UI starts share this final gate. A server start can win while
    // UI preflight awaits; once any such start settles, re-evaluate every
    // lifecycle owner and enter handshake.begin in the same turn so no other
    // source can install a competing identity between decision and claim.
    while (this.starting) await this.starting.finished;
    if (uiStart.cancelled) return;
    if (this.recordingState === "recording" || this.handshake.isPending()) {
      this.deps.onActivity("recording", "Recording is starting", "Another recording start won while this request was preparing.", "warning");
      return;
    }
    // Wording only, so it reads what is already known rather than paying for a
    // second Core lookup: the send resolves the project authoritatively, once
    // per attempt.
    this.deps.onActivity("recording", "Starting recording", this.deps.projects.current() ? "Waiting for FluxIQ project acceptance." : "Waiting for FluxIQ project context.", "warning");
    await this.handshake.begin({ recordingId, startedAt, initialState: initialState as unknown as JsonObject });
    this.deps.emitStatus();
  }

  stop(notifyServer: boolean): Promise<void> {
    if (this.stopRequest) return this.stopRequest.finished;
    const uiStart = this.uiStart;
    const starting = this.starting;
    const pendingRecordingId = this.handshake.pendingRecordingId();
    const recordingId = this.activeRecordingId ?? starting?.recordingId ?? pendingRecordingId;
    if (this.recordingState !== "recording" && !uiStart && !starting && !pendingRecordingId) return Promise.resolve();
    // An already-active recording ends at this synchronous admission fence.
    // A start still being accepted gets its end time only after its required
    // initial marker has settled, so Core never sees an end before its start.
    const endedAt = this.recordingState === "recording" ? Date.now() : undefined;
    let resolveStop: () => void = () => undefined;
    let rejectStop: (error: unknown) => void = () => undefined;
    const finished = new Promise<void>((resolve, reject) => {
      resolveStop = resolve;
      rejectStop = reject;
    });
    const stopRequest = { finished };
    this.stopRequest = stopRequest;
    if (uiStart) {
      uiStart.cancelled = true;
      // Stop retains and drains A's promise below, but A no longer occupies
      // the public single-flight slot: a later press is B, ordered behind this
      // Stop. A's identity-checked settlement cannot clear B's slot.
      if (this.uiStart === uiStart) this.uiStart = undefined;
    }
    const pendingSend = pendingRecordingId ? this.handshake.cancelAndDrain() : undefined;
    void this.finishStopRequest(notifyServer, recordingId, uiStart, starting, pendingSend, endedAt).then(() => {
      if (this.stopRequest === stopRequest) this.stopRequest = undefined;
      resolveStop();
    }, (error: unknown) => {
      if (this.stopRequest === stopRequest) this.stopRequest = undefined;
      rejectStop(error);
    });
    return finished;
  }

  private async finishStopRequest(
    notifyServer: boolean,
    recordingId: string | undefined,
    uiStart: UiStartUnderWay | undefined,
    starting: StartUnderWay | undefined,
    pendingSend: Promise<void> | undefined,
    endedAt: number | undefined
  ): Promise<void> {
    if (uiStart) await uiStart.finished.catch(() => undefined);
    if (starting) await starting.finished;
    if (pendingSend) await pendingSend;
    // No start marker crossed the client boundary, so cancelling preflight is
    // the whole Stop. Otherwise Core may own the captured identity and must see
    // a matching close even when local start work rejected before activation.
    if (!recordingId && this.recordingState !== "recording") return;
    await this.finishStop(
      notifyServer,
      this.activeRecordingId ?? recordingId,
      this.deps.projects.activeRecordingProject(),
      endedAt ?? Date.now()
    );
  }

  private async finishStop(
    notifyServer: boolean,
    recordingId: string | undefined,
    projectId: string | null | undefined,
    endedAt: number
  ): Promise<void> {
    const stopPayload = recordingId
      ? compactObject({ recordingId, ...(projectId !== undefined ? { projectId } : {}), endedAt })
      : undefined;
    let navigationFailure: unknown;
    try {
      await this.deps.navigation.flush();
    } catch (error) {
      navigationFailure = error;
    }
    this.deps.scriptedNavigation.cancelAll("recording_stopped");
    this.recordingState = "idle";
    this.stoppedRecordingId = recordingId;
    this.deps.clicks.clear();
    this.activeRecordingId = undefined;
    this.deps.projects.setActiveRecordingProject(undefined);
    this.deps.onActivity("recording", "Recording stopped", `${this.events} user actions captured`, "neutral");
    this.deps.emitStatus();
    void this.deps.attachment.broadcast({ type: "recording", recording: false, settings: this.deps.settings() }, false);
    if (notifyServer && stopPayload) {
      try {
        await this.deps.send("client.stop_recording", stopPayload);
      } catch (error) {
        if (navigationFailure === undefined) throw error;
      }
    }
    if (navigationFailure !== undefined) throw navigationFailure;
  }

  dismissBlock(): void {
    this.recordingBlock = undefined;
    if (isRecordingStartRefusalError(this.deps.lastError())) this.deps.setLastError(undefined);
    this.deps.emitStatus();
  }

  // FluxIQ's `server.start_recording`: its acknowledgement of this client's
  // start, or a start FluxIQ asked for itself, from the web panel.
  async beginAccepted(recordingId: string, projectId?: string | null): Promise<void> {
    const stopRequest = this.stopRequest;
    if (stopRequest) await stopRequest.finished.catch(() => undefined);
    if (!this.expectsStart(recordingId)) {
      this.deps.onActivity("recording", "Recording start ignored", "FluxIQ named a recording this client is not starting or running, or has already stopped.", "warning");
      return;
    }
    this.handshake.noteAccepted();
    await this.beginOnce(recordingId, async () => projectId);
  }

  // FluxIQ refused a start. The handshake decides whether that is retried or
  // surfaced; a refusal with no start of ours in flight is surfaced at once.
  noteStartRefusal(refusal: RecordingStartRefusal): void {
    if (this.stopRequest) return;
    this.handshake.noteRefusal(refusal);
  }

  // Abandons a start still waiting on FluxIQ, with its timers.
  cancelStart(): void {
    this.handshake.cancel();
  }

  // A `server.start_recording` names the recording FluxIQ opened. One naming the
  // recording this client stopped crossed that Stop on the wire, and restarting
  // would record into a recording FluxIQ has closed. While a start is pending or
  // under way, or a recording is running, one naming any other recording
  // answers none of them. With none of those, it is FluxIQ's own start.
  private expectsStart(recordingId: string): boolean {
    if (recordingId === this.stoppedRecordingId) return false;
    const own = [
      this.handshake.pendingRecordingId(),
      this.starting?.recordingId,
      this.recordingState === "recording" ? this.activeRecordingId : undefined
    ].filter((id) => id !== undefined);
    return own.length === 0 || own.includes(recordingId);
  }

  // Capture once: a rejected Stop still completed teardown, and a later Stop
  // belongs to a later recording rather than extending this caller's wait.
  private async settleCapturedStop(): Promise<void> {
    const stopRequest = this.stopRequest;
    if (stopRequest) await stopRequest.finished.catch(() => undefined);
  }

  // Every way into a recording comes through here, so it starts once. A start
  // is marked the moment it is decided, before its first await. Another that
  // arrives meanwhile waits for it, then finds the recording running and only
  // links its project, so the two apply in the order they arrived: a local
  // start's missing project never overwrites the one FluxIQ named while it ran.
  private async beginOnce(recordingId: string, project: () => Promise<string | null | undefined>): Promise<void> {
    while (this.starting) await this.starting.finished;
    if (this.recordingState === "recording") {
      await this.linkProject(await project());
      return;
    }
    let finish: () => void = () => undefined;
    const starting: StartUnderWay = { recordingId, finished: new Promise<void>((resolve) => { finish = resolve; }) };
    this.starting = starting;
    try {
      await this.startRecording(recordingId, await project());
    } finally {
      if (this.starting === starting) this.starting = undefined;
      finish();
    }
  }

  private async linkProject(projectId: string | null | undefined): Promise<void> {
    if (projectId === undefined) return;
    await this.deps.persistSession(compactObject({ ...this.deps.session(), projectId }));
    if (this.recordingState !== "recording" || this.deps.projects.activeRecordingProject() === projectId) return;
    this.deps.projects.setActiveRecordingProject(projectId);
    await this.deps.evidence.captureActiveSnapshot("Project-linked snapshot captured");
  }

  private async startRecording(recordingId: string, projectId: string | null | undefined): Promise<void> {
    if (projectId !== undefined) {
      await this.deps.persistSession(compactObject({ ...this.deps.session(), projectId }));
    }
    this.deps.scriptedNavigation.cancelAll("recording_stopped");
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
    let initialMarker: Promise<void>;
    try {
      this.admittingInitialMarker = true;
      initialMarker = this.deps.recordEvent({
        kind: "browser.tab",
        sequence: this.deps.sequence.next(),
        url: this.deps.page.url() ?? "",
        title: "",
        eventTimestampMs: Date.now(),
        metadata: { recordingState: "started", recordingId }
      });
    } finally {
      this.admittingInitialMarker = false;
    }
    await initialMarker;
    await this.deps.evidence.captureActiveSnapshot("Initial snapshot captured");
  }

  // Each attempt resolves the project again rather than reusing the first
  // answer: a retry exists because FluxIQ's context moved, and the extension's
  // own view of it may have moved with it.
  private async sendStart(attempt: RecordingStartAttempt): Promise<void> {
    const projectId = await this.lookUpProject(attempt.recordingId, attempt.attempt === 0 ? "recording_start" : "recording_start_retry");
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

  // A start's project, waited on for at most the bound. At the bound the start
  // goes on as it does when no project is known: the send carries none, for
  // FluxIQ to accept or refuse, and a local start records unlinked until an
  // acknowledgement names a project. The lookup is left to finish on its own.
  private async lookUpProject(recordingId: string, reason: string): Promise<string | undefined> {
    let boundReached = false;
    let bound: ReturnType<typeof setTimeout> | undefined;
    const giveUp = new Promise<undefined>((resolve) => {
      bound = setTimeout(() => {
        boundReached = true;
        resolve(undefined);
      }, RECORDING_START_PROJECT_LOOKUP_BOUND_MS);
    });
    try {
      const projectId = await Promise.race([this.deps.projects.resolve(reason), giveUp]);
      this.lookupBoundReachedFor = boundReached ? recordingId : undefined;
      if (boundReached) {
        this.deps.onActivity("recording", "Project lookup timed out", `No project from FluxIQ within ${RECORDING_START_PROJECT_LOOKUP_BOUND_MS} ms; starting without one.`, "warning");
      }
      return projectId;
    } finally {
      clearTimeout(bound);
    }
  }

  // A refusal the handshake has stopped fighting -- persistent from the first
  // answer, or transient and out of retries. Either way the recorder must not
  // be left silently idle: the block says what happened, `lastError` says it
  // on the status line, and the activity log keeps the trail.
  private applyRefusal(refusal: RecordingStartRefusal, attempts: number): void {
    this.handshake.cancel();
    if (this.recordingState === "recording") {
      this.deps.scriptedNavigation.cancelAll("recording_stopped");
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
  // `applyRefusal`, through a bounded retry when waiting can help. When this
  // start's send already gave up on the lookup at the bound, the local start
  // does not wait on it a second time: it goes on with what is known.
  private async beginWithoutAcceptance(recordingId: string): Promise<void> {
    let projectId: string | undefined;
    await this.beginOnce(recordingId, async () => {
      projectId = this.lookupBoundReachedFor === recordingId
        ? this.deps.projects.current()
        : await this.lookUpProject(recordingId, "recording_start_timeout");
      return projectId ?? null;
    });
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
