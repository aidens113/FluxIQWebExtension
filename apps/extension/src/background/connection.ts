// The extension's connection to FluxIQ. It holds the session and settings, the
// recording's own state, and the active tab, and it routes between the browser
// (tabs, content scripts, runtime commands) and the client gateway.
//
// Everything it does not need to hold itself lives in ./connection: the
// WebSocket session and its reconnection lifecycle, the activity log, the
// runtime command status, navigation and pointer-click filtering, project
// context, evidence capture, and Core's HTTP API. This file is the facade that
// owns the order those collaborators run in.

import {
  createWebAutomationRecordingEvent,
  createWebAutomationStateFromTabs,
  createWebAutomationStateUpdate,
  webAutomationActionResultPayload,
  webAutomationActionVisualTargetFromElement,
  WEB_AUTOMATION_DOMAIN_ID,
  WEB_AUTOMATION_INPUT_IDS
} from "@fluxiq-web-extension/domain/client";
import type {
  ActivityEntry,
  BrowserActionResult,
  ClientGatewayServerMessage,
  CoreRecordingsPage,
  ExtensionStatus,
  FluxIQSession,
  FluxIQSettings,
  JsonObject,
  RecordingBlockState,
  RecordingEventPayload,
  RecordingLogPage,
  RecordingState,
  RuntimeCommandStatus,
  ServerCommandPayload,
  UnsupportedPageState
} from "../shared/protocol";
import { activeTab, allTabFrames, allTabs, ensureContentScript, sendToTab } from "./tabs";
import { captureActionBoundary } from "./action-evidence";
import { clearQueuedEvents, queueEvent, readQueuedEvents, writeSession } from "./storage";
import { ExtensionRuntimeCommandRouter, gatewayActionResultFromBrowserResult } from "../runtime";
// Written as ".../index" because this file and its collaborators' directory are
// siblings of the same name: "./connection" would resolve back to this file.
import {
  ActivityLog,
  browserStateFromTabs,
  compactObject,
  ContentAttachment,
  describeActiveTabLike,
  EventSequence,
  fetchCoreRecordings,
  GatewaySession,
  gatewayRecordingEventFromPayload,
  isDomSnapshotPayload,
  NavigationRecorder,
  objectValue,
  PointerClickFilter,
  ProjectContext,
  RecordingEvidenceReporter,
  RuntimeStatusTracker,
  StateAssetStore,
  stringValue,
  unsupportedPageForUrl,
  activityDetail,
  activityLabel,
  clickEventSignature,
  eventSourceId,
  isExecutableRecordedAction,
  isNavigationExplanation,
  recordingActionChannels,
  recordingEnvironment,
  recordingSources,
  runtimeActionLabel,
  runtimeConfirmationForActionResult,
  runtimeResultTarget,
  type CoreApiCredentials,
  type TabSnapshotTransport
} from "./connection/index";

type StatusListener = (status: ExtensionStatus) => void;

// How long the extension waits for FluxIQ to accept a locally started recording
// before beginning one anyway.
const RECORDING_START_ACCEPT_TIMEOUT_MS = 750;

export class FluxIQConnection {
  private recordingState: RecordingState = "idle";
  private lastError: string | undefined;
  private activeTabId: number | undefined;
  private activeTabUrl: string | undefined;
  private eventCount = 0;
  private recordingStartedAt: number | undefined;
  private activeRecordingId: string | undefined;
  private pendingRecordingStart: { recordingId: string; timer: ReturnType<typeof setTimeout> } | undefined;
  private recordingBlock: RecordingBlockState | undefined;
  private unsupportedPage: UnsupportedPageState | undefined;
  private readonly listeners = new Set<StatusListener>();

  private readonly activityLog = new ActivityLog();
  private readonly sequence = new EventSequence();
  private readonly runtimeStatus = new RuntimeStatusTracker();
  private readonly navigation = new NavigationRecorder();
  private readonly clicks = new PointerClickFilter();
  private readonly transport: TabSnapshotTransport = { sendToTab, allTabFrames };
  private readonly gateway: GatewaySession;
  private readonly projects: ProjectContext;
  private readonly attachment: ContentAttachment;
  private readonly evidence: RecordingEvidenceReporter;

  constructor(
    private settings: FluxIQSettings,
    private session: FluxIQSession
  ) {
    this.gateway = new GatewaySession({
      settings: () => this.settings,
      session: () => this.session,
      persistSession: (session) => this.persistSession(session),
      emitStatus: () => this.emitStatus(),
      reportError: (message) => { this.lastError = message; },
      clearError: () => { this.lastError = undefined; },
      beforeConnect: () => this.refreshActiveTab(),
      queue: { queueEvent, readQueuedEvents, clearQueuedEvents },
      handlers: {
        onServerMessage: (message) => void this.onMessage(message),
        onPairingRequired: (referenceCode, reason) => {
          this.lastError = reason || "Approve this client in FluxIQ.";
          this.addActivity("pairing", "Waiting for approval", referenceCode ? `Reference ${referenceCode}` : undefined, "warning");
          this.emitStatus();
        },
        onSessionReady: (message) => void this.onSessionReady(message),
        onCommand: (payload, messageId) => void this.handleServerCommandPayload(payload, messageId),
        onHeartbeat: () => void this.sendBrowserState()
      }
    });
    this.projects = new ProjectContext({
      settings: () => this.settings,
      session: () => this.session,
      adoptProjectId: (projectId) => this.persistSession(compactObject({ ...this.session, projectId })),
      onActivity: (kind, label, detail, tone) => this.addActivity(kind, label, detail, tone)
    });
    this.attachment = new ContentAttachment({
      sendToTab,
      ensureContentScript,
      settings: () => this.settings,
      isRecording: () => this.recordingState === "recording",
      hasRecordedTab: (tabId) => this.navigation.hasRecordedTab(tabId),
      noteRecordedTab: (tabId, url, timestamp) => this.navigation.noteRecordedTab(tabId, url, timestamp)
    });
    this.evidence = new RecordingEvidenceReporter({
      send: this.gateway.send,
      recordingState: () => this.recordingState,
      resolveProjectId: (reason) => this.projects.resolve(reason),
      onActivity: (kind, label, detail, tone) => this.addActivity(kind, label, detail, tone),
      emitStatus: () => this.emitStatus(),
      clientId: () => this.session.clientId,
      activeTabId: () => this.activeTabId,
      activeTabUrl: () => this.activeTabUrl,
      unsupportedPage: () => this.unsupportedPage,
      setUnsupportedPage: (state) => { this.unsupportedPage = state; },
      transport: this.transport,
      ensureContentScript,
      attachTabForRecording: (tabId) => this.attachment.attachTabForRecording(tabId),
      activeTab,
      allTabs,
      stateAssets: new StateAssetStore({
        credentials: () => this.coreApiCredentials(),
        onActivity: (kind, label, detail, tone) => this.addActivity(kind, label, detail, tone)
      }),
      screenshotDiagnostics: () => ({
        sessionId: this.session.sessionId,
        clientId: this.session.clientId,
        projectId: this.session.projectId,
        activeRecordingProjectId: this.projects.activeRecordingProject(),
        activeTabId: this.activeTabId,
        coreApiUrl: this.settings.coreApiUrl
      })
    });
  }

  status(): ExtensionStatus {
    const gateway = this.gateway.statusFields();
    const status: ExtensionStatus = {
      connectionState: gateway.connectionState,
      recordingState: this.recordingState,
      gatewayUrl: this.settings.gatewayUrl,
      settings: this.settings,
      clientId: this.session.clientId,
      queueSize: gateway.queueSize,
      eventCount: this.eventCount,
      recentActivities: this.activityLog.recentEntries(),
      runtime: { ...this.runtimeStatus.current() }
    };
    const lastActivityAt = this.activityLog.lastActivityAt();
    if (this.session.sessionId) status.sessionId = this.session.sessionId;
    if (this.session.projectId !== undefined) status.projectId = this.session.projectId;
    if (this.activeTabId !== undefined) status.activeTabId = this.activeTabId;
    if (this.activeTabUrl) status.activeTabUrl = this.activeTabUrl;
    if (gateway.pairingReferenceCode) status.pairingReferenceCode = gateway.pairingReferenceCode;
    if (this.recordingStartedAt !== undefined) status.recordingStartedAt = this.recordingStartedAt;
    if (lastActivityAt !== undefined) status.lastActivityAt = lastActivityAt;
    if (this.unsupportedPage) status.unsupportedPage = this.unsupportedPage;
    if (this.recordingBlock) status.recordingBlock = this.recordingBlock;
    if (this.lastError) status.lastError = this.lastError;
    if (gateway.lastMessageAt !== undefined) status.lastMessageAt = gateway.lastMessageAt;
    return status;
  }

  subscribe(listener: StatusListener): () => void {
    this.listeners.add(listener);
    listener(this.status());
    return () => this.listeners.delete(listener);
  }

  updateSettings(settings: FluxIQSettings): void {
    this.settings = settings;
  }

  recordingLogPage(page: number, pageSize: number): RecordingLogPage {
    return this.activityLog.page(page, pageSize);
  }

  async listCoreRecordings(page: number, pageSize: number): Promise<CoreRecordingsPage> {
    return await fetchCoreRecordings(this.coreApiCredentials(), page, pageSize);
  }

  async connect(): Promise<void> {
    await this.gateway.connect();
  }

  disconnect(): void {
    this.gateway.stopReconnecting();
    this.clearPendingRecordingStart();
    this.gateway.closeClient();
    if (this.recordingState === "recording") this.addActivity("connection", "Disconnected during recording", "Events will queue until reconnect.", "warning");
    this.gateway.markDisconnected();
  }

  async startRecording(): Promise<void> {
    if (this.pendingRecordingStart) {
      this.addActivity("recording", "Recording is starting", "Waiting for FluxIQ project acceptance.", "warning");
      return;
    }
    if (this.gateway.state() !== "connected") {
      this.lastError = "Connect to FluxIQ before recording.";
      this.emitStatus();
      return;
    }
    await this.refreshActiveTab();
    if (this.unsupportedPage) {
      this.lastError = this.unsupportedPage.reason;
      this.addActivity("page", "Page cannot be recorded", this.unsupportedPage.reason, "warning");
      this.emitStatus();
      return;
    }
    this.resetRecordingLog();
    this.recordingBlock = undefined;
    const recordingId = `client.${this.session.clientId}.${Date.now()}`;
    const startedAt = Date.now();
    const projectId = await this.projects.resolve("recording_start");
    const initialState = await this.evidence.buildInitialRecordingState(startedAt);
    await this.gateway.send("client.start_recording", {
      recordingId,
      ...(projectId ? { projectId } : {}),
      startedAt,
      domainId: WEB_AUTOMATION_DOMAIN_ID,
      initialState: initialState as unknown as JsonObject,
      environment: recordingEnvironment(this.session.clientId, this.activeTabUrl),
      sources: recordingSources(this.session.clientId),
      actionChannels: recordingActionChannels(this.session.clientId),
      metadata: {
        domainId: WEB_AUTOMATION_DOMAIN_ID,
        requestedBy: "extension-record-button",
        projectId: projectId ?? null,
        activeTabUrl: this.activeTabUrl ?? null
      }
    });
    this.addActivity("recording", "Starting recording", projectId ? "Waiting for FluxIQ project acceptance." : "Waiting for FluxIQ project context.", "warning");
    this.pendingRecordingStart = {
      recordingId,
      timer: setTimeout(() => void this.handleRecordingStartTimeout(recordingId), RECORDING_START_ACCEPT_TIMEOUT_MS)
    };
    this.emitStatus();
  }

  async stopRecording(notifyServer = true): Promise<void> {
    if (this.recordingState !== "recording") return;
    const recordingId = this.activeRecordingId;
    const projectId = this.projects.activeRecordingProject();
    const endedAt = Date.now();
    const stopPayload = recordingId
      ? compactObject({
          recordingId,
          ...(projectId !== undefined ? { projectId } : {}),
          endedAt
        })
      : undefined;
    this.recordingState = "idle";
    this.clicks.clear();
    this.activeRecordingId = undefined;
    this.projects.setActiveRecordingProject(undefined);
    this.addActivity("recording", "Recording stopped", `${this.eventCount} user actions captured`, "neutral");
    this.emitStatus();
    void this.attachment.broadcast({ type: "recording", recording: false, settings: this.settings }, false);
    if (notifyServer && stopPayload) {
      await this.gateway.send("client.stop_recording", stopPayload);
    }
  }

  dismissRecordingBlock(): void {
    this.recordingBlock = undefined;
    if (this.lastError === "Open a FluxIQ project before recording.") this.lastError = undefined;
    this.emitStatus();
  }

  async handleRecordingEvent(payload: RecordingEventPayload, tabId?: number, frameId?: number): Promise<void> {
    if (this.recordingState !== "recording") return;
    if (payload.kind === "dom.click") {
      const sourceEvent = stringValue(objectValue(payload.metadata)?.sourceEvent);
      const signature = clickEventSignature(payload, tabId, frameId);
      if (sourceEvent === "pointerdown" && signature) {
        if (this.clicks.isSuppressed(signature)) return;
        this.clicks.suppressNext(signature);
        await this.processRecordingEvent(payload, tabId, frameId);
        return;
      }
      if (sourceEvent === "click" && signature && this.clicks.isSuppressed(signature)) {
        return;
      }
    }
    await this.processRecordingEvent(payload, tabId, frameId);
  }

  async handleContentReady(payload: RecordingEventPayload, tabId?: number, frameId?: number): Promise<void> {
    let readyPayload = payload;
    if (this.recordingState === "recording" && tabId !== undefined && !this.unsupportedPage) {
      await this.attachment.setRecordingState(tabId, true, frameId).catch(() => undefined);
      if (!payload.snapshot) {
        const snapshot = await sendToTab(tabId, { type: "captureSnapshot" }, frameId)
          .then((value) => isDomSnapshotPayload(value) ? value : undefined)
          .catch(() => undefined);
        if (snapshot) readyPayload = { ...payload, snapshot };
      }
    }
    await this.handleRecordingEvent(readyPayload, tabId, frameId);
  }

  async handleTabUpdated(tab: chrome.tabs.Tab): Promise<void> {
    const becameActive = Boolean(tab.active && tab.id !== undefined && this.activeTabId !== tab.id);
    if (tab.active && tab.id !== undefined) {
      this.activeTabId = tab.id;
      this.activeTabUrl = tab.url;
      this.unsupportedPage = unsupportedPageForUrl(tab.url);
      this.emitStatus();
    }
    if (!tab.id) return;
    if (tab.active && this.recordingState === "recording" && !this.unsupportedPage) {
      await this.attachment.attachTabForRecording(tab.id).catch(() => undefined);
      if (becameActive) this.addActivity("tab", "Recording active tab", tab.url ?? `Tab ${tab.id}`);
    }
    if (this.gateway.state() === "connected") {
      await this.gateway.send("client.state_update", createWebAutomationStateUpdate({
        activeContextId: String(tab.id),
        contexts: [compactObject({ contextId: String(tab.id), url: tab.url, title: tab.title, status: tab.status }) as JsonObject],
        recording: this.recordingState === "recording",
        state: createWebAutomationStateFromTabs(describeActiveTabLike(tab), [describeActiveTabLike(tab)], {
          timestamp: Date.now(),
          sourceId: eventSourceId(this.session.clientId),
          recording: this.recordingState === "recording",
          permissions: ["activeTab", "scripting", "storage", "tabs"]
        }) as unknown as JsonObject,
        metadata: { reason: "tab-updated", inputId: WEB_AUTOMATION_INPUT_IDS.browserState }
      }));
      await this.sendBrowserState();
    }
  }

  async selectAutomationTab(tabId: number): Promise<void> {
    const tab = await chrome.tabs.update(tabId, { active: true });
    if (tab.id !== tabId || unsupportedPageForUrl(tab.url)) {
      throw new Error("The requested automation tab is unavailable or unsupported.");
    }
    await this.handleTabUpdated({ ...tab, active: true });
  }

  handleNavigationCommitted(details: chrome.webNavigation.WebNavigationTransitionCallbackDetails): void {
    // Browser-provided transition metadata is more reliable than tabs.onUpdated,
    // which fires repeatedly for a single load (URL, title, and status changes).
    if (details.transitionType === "link" || details.transitionType === "form_submit" || details.transitionType === "reload") return;
    this.scheduleNavigation(details.tabId, details.url, details.timeStamp, details.transitionType === "typed");
  }

  handleHistoryStateUpdated(details: chrome.webNavigation.WebNavigationFramedCallbackDetails): void {
    this.scheduleNavigation(details.tabId, details.url, details.timeStamp, false);
  }

  private scheduleNavigation(tabId: number, url: string, timestamp: number, explicitlyTyped: boolean): void {
    if (this.recordingState !== "recording" || unsupportedPageForUrl(url)) return;
    this.navigation.schedule(tabId, url, () => void this.recordNavigation(tabId, url, timestamp, explicitlyTyped));
  }

  private async recordNavigation(tabId: number, url: string, timestamp: number, explicitlyTyped: boolean): Promise<void> {
    if (this.recordingState !== "recording") return;
    if (!this.navigation.shouldRecord(tabId, url, timestamp, explicitlyTyped, this.recordingStartedAt)) return;
    await this.handleRecordingEvent({
      kind: "browser.navigation",
      sequence: this.sequence.next(),
      url,
      title: "",
      eventTimestampMs: timestamp,
      metadata: explicitlyTyped ? { transition: "typed" } : undefined
    }, tabId);
  }

  private async processRecordingEvent(payload: RecordingEventPayload, tabId?: number, frameId?: number): Promise<void> {
    if (this.recordingState !== "recording") return;
    if (tabId !== undefined && isNavigationExplanation(payload)) {
      this.navigation.noteExplanatoryAction(tabId, payload.eventTimestampMs);
    }
    if (isExecutableRecordedAction(payload)) {
      this.eventCount += 1;
      this.addActivity(payload.kind, activityLabel(payload), activityDetail(payload));
      await this.gateway.send("client.recording_event", gatewayRecordingEventFromPayload(payload, tabId, frameId, this.activeRecordingId));
      await this.evidence.sendRecordingEvidence(payload, tabId, frameId);
      return;
    }
    if (payload.kind !== "content.ready") {
      this.addActivity(payload.kind, `Evidence: ${activityLabel(payload)}`, activityDetail(payload));
    }
    await this.evidence.sendRecordingEvidence(payload, tabId, frameId);
  }

  private async onMessage(message: ClientGatewayServerMessage): Promise<void> {
    this.gateway.noteMessageReceived();

    if (message.type === "server.ping") {
      this.gateway.noteMessageReceived();
      this.emitStatus();
      return;
    }

    if (message.type === "server.error") {
      this.lastError = message.payload.message;
      if (message.payload.code === "recording.project_required") {
        this.handleRecordingProjectRequired(message.payload.message);
        return;
      }
      this.gateway.markFailed();
      return;
    }

    if (message.type === "server.set_active_tab") {
      await this.handleServerCommandPayload({ ...message.payload, command: "set_active_tab" }, message.id);
      return;
    }
    if (message.type === "server.disconnect") {
      this.disconnect();
    }
  }

  private async onSessionReady(message: Extract<ClientGatewayServerMessage, { type: "server.session_ready" }>): Promise<void> {
    await this.persistSession(compactObject({
      ...this.session,
      sessionId: message.payload.sessionId,
      token: message.payload.token,
      ...(message.payload.projectId !== undefined ? { projectId: message.payload.projectId } : {}),
      serverUrl: this.settings.gatewayUrl,
      connectedAt: Date.now()
    }));
    this.gateway.markSessionReady();
    this.addActivity("connection", "Connected to FluxIQ", "Client session ready", "success");
    await this.sendBrowserState();
    await this.gateway.flushQueue();
  }

  private async handleServerCommandPayload(payload: ServerCommandPayload, messageId: string): Promise<void> {
    if (payload.command === "ping") {
      this.gateway.noteMessageReceived();
      this.emitStatus();
      return;
    }
    if (payload.command === "disconnect") {
      this.disconnect();
      return;
    }
    if (payload.command === "start_recording") {
      await this.beginAcceptedRecording(payload.recordingId, payload.projectId);
      return;
    }
    if (payload.command === "stop_recording") {
      await this.stopRecording(false);
      return;
    }
    if (payload.command === "set_active_tab") {
      const tabId = Number(payload.tabId);
      this.activeTabId = tabId;
      await chrome.tabs.update(tabId, { active: true });
      this.emitStatus();
      return;
    }
    if (payload.command === "capture_snapshot") {
      this.startRuntimeStatus({
        commandId: messageId,
        actionType: "web.dom.capture_snapshot",
        label: "Capture snapshot",
        target: this.activeTabUrl
      });
      await this.runtimeCommandRouter().captureSnapshot();
      this.finishRuntimeStatus({
        commandId: messageId,
        actionType: "web.dom.capture_snapshot",
        status: "succeeded",
        // Capturing evidence has no post-condition of its own to check.
        validation: { status: "none", reason: "evidence-only" },
        message: "Snapshot command dispatched.",
        startedAt: this.runtimeStatus.current().startedAt ?? Date.now(),
        finishedAt: Date.now()
      });
      return;
    }
    if (payload.command === "execute_action") {
      this.applyRuntimeStart(this.runtimeStatus.startAction(payload.action));
      await captureActionBoundary("before", payload.action);
      // The evidence observer brings the target page forward. Re-read Chrome's
      // authoritative active tab after that asynchronous boundary so a delayed
      // tabs.onActivated callback cannot leave runtime dispatch on a stale tab.
      await this.refreshActiveTab();
      await this.runtimeCommandRouter().executeAction(payload.action);
    }
  }

  private runtimeCommandRouter(): ExtensionRuntimeCommandRouter {
    return new ExtensionRuntimeCommandRouter({
      activeTabId: () => this.activeTabId,
      unsupportedPageReason: () => this.unsupportedPage?.reason,
      attachTabForRecording: (tabId) => this.attachment.attachTabForRecording(tabId),
      captureActiveSnapshot: (label) => this.evidence.captureActiveSnapshot(label),
      sendActionResult: (result, tabId, frameId) => this.sendActionResult(result, tabId, frameId)
    });
  }

  private async beginAcceptedRecording(recordingId: string, projectId?: string | null): Promise<void> {
    this.clearPendingRecordingStart();
    if (projectId !== undefined) {
      await this.persistSession(compactObject({ ...this.session, projectId }));
    }
    if (this.recordingState === "recording") {
      if (projectId !== undefined && this.projects.activeRecordingProject() !== projectId) {
        this.projects.setActiveRecordingProject(projectId);
        await this.evidence.captureActiveSnapshot("Project-linked snapshot captured");
      }
      return;
    }
    this.resetRecordingLog();
    this.navigation.clearRecordingTabs();
    this.recordingBlock = undefined;
    this.activeRecordingId = recordingId;
    this.projects.setActiveRecordingProject(projectId !== undefined ? projectId : this.session.projectId);
    this.eventCount = 0;
    this.activityLog.clearRecent();
    const recordingTabs = await allTabs();
    this.recordingStartedAt = Date.now();
    this.recordingState = "recording";
    for (const tab of recordingTabs) {
      if (tab.tabId < 0 || !tab.url || unsupportedPageForUrl(tab.url)) continue;
      this.navigation.seedRecordingTab(tab.tabId, tab.url, this.recordingStartedAt);
    }
    this.addActivity("recording", "Recording started", this.activeTabUrl ?? "Active tab", "success");
    this.emitStatus();
    if (this.activeTabId !== undefined) await this.attachment.attachTabForRecording(this.activeTabId);
    await this.sendBrowserState();
    await this.handleRecordingEvent({
      kind: "browser.tab",
      sequence: this.sequence.next(),
      url: this.activeTabUrl ?? "",
      title: "",
      eventTimestampMs: Date.now(),
      metadata: { recordingState: "started", recordingId }
    });
    await this.evidence.captureActiveSnapshot("Initial snapshot captured");
  }

  private handleRecordingProjectRequired(message: string): void {
    this.clearPendingRecordingStart();
    if (this.recordingState === "recording") {
      this.recordingState = "idle";
      this.clicks.clear();
      void this.attachment.broadcast({ type: "recording", recording: false, settings: this.settings }, false);
    }
    this.recordingStartedAt = undefined;
    this.activeRecordingId = undefined;
    this.projects.setActiveRecordingProject(undefined);
    this.recordingBlock = {
      code: "recording.project_required",
      title: "Project Required",
      message: message || "Open a FluxIQ project in the web panel before starting a recording."
    };
    this.lastError = "Open a FluxIQ project before recording.";
    this.addActivity("recording", "Recording locked", "Open a FluxIQ project in the web panel.", "warning");
    this.emitStatus();
  }

  private clearPendingRecordingStart(): void {
    if (!this.pendingRecordingStart) return;
    clearTimeout(this.pendingRecordingStart.timer);
    this.pendingRecordingStart = undefined;
  }

  // FluxIQ did not accept the start in time. Recording begins locally so no user
  // action is lost; the project link attaches later if one arrives.
  private async handleRecordingStartTimeout(recordingId: string): Promise<void> {
    if (!this.pendingRecordingStart || this.pendingRecordingStart.recordingId !== recordingId) return;
    const projectId = await this.projects.resolve("recording_start_timeout");
    await this.beginAcceptedRecording(recordingId, projectId ?? null);
    if (!projectId) {
      this.addActivity("recording", "Project context pending", "Structured state will record; screenshots attach after FluxIQ links a project.", "warning");
      this.emitStatus();
    }
  }

  private async sendBrowserState(): Promise<void> {
    await this.gateway.send("client.state_update", browserStateFromTabs(await activeTab(), await allTabs(), this.recordingState));
  }

  private async sendActionResult(result: BrowserActionResult, tabId?: number, frameId?: number): Promise<void> {
    this.finishRuntimeStatus({
      ...result,
      ...(tabId !== undefined ? { tabId } : {}),
      ...(frameId !== undefined ? { frameId } : {})
    });
    await captureActionBoundary("after", result);
    const visualTarget = result.visualTarget ?? (result.element
      ? webAutomationActionVisualTargetFromElement(result.element as never)
      : undefined);
    await this.gateway.send("client.action_result", gatewayActionResultFromBrowserResult(result));
    await this.sendRuntimeActionConfirmation(result, tabId, frameId);
    await this.handleRecordingEvent(compactObject({
      kind: "action.result",
      sequence: this.sequence.next(),
      url: result.url ?? this.activeTabUrl ?? "",
      title: result.title ?? "",
      eventTimestampMs: result.finishedAt,
      element: result.element,
      visualTarget,
      snapshot: result.snapshot,
      actionResult: result
    }), tabId, frameId);
  }

  // A succeeded runtime action is also something the recording must contain:
  // it is replayed as the recorded event a user would have produced.
  private async sendRuntimeActionConfirmation(result: BrowserActionResult, tabId?: number, frameId?: number): Promise<void> {
    if (result.status !== "succeeded") return;
    const confirmation = runtimeConfirmationForActionResult(result);
    if (!confirmation) return;
    const event = createWebAutomationRecordingEvent({
      kind: confirmation.kind,
      sequence: this.sequence.next(),
      url: result.url ?? this.activeTabUrl ?? "",
      title: result.title ?? "",
      eventTimestampMs: result.finishedAt,
      element: result.element as unknown as JsonObject | undefined,
      visualTarget: result.visualTarget as unknown as JsonObject | undefined,
      snapshot: result.snapshot as unknown as JsonObject,
      inputValue: confirmation.inputValue,
      key: confirmation.key,
      scroll: confirmation.scroll,
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
    await this.gateway.send("client.recording_event", event);
  }

  private async refreshActiveTab(): Promise<void> {
    const tab = await activeTab();
    this.activeTabId = tab?.tabId;
    this.activeTabUrl = tab?.url;
    this.unsupportedPage = unsupportedPageForUrl(tab?.url);
    this.emitStatus();
  }

  private async persistSession(session: FluxIQSession): Promise<void> {
    this.session = session;
    await writeSession(this.session);
  }

  private coreApiCredentials(): CoreApiCredentials {
    return { coreApiUrl: this.settings.coreApiUrl, token: this.session.token };
  }

  private emitStatus(): void {
    const status = this.status();
    for (const listener of this.listeners) listener(status);
    void chrome.runtime.sendMessage({ type: "fluxiq.statusChanged", status }).catch(() => undefined);
  }

  private addActivity(kind: string, label: string, detail?: string, tone: ActivityEntry["tone"] = "neutral"): void {
    this.activityLog.record(kind, label, detail, tone);
    this.emitStatus();
  }

  private resetRecordingLog(): void {
    this.eventCount = 0;
    this.activityLog.reset();
    this.clicks.clear();
  }

  private startRuntimeStatus(status: Omit<RuntimeCommandStatus, "state">): void {
    this.applyRuntimeStart(this.runtimeStatus.start(status));
  }

  private applyRuntimeStart(next: RuntimeCommandStatus): void {
    this.lastError = undefined;
    this.addActivity("runtime", `Runtime started: ${next.label ?? next.actionType ?? "Command"}`, next.target, "warning");
    this.emitStatus();
  }

  private finishRuntimeStatus(result: BrowserActionResult & { tabId?: number; frameId?: number }): void {
    const failed = result.status !== "succeeded";
    const label = runtimeActionLabel(result.actionType);
    this.runtimeStatus.finish(result);
    if (result.tabId !== undefined) this.activeTabId = result.tabId;
    if (result.url) this.activeTabUrl = result.url;
    if (failed) this.lastError = result.message ?? `${label} failed.`;
    this.addActivity(
      "runtime",
      failed ? `Runtime failed: ${label}` : `Runtime succeeded: ${label}`,
      result.message ?? runtimeResultTarget(result),
      failed ? "danger" : "success"
    );
    this.emitStatus();
  }
}
