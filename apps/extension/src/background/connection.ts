// The extension's connection to FluxIQ. It holds the session and settings, and
// it owns the order its collaborators run in; the work itself lives in
// ./connection, one responsibility per object:
//
//   ActivePage           where the browser is: the active tab and whether its
//                        page can be recorded or driven.
//   ActiveRecording      the recording in progress, and every transition into
//                        and out of one, the start handshake with FluxIQ included.
//   RecordedEventIntake  the one funnel every recorded event passes through,
//                        navigation included.
//   ServerCommandChannel what FluxIQ sends, the runtime command it runs, and the
//                        result that goes back.
//   TabRecorder          which tab switches and closes a recording keeps as actions.
//
// Beneath those sit the WebSocket session and its reconnection lifecycle, the
// activity log, the runtime command status, navigation and pointer-click
// filtering, project context, evidence capture, and Core's HTTP API.
//
// Every public method here is the dispatch point for code inside the object: a
// collaborator that needs one calls it back through a port, never at the
// collaborator that implements it, so a stub or override on the public method is
// still honoured. The delegations return the collaborator's promise rather than
// awaiting it, so moving a method here added no asynchronous step to its caller.

import type {
  ActivityEntry,
  CoreRecordingsPage,
  ExtensionStatus,
  FluxIQSession,
  FluxIQSettings,
  RecordingEventPayload,
  RecordingLogPage
} from "../shared/protocol";
import { activeTab, allTabFrames, allTabs, ensureContentScript, sendToTab } from "./tabs";
import { captureActionBoundary } from "./action-evidence";
import { clearQueuedEvents, queueEvent, readQueuedEvents, writeSession } from "./storage";
// Written as ".../index" because this file and its collaborators' directory are
// siblings of the same name: "./connection" would resolve back to this file.
import {
  ActivePage,
  ActiveRecording,
  ActivityLog,
  compactObject,
  ContentAttachment,
  EventSequence,
  fetchCoreRecordings,
  GatewaySession,
  NavigationRecorder,
  PointerClickFilter,
  ProjectContext,
  RecordedEventIntake,
  RecordingEvidenceReporter,
  RuntimeStatusTracker,
  ScriptedNavigationIntent,
  ServerCommandChannel,
  StateAssetStore,
  TabRecorder,
  type CoreApiCredentials,
  type TabSnapshotTransport
} from "./connection/index";

type StatusListener = (status: ExtensionStatus) => void;

export class FluxIQConnection {
  private lastError: string | undefined;
  private readonly listeners = new Set<StatusListener>();

  private readonly activityLog = new ActivityLog();
  private readonly sequence = new EventSequence();
  private readonly runtimeStatus = new RuntimeStatusTracker();
  private readonly navigation = new NavigationRecorder();
  private readonly scriptedNavigation: ScriptedNavigationIntent;
  private readonly clicks = new PointerClickFilter();
  private readonly transport: TabSnapshotTransport = { sendToTab, allTabFrames };
  private readonly gateway: GatewaySession;
  private readonly projects: ProjectContext;
  private readonly attachment: ContentAttachment;
  private readonly evidence: RecordingEvidenceReporter;
  private readonly tabs: TabRecorder;
  private readonly page: ActivePage;
  private readonly recording: ActiveRecording;
  private readonly intake: RecordedEventIntake;
  private readonly commands: ServerCommandChannel;

  // Construction order is dependency order: a collaborator handed to another as
  // an instance is built first. Anything reached through a closure is read when
  // it is called, never during construction, so it may be built later.
  constructor(
    private settings: FluxIQSettings,
    private session: FluxIQSession
  ) {
    const onActivity = (kind: string, label: string, detail?: string, tone?: ActivityEntry["tone"]) => this.addActivity(kind, label, detail, tone);
    const emitStatus = () => this.emitStatus();
    const setLastError = (message: string | undefined) => { this.lastError = message; };
    // Forwards exactly the arguments it was given, so an override on the public
    // method sees the same call a direct `this.handleRecordingEvent(...)` made.
    const recordEvent = (...args: Parameters<FluxIQConnection["handleRecordingEvent"]>) => this.handleRecordingEvent(...args);

    this.scriptedNavigation = new ScriptedNavigationIntent({
      recordingState: () => this.recording.state(),
      activeTabId: () => this.page.tabId(),
      recordNavigation: (tabId, url, timestamp) => this.intake.recordScriptedNavigation(tabId, url, timestamp)
    });

    this.gateway = new GatewaySession({
      settings: () => this.settings,
      session: () => this.session,
      persistSession: (session) => this.persistSession(session),
      emitStatus,
      reportError: (message) => { this.lastError = message; },
      clearError: () => { this.lastError = undefined; },
      beforeConnect: () => this.page.refresh(),
      queue: { queueEvent, readQueuedEvents, clearQueuedEvents },
      handlers: {
        onServerMessage: (message) => void this.commands.handleMessage(message),
        onPairingRequired: (referenceCode, reason) => {
          this.lastError = reason || "Approve this client in FluxIQ.";
          this.addActivity("pairing", "Waiting for approval", referenceCode ? `Reference ${referenceCode}` : undefined, "warning");
          this.emitStatus();
        },
        onSessionReady: (message) => void this.commands.handleSessionReady(message),
        onCommand: (payload, messageId) => void this.commands.handleCommand(payload, messageId),
        onHeartbeat: () => void this.page.sendBrowserState()
      }
    });
    this.projects = new ProjectContext({
      settings: () => this.settings,
      session: () => this.session,
      adoptProjectId: (projectId) => this.persistSession(compactObject({ ...this.session, projectId })),
      onActivity
    });
    this.attachment = new ContentAttachment({
      sendToTab,
      ensureContentScript,
      settings: () => this.settings,
      isRecording: () => this.recording.state() === "recording",
      hasRecordedTab: (tabId) => this.navigation.hasRecordedTab(tabId),
      noteRecordedTab: (tabId, url, timestamp) => this.navigation.noteRecordedTab(tabId, url, timestamp)
    });
    this.evidence = new RecordingEvidenceReporter({
      send: this.gateway.send,
      recordingState: () => this.recording.state(),
      resolveProjectId: (reason) => this.projects.resolve(reason),
      onActivity,
      emitStatus,
      clientId: () => this.session.clientId,
      activeTabId: () => this.page.tabId(),
      activeTabUrl: () => this.page.url(),
      unsupportedPage: () => this.page.unsupported(),
      setUnsupportedPage: (state) => this.page.setUnsupported(state),
      transport: this.transport,
      ensureContentScript,
      attachTabForRecording: (tabId) => this.attachment.attachTabForRecording(tabId),
      activeTab,
      allTabs,
      stateAssets: new StateAssetStore({
        credentials: () => this.coreApiCredentials(),
        onActivity
      }),
      screenshotDiagnostics: () => ({
        sessionId: this.session.sessionId,
        clientId: this.session.clientId,
        projectId: this.session.projectId,
        activeRecordingProjectId: this.projects.activeRecordingProject(),
        activeTabId: this.page.tabId(),
        coreApiUrl: this.settings.coreApiUrl
      })
    });
    this.tabs = new TabRecorder({
      recordingState: () => this.recording.state(),
      recordingId: () => this.recording.recordingId(),
      runtimeBusy: () => this.runtimeStatus.current().state === "running",
      sequence: this.sequence,
      recordEvent
    });
    this.page = new ActivePage({
      send: this.gateway.send,
      gatewayState: () => this.gateway.state(),
      clientId: () => this.session.clientId,
      recordingState: () => this.recording.state(),
      attachTabForRecording: (tabId) => this.attachment.attachTabForRecording(tabId),
      activeTab,
      allTabs,
      onActivity,
      emitStatus,
      updateTab: (tab) => this.handleTabUpdated(tab),
      noteTabChange: (tab, lastActive) => this.tabs.noteTabUpdate(tab, lastActive),
      noteTabRemoved: (tabId, lastActive) => this.tabs.noteTabRemoved(tabId, lastActive)
    });
    this.recording = new ActiveRecording({
      send: this.gateway.send,
      gatewayState: () => this.gateway.state(),
      session: () => this.session,
      settings: () => this.settings,
      persistSession: (session) => this.persistSession(session),
      page: this.page,
      projects: this.projects,
      evidence: this.evidence,
      attachment: this.attachment,
      navigation: this.navigation,
      scriptedNavigation: this.scriptedNavigation,
      clicks: this.clicks,
      sequence: this.sequence,
      activityLog: this.activityLog,
      allTabs,
      recordEvent,
      onActivity,
      emitStatus,
      lastError: () => this.lastError,
      setLastError
    });
    this.intake = new RecordedEventIntake({
      send: this.gateway.send,
      recording: this.recording,
      page: this.page,
      navigation: this.navigation,
      scriptedNavigation: this.scriptedNavigation,
      clicks: this.clicks,
      sequence: this.sequence,
      evidence: this.evidence,
      attachment: this.attachment,
      sendToTab,
      onActivity,
      recordEvent
    });
    this.commands = new ServerCommandChannel({
      send: this.gateway.send,
      gateway: this.gateway,
      recording: this.recording,
      page: this.page,
      runtimeStatus: this.runtimeStatus,
      attachment: this.attachment,
      evidence: this.evidence,
      sequence: this.sequence,
      session: () => this.session,
      settings: () => this.settings,
      persistSession: (session) => this.persistSession(session),
      captureActionBoundary,
      setLastError,
      onActivity,
      emitStatus,
      recordEvent,
      stopRecording: (notifyServer) => this.stopRecording(notifyServer),
      disconnect: () => this.disconnect()
    });
  }

  status(): ExtensionStatus {
    const gateway = this.gateway.statusFields();
    const status: ExtensionStatus = {
      connectionState: gateway.connectionState,
      recordingState: this.recording.state(),
      gatewayUrl: this.settings.gatewayUrl,
      settings: this.settings,
      clientId: this.session.clientId,
      queueSize: gateway.queueSize,
      eventCount: this.recording.eventCount(),
      recentActivities: this.activityLog.recentEntries(),
      runtime: { ...this.runtimeStatus.current() }
    };
    const lastActivityAt = this.activityLog.lastActivityAt();
    const activeTabId = this.page.tabId();
    const activeTabUrl = this.page.url();
    const recordingStartedAt = this.recording.startedAt();
    const unsupportedPage = this.page.unsupported();
    const recordingBlock = this.recording.block();
    if (this.session.sessionId) status.sessionId = this.session.sessionId;
    if (this.session.projectId !== undefined) status.projectId = this.session.projectId;
    if (activeTabId !== undefined) status.activeTabId = activeTabId;
    if (activeTabUrl) status.activeTabUrl = activeTabUrl;
    if (gateway.pairingReferenceCode) status.pairingReferenceCode = gateway.pairingReferenceCode;
    if (recordingStartedAt !== undefined) status.recordingStartedAt = recordingStartedAt;
    if (lastActivityAt !== undefined) status.lastActivityAt = lastActivityAt;
    if (unsupportedPage) status.unsupportedPage = unsupportedPage;
    if (recordingBlock) status.recordingBlock = recordingBlock;
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
    this.scriptedNavigation.cancelAll("cancelled");
    this.gateway.stopReconnecting();
    this.recording.cancelStart();
    this.gateway.closeClient();
    if (this.recording.state() === "recording") this.addActivity("connection", "Disconnected during recording", "Events will queue until reconnect.", "warning");
    this.gateway.markDisconnected();
  }

  startRecording(): Promise<void> {
    return this.recording.start();
  }

  stopRecording(notifyServer = true): Promise<void> {
    return this.recording.stop(notifyServer);
  }

  dismissRecordingBlock(): void {
    this.recording.dismissBlock();
  }

  handleRecordingEvent(payload: RecordingEventPayload, tabId?: number, frameId?: number, admittedNavigation = false): Promise<void> {
    return this.intake.accept(payload, tabId, frameId, admittedNavigation);
  }

  handleContentReady(payload: RecordingEventPayload, tabId?: number, frameId?: number): Promise<void> {
    return this.intake.acceptContentReady(payload, tabId, frameId);
  }

  handleTabUpdated(tab: chrome.tabs.Tab): Promise<void> {
    return this.page.handleTabUpdate(tab);
  }

  handleTabRemoved(tabId: number): Promise<void> {
    this.scriptedNavigation.cancelTab(tabId);
    return this.page.handleTabRemoved(tabId);
  }

  armScriptedNavigation(url: unknown) {
    return this.scriptedNavigation.arm(url);
  }

  awaitScriptedNavigation(intentId: unknown) {
    return this.scriptedNavigation.await(intentId);
  }

  cancelScriptedNavigation(intentId: unknown): boolean {
    return this.scriptedNavigation.cancel(intentId);
  }

  selectAutomationTab(tabId: number): Promise<void> {
    return this.page.select(tabId);
  }

  handleNavigationCommitted(details: chrome.webNavigation.WebNavigationTransitionCallbackDetails): void {
    this.intake.noteNavigationCommitted(details);
  }

  handleHistoryStateUpdated(details: chrome.webNavigation.WebNavigationFramedCallbackDetails): void {
    this.intake.noteHistoryStateUpdated(details);
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
}
