import {
  FluxIQClientGatewayWebSocketClient,
  createClientGatewayMessage
} from "@fluxiq/client-gateway-websocket";
import {
  createWebAutomationRecordingEvent,
  createWebAutomationStateUpdate,
  createWebAutomationStateFromSnapshot,
  createWebAutomationStateFromTabs,
  WEB_AUTOMATION_INPUT_IDS,
  webAutomationInputIdForRecordedEvent,
  webAutomationActionVisualTargetFromElement,
  webAutomationActionResultPayload,
  WEB_AUTOMATION_DOMAIN_ID
} from "@fluxiq-web-extension/domain/client";
import {
  DEFAULT_CORE_API_URL,
  HEARTBEAT_INTERVAL_MS,
  RECONNECT_BASE_DELAY_MS,
  RECONNECT_MAX_DELAY_MS
} from "../shared/constants";
import { browserDescriptor } from "../shared/browser";
import {
  browserExtensionCapabilities,
  type BrowserActionResult,
  type ClientGatewayClientHello,
  type ClientGatewayClientMessage,
  type ClientGatewayRecordingEvent,
  type ClientGatewayServerMessage,
  type ClientGatewaySnapshot,
  type ClientGatewayStateUpdate,
  type ClientGatewayCapability,
  type ConnectionState,
  type ExtensionStatus,
  type FluxIQSession,
  type FluxIQSettings,
  type JsonObject,
  type RecordingEventPayload,
  type RecordingState,
  type ServerCommandPayload,
  type BrowserActionCommand,
  type ActivityEntry,
  type CoreRecordingsPage,
  type CoreRecordingSummary,
  type RecordingLogPage,
  type RecordingBlockState,
  type UnsupportedPageState,
  type RuntimeCommandStatus
} from "../shared/protocol";
import { activeTab, allTabFrames, allTabs, ensureContentScript, sendToTab } from "./tabs";
import { captureActionBoundary } from "./action-evidence";
import { clearQueuedEvents, queueEvent, readQueuedEvents, writeSession } from "./storage";
import { ExtensionRuntimeCommandRouter, browserActionFromGatewayCommand, gatewayActionResultFromBrowserResult } from "../runtime";

type StatusListener = (status: ExtensionStatus) => void;
type DomSnapshotPayload = Parameters<typeof createWebAutomationStateFromSnapshot>[0];
type ScreenImageSize = { width: number; height: number };
type VisualStateSample = { snapshot?: DomSnapshotPayload; screenContentRef?: string; screenImageSize?: ScreenImageSize; capturedAt?: number };

const POINTER_CLICK_SUPPRESS_DELAY_MS = 750;
const FRAME_SNAPSHOT_TIMEOUT_MS = 150;

export class FluxIQConnection {
  private client: FluxIQClientGatewayWebSocketClient | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private reconnectAttempt = 0;
  private connectionState: ConnectionState = "disconnected";
  private recordingState: RecordingState = "idle";
  private lastError: string | undefined;
  private lastMessageAt: number | undefined;
  private activeTabId: number | undefined;
  private activeTabUrl: string | undefined;
  private pairingReferenceCode: string | undefined;
  private queueSize = 0;
  private shouldStayConnected = false;
  private eventCount = 0;
  private recordingStartedAt: number | undefined;
  private activeRecordingId: string | undefined;
  private activeRecordingProjectId: string | null | undefined;
  private pendingRecordingStart: { recordingId: string; timer: ReturnType<typeof setTimeout> } | undefined;
  private recordingBlock: RecordingBlockState | undefined;
  private lastScreenshotSkipAt: number | undefined;
  private readonly suppressedPointerClicks = new Map<string, ReturnType<typeof setTimeout>>();
  private lastActivityAt: number | undefined;
  private unsupportedPage: UnsupportedPageState | undefined;
  private readonly recentExplanatoryActions = new Map<number, number>();
  private readonly pendingNavigations = new Map<number, { url: string; timer: ReturnType<typeof setTimeout> }>();
  private readonly lastRecordedNavigation = new Map<number, { url: string; timestamp: number }>();
  private readonly recordingInitialNavigation = new Map<number, string>();
  private backgroundEventSequence = 0;
  private readonly recentActivities: ActivityEntry[] = [];
  private readonly recordingLog: ActivityEntry[] = [];
  private readonly listeners = new Set<StatusListener>();
  private runtimeStatus: RuntimeCommandStatus = { state: "idle" };

  constructor(
    private settings: FluxIQSettings,
    private session: FluxIQSession
  ) {}

  status(): ExtensionStatus {
    const status: ExtensionStatus = {
      connectionState: this.connectionState,
      recordingState: this.recordingState,
      gatewayUrl: this.settings.gatewayUrl,
      settings: this.settings,
      clientId: this.session.clientId,
      queueSize: this.queueSize,
      eventCount: this.eventCount,
      recentActivities: [...this.recentActivities],
      runtime: { ...this.runtimeStatus }
    };
    if (this.session.sessionId) status.sessionId = this.session.sessionId;
    if (this.session.projectId !== undefined) status.projectId = this.session.projectId;
    if (this.activeTabId !== undefined) status.activeTabId = this.activeTabId;
    if (this.activeTabUrl) status.activeTabUrl = this.activeTabUrl;
    if (this.pairingReferenceCode) status.pairingReferenceCode = this.pairingReferenceCode;
    if (this.recordingStartedAt !== undefined) status.recordingStartedAt = this.recordingStartedAt;
    if (this.lastActivityAt !== undefined) status.lastActivityAt = this.lastActivityAt;
    if (this.unsupportedPage) status.unsupportedPage = this.unsupportedPage;
    if (this.recordingBlock) status.recordingBlock = this.recordingBlock;
    if (this.lastError) status.lastError = this.lastError;
    if (this.lastMessageAt !== undefined) status.lastMessageAt = this.lastMessageAt;
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
    const normalizedPageSize = Math.min(100, Math.max(5, Math.floor(pageSize) || 25));
    const normalizedPage = Math.max(1, Math.floor(page) || 1);
    const start = (normalizedPage - 1) * normalizedPageSize;
    return {
      items: this.recordingLog.slice(start, start + normalizedPageSize),
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total: this.recordingLog.length
    };
  }

  async listCoreRecordings(page: number, pageSize: number): Promise<CoreRecordingsPage> {
    const normalizedPageSize = Math.min(50, Math.max(5, Math.floor(pageSize) || 10));
    const normalizedPage = Math.max(1, Math.floor(page) || 1);
    const sourceUrl = recordingsApiUrl(this.settings.coreApiUrl, normalizedPage, normalizedPageSize);
    const response = await fetch(sourceUrl, {
      headers: compactObject({
        accept: "application/json",
        ...(this.session.token ? { authorization: `Bearer ${this.session.token}` } : {})
      }) as Record<string, string>
    });
    if (!response.ok) throw new Error(`FluxIQ recordings API returned ${response.status}.`);
    return normalizeRecordingsResponse(await response.json(), normalizedPage, normalizedPageSize, sourceUrl);
  }

  async connect(): Promise<void> {
    this.shouldStayConnected = true;
    this.clearReconnect();
    this.setState("connecting");
    await this.refreshActiveTab();
    await this.client?.close();
    const client = new FluxIQClientGatewayWebSocketClient({
      url: this.settings.gatewayUrl,
      client: this.clientHello(),
      WebSocketImpl: WebSocket as never,
      tokenStorage: {
        read: () => this.session.token,
        write: async (token) => {
          this.session = compactObject({
            ...this.session,
            token,
            serverUrl: this.settings.gatewayUrl,
            connectedAt: Date.now()
          });
          await writeSession(this.session);
        },
        clear: async () => {
          this.session = compactObject({
            clientId: this.session.clientId,
            sessionId: this.session.sessionId,
            projectId: this.session.projectId,
            serverUrl: this.settings.gatewayUrl,
            connectedAt: this.session.connectedAt
          });
          await writeSession(this.session);
        }
      }
    });
    this.client = client;
    this.attachClientHandlers(client);
    try {
      await client.connect();
    } catch {
      this.onError("WebSocket connection failed.");
      if (this.shouldStayConnected && this.settings.autoReconnect) this.scheduleReconnect();
    }
  }

  disconnect(): void {
    this.shouldStayConnected = false;
    this.clearReconnect();
    this.clearPendingRecordingStart();
    this.stopHeartbeat();
    void this.client?.close();
    this.client = null;
    if (this.recordingState === "recording") this.addActivity("connection", "Disconnected during recording", "Events will queue until reconnect.", "warning");
    this.setState("disconnected");
  }

  async startRecording(): Promise<void> {
    if (this.pendingRecordingStart) {
      this.addActivity("recording", "Recording is starting", "Waiting for FluxIQ project acceptance.", "warning");
      return;
    }
    if (this.connectionState !== "connected") {
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
    const projectId = await this.resolveRecordingProjectId("recording_start");
    const initialState = await this.buildInitialRecordingState(startedAt);
    await this.sendClientMessage("client.start_recording", {
      recordingId,
      ...(projectId ? { projectId } : {}),
      startedAt,
      domainId: WEB_AUTOMATION_DOMAIN_ID,
      initialState: initialState as unknown as JsonObject,
      environment: this.recordingEnvironment(),
      sources: this.recordingSources(),
      actionChannels: this.recordingActionChannels(),
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
      timer: setTimeout(() => void this.handleRecordingStartTimeout(recordingId), 750)
    };
    this.emitStatus();
  }

  async stopRecording(notifyServer = true): Promise<void> {
    if (this.recordingState !== "recording") return;
    const recordingId = this.activeRecordingId;
    const projectId = this.activeRecordingProjectId;
    const endedAt = Date.now();
    const stopPayload = recordingId
      ? compactObject({
          recordingId,
          ...(projectId !== undefined ? { projectId } : {}),
          endedAt
        })
      : undefined;
    this.recordingState = "idle";
    this.clearPendingPointerClicks();
    this.activeRecordingId = undefined;
    this.activeRecordingProjectId = undefined;
    this.addActivity("recording", "Recording stopped", `${this.eventCount} user actions captured`, "neutral");
    this.emitStatus();
    void this.broadcastToContent({ type: "recording", recording: false, settings: this.settings }, false);
    if (notifyServer && stopPayload) {
      await this.sendClientMessage("client.stop_recording", stopPayload);
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
        if (this.isSuppressedClickDuplicate(signature)) return;
        this.suppressNextClickDuplicate(signature);
        await this.processRecordingEvent(payload, tabId, frameId);
        return;
      }
      if (sourceEvent === "click" && signature && this.isSuppressedClickDuplicate(signature)) {
        return;
      }
    }
    await this.processRecordingEvent(payload, tabId, frameId);
  }

  async handleContentReady(payload: RecordingEventPayload, tabId?: number, frameId?: number): Promise<void> {
    let readyPayload = payload;
    if (this.recordingState === "recording" && tabId !== undefined && !this.unsupportedPage) {
      await this.setContentRecordingState(tabId, true, frameId).catch(() => undefined);
      if (!payload.snapshot) {
        const snapshot = await sendToTab(tabId, { type: "captureSnapshot" }, frameId)
          .then((value) => isDomSnapshotPayload(value) ? value : undefined)
          .catch(() => undefined);
        if (snapshot) readyPayload = { ...payload, snapshot };
      }
    }
    await this.handleRecordingEvent(readyPayload, tabId, frameId);
  }

  private async processRecordingEvent(payload: RecordingEventPayload, tabId?: number, frameId?: number): Promise<void> {
    if (this.recordingState !== "recording") return;
    if (tabId !== undefined && isNavigationExplanation(payload)) {
      this.recentExplanatoryActions.set(tabId, payload.eventTimestampMs);
    }
    if (isExecutableRecordedAction(payload)) {
      this.eventCount += 1;
      this.addActivity(payload.kind, activityLabel(payload), activityDetail(payload));
      await this.sendClientMessage("client.recording_event", gatewayRecordingEventFromPayload(payload, tabId, frameId, this.activeRecordingId));
      await this.sendRecordingEvidence(payload, tabId, frameId);
      return;
    }
    if (payload.kind !== "content.ready") {
      this.addActivity(payload.kind, `Evidence: ${activityLabel(payload)}`, activityDetail(payload));
    }
    await this.sendRecordingEvidence(payload, tabId, frameId);
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
      await this.attachTabForRecording(tab.id).catch(() => undefined);
      if (becameActive) this.addActivity("tab", "Recording active tab", tab.url ?? `Tab ${tab.id}`);
    }
    if (this.connectionState === "connected") {
      await this.sendClientMessage("client.state_update", createWebAutomationStateUpdate({
        activeContextId: String(tab.id),
        contexts: [compactObject({ contextId: String(tab.id), url: tab.url, title: tab.title, status: tab.status }) as JsonObject],
        recording: this.recordingState === "recording",
        state: createWebAutomationStateFromTabs(describeActiveTabLike(tab), [describeActiveTabLike(tab)], {
          timestamp: Date.now(),
          sourceId: this.eventSourceId(),
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
    const existing = this.pendingNavigations.get(tabId);
    if (existing) clearTimeout(existing.timer);
    const timer = setTimeout(() => {
      this.pendingNavigations.delete(tabId);
      void this.recordNavigation(tabId, url, timestamp, explicitlyTyped);
    }, 250);
    this.pendingNavigations.set(tabId, { url, timer });
  }

  private async recordNavigation(tabId: number, url: string, timestamp: number, explicitlyTyped: boolean): Promise<void> {
    if (this.recordingState !== "recording") return;
    // A navigation committed before recording can still be waiting in the
    // debounce queue when the session starts. It belongs to setup, not the recording.
    if (this.recordingStartedAt !== undefined && timestamp <= this.recordingStartedAt) return;
    const initialUrl = this.recordingInitialNavigation.get(tabId);
    if (initialUrl === url && this.recordingStartedAt !== undefined && Date.now() - this.recordingStartedAt < 10_000) {
      this.recordingInitialNavigation.delete(tabId);
      return;
    }
    const explainedAt = this.recentExplanatoryActions.get(tabId);
    // Let the click message arrive before classifying the URL update. A typed
    // omnibox navigation remains intentional even if it follows a click.
    if (!explicitlyTyped && explainedAt !== undefined && timestamp - explainedAt >= 0 && timestamp - explainedAt < 5_000) return;
    const previous = this.lastRecordedNavigation.get(tabId);
    if (previous?.url === url) return;
    this.lastRecordedNavigation.set(tabId, { url, timestamp });
    await this.handleRecordingEvent({
      kind: "browser.navigation",
      sequence: this.nextBackgroundEventSequence(),
      url,
      title: "",
      eventTimestampMs: timestamp,
      metadata: explicitlyTyped ? { transition: "typed" } : undefined
    }, tabId);
  }

  private async onOpen(): Promise<void> {
    this.reconnectAttempt = 0;
    this.lastError = undefined;
    this.setState(this.session.token ? "connecting" : "pairing");
    this.startHeartbeat();
  }

  private nextBackgroundEventSequence(): number {
    // Event IDs include this sequence. Date.now() alone collides when related
    // startup events are emitted in the same millisecond.
    this.backgroundEventSequence = (this.backgroundEventSequence + 1) % 1_000;
    return Date.now() * 1_000 + this.backgroundEventSequence;
  }

  private onClose(): void {
    this.stopHeartbeat();
    this.client = null;
    if (this.shouldStayConnected && this.settings.autoReconnect) {
      this.scheduleReconnect();
    } else {
      this.setState("disconnected");
    }
  }

  private onError(message: string): void {
    this.lastError = message;
    this.setState("error");
  }

  private clientHello(): Omit<ClientGatewayClientHello, "token"> & { token?: string } {
    return {
      clientId: this.session.clientId,
      clientType: "extension",
      name: "FluxIQ Browser Extension",
      version: browserDescriptor().extensionVersion,
      ...(this.session.token !== undefined ? { token: this.session.token } : {}),
      capabilities: browserExtensionCapabilities,
      metadata: {
        domainId: WEB_AUTOMATION_DOMAIN_ID,
        browser: browserDescriptor() as unknown as JsonObject,
        settings: {
          captureMutations: this.settings.captureMutations,
          captureInputValues: this.settings.captureInputValues,
          captureSnapshots: this.settings.captureSnapshots
        }
      }
    };
  }

  private attachClientHandlers(client: FluxIQClientGatewayWebSocketClient): void {
    client.on("open", () => void this.onOpen());
    client.on("close", () => this.onClose());
    client.on("error", () => this.onError("WebSocket connection failed."));
    client.on("message", ({ message }) => void this.onMessage(message));
    client.on("pairing_required", ({ message }) => {
      this.pairingReferenceCode = message.payload.referenceCode;
      this.setState("pairing");
      this.lastError = message.payload.reason || "Approve this client in FluxIQ.";
      this.addActivity("pairing", "Waiting for approval", this.pairingReferenceCode ? `Reference ${this.pairingReferenceCode}` : undefined, "warning");
      this.emitStatus();
    });
    client.on("session_ready", ({ message }) => void this.onSessionReady(message));
    client.on("start_recording", ({ message }) => void this.handleServerCommandPayload({ ...message.payload, command: "start_recording" }, message.id));
    client.on("stop_recording", ({ message }) => void this.handleServerCommandPayload({ ...message.payload, command: "stop_recording" }, message.id));
    client.on("capture_snapshot", ({ message }) => void this.handleServerCommandPayload({ ...message.payload, command: "capture_snapshot" }, message.id));
    client.on("execute_action", ({ message }) => void this.handleServerCommandPayload({ command: "execute_action", action: browserActionFromGatewayCommand(message.payload) }, message.id));
  }

  private async onMessage(message: ClientGatewayServerMessage): Promise<void> {
    this.lastMessageAt = Date.now();

    if (message.type === "server.ping") {
      this.lastMessageAt = Date.now();
      this.emitStatus();
      return;
    }

    if (message.type === "server.error") {
      this.lastError = message.payload.message;
      if (message.payload.code === "recording.project_required") {
        this.handleRecordingProjectRequired(message.payload.message);
        return;
      }
      this.setState("error");
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
    this.session = compactObject({
      ...this.session,
      sessionId: message.payload.sessionId,
      token: message.payload.token,
      ...(message.payload.projectId !== undefined ? { projectId: message.payload.projectId } : {}),
      serverUrl: this.settings.gatewayUrl,
      connectedAt: Date.now()
    });
    this.pairingReferenceCode = undefined;
    await writeSession(this.session);
    this.setState("connected");
    this.addActivity("connection", "Connected to FluxIQ", "Client session ready", "success");
    await this.sendBrowserState();
    await this.flushQueue();
  }

  private async handleServerCommandPayload(payload: ServerCommandPayload, messageId: string): Promise<void> {
    if (payload.command === "ping") {
      this.lastMessageAt = Date.now();
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
        message: "Snapshot command dispatched.",
        startedAt: this.runtimeStatus.startedAt ?? Date.now(),
        finishedAt: Date.now()
      });
      return;
    }
    if (payload.command === "execute_action") {
      this.startRuntimeAction(payload.action);
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
      attachTabForRecording: (tabId) => this.attachTabForRecording(tabId),
      captureActiveSnapshot: (label) => this.captureActiveSnapshot(label),
      sendActionResult: (result, tabId, frameId) => this.sendActionResult(result, tabId, frameId)
    });
  }

  private async beginAcceptedRecording(recordingId: string, projectId?: string | null): Promise<void> {
    this.clearPendingRecordingStart();
    if (projectId !== undefined) {
      this.session = compactObject({ ...this.session, projectId });
      await writeSession(this.session);
    }
    if (this.recordingState === "recording") {
      if (projectId !== undefined && this.activeRecordingProjectId !== projectId) {
        this.activeRecordingProjectId = projectId;
        await this.captureActiveSnapshot("Project-linked snapshot captured");
      }
      return;
    }
    this.resetRecordingLog();
    this.lastRecordedNavigation.clear();
    this.recordingInitialNavigation.clear();
    this.recordingBlock = undefined;
    this.activeRecordingId = recordingId;
    this.activeRecordingProjectId = projectId !== undefined ? projectId : this.session.projectId;
    this.eventCount = 0;
    this.recentActivities.length = 0;
    const recordingTabs = await allTabs();
    this.recordingStartedAt = Date.now();
    this.recordingState = "recording";
    for (const tab of recordingTabs) {
      if (tab.tabId < 0 || !tab.url || unsupportedPageForUrl(tab.url)) continue;
      this.lastRecordedNavigation.set(tab.tabId, { url: tab.url, timestamp: this.recordingStartedAt });
      this.recordingInitialNavigation.set(tab.tabId, tab.url);
    }
    this.addActivity("recording", "Recording started", this.activeTabUrl ?? "Active tab", "success");
    this.emitStatus();
    if (this.activeTabId !== undefined) await this.attachTabForRecording(this.activeTabId);
    await this.sendBrowserState();
    await this.handleRecordingEvent({
      kind: "browser.tab",
      sequence: this.nextBackgroundEventSequence(),
      url: this.activeTabUrl ?? "",
      title: "",
      eventTimestampMs: Date.now(),
      metadata: { recordingState: "started", recordingId }
    });
    await this.captureActiveSnapshot("Initial snapshot captured");
  }

  private handleRecordingProjectRequired(message: string): void {
    this.clearPendingRecordingStart();
    if (this.recordingState === "recording") {
      this.recordingState = "idle";
      this.clearPendingPointerClicks();
      void this.broadcastToContent({ type: "recording", recording: false, settings: this.settings }, false);
    }
    this.recordingStartedAt = undefined;
    this.activeRecordingId = undefined;
    this.activeRecordingProjectId = undefined;
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

  private async handleRecordingStartTimeout(recordingId: string): Promise<void> {
    if (!this.pendingRecordingStart || this.pendingRecordingStart.recordingId !== recordingId) return;
    const projectId = await this.resolveRecordingProjectId("recording_start_timeout");
    await this.beginAcceptedRecording(recordingId, projectId ?? null);
    if (!projectId) {
      this.addActivity("recording", "Project context pending", "Structured state will record; screenshots attach after FluxIQ links a project.", "warning");
      this.emitStatus();
    }
  }

  private async sendBrowserState(): Promise<void> {
    await this.sendClientMessage("client.state_update", browserStateFromTabs(await activeTab(), await allTabs(), this.recordingState));
  }

  private async sendRecordingEvidence(payload: RecordingEventPayload, tabId?: number, frameId?: number): Promise<void> {
    if (this.recordingState !== "recording") return;
    const projectId = await this.resolveRecordingProjectId("recording_evidence");
    if (this.recordingState !== "recording") return;
    const snapshot = await this.captureDomSnapshotForEvidence(payload, tabId, frameId);
    if (this.recordingState !== "recording") return;
    const hasDomSnapshot = isDomSnapshotPayload(snapshot);
    const state = hasDomSnapshot
      ? await this.createStateFromDomSnapshot(snapshot, {
          timestamp: payload.eventTimestampMs,
          eventKey: stateScreenshotEventKey(payload),
          ...(projectId ? { projectId } : {}),
          ...(tabId === undefined ? {} : {
            sourceId: this.tabSourceId(tabId),
            tabId
          })
        })
      : compactObject({
          latestEvidence: recordingEvidencePayload(payload)
        }) as JsonObject;
    if (this.recordingState !== "recording") return;
    const stateTimestampMs = numberValue(objectValue(state)?.timestamp) ?? payload.eventTimestampMs;
    if (hasDomSnapshot) {
      const snapshotId = stateSnapshotIdFromPayload(payload);
      await this.sendClientMessage("client.snapshot", compactObject({
        snapshotId,
        timestamp: stateTimestampMs,
        kind: "state",
        state,
        metadata: compactObject({
          reason: "recording-evidence",
          clientKind: payload.kind,
          eventTimestampMs: payload.eventTimestampMs,
          stateTimestampMs,
          sequence: payload.sequence,
          ...(tabId === undefined ? {} : { tabId }),
          ...(frameId === undefined ? {} : { frameId }),
          ...(payload.metadata ?? {})
        }) as JsonObject
      } satisfies ClientGatewaySnapshot));
      return;
    }
    await this.sendClientMessage("client.state_update", createWebAutomationStateUpdate({
      ...(tabId === undefined ? {} : { activeContextId: String(tabId) }),
      state,
      metadata: compactObject({
        reason: "recording-evidence",
        inputId: WEB_AUTOMATION_INPUT_IDS.recordingEvidence,
        clientKind: payload.kind,
        eventTimestampMs: payload.eventTimestampMs,
        stateTimestampMs,
        ...(tabId === undefined ? {} : { tabId }),
        ...(frameId === undefined ? {} : { frameId }),
        ...(payload.metadata ?? {})
      }) as JsonObject
    }));
  }

  private async captureDomSnapshotForEvidence(
    payload: RecordingEventPayload,
    tabId?: number,
    frameId?: number
  ): Promise<RecordingEventPayload["snapshot"] | undefined> {
    if (tabId === undefined || this.unsupportedPage || !shouldRequireStateForEvidence(payload)) return undefined;
    try {
      await ensureContentScript(tabId);
      const snapshot = await this.captureMergedTabSnapshot(tabId, isDomSnapshotPayload(payload.snapshot) ? payload.snapshot : undefined, frameId);
      if (isDomSnapshotPayload(snapshot)) {
        console.info("FluxIQ evidence snapshot recovered", {
          kind: payload.kind,
          sequence: payload.sequence,
          tabId,
          frameId
        });
        return snapshot;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Fallback DOM snapshot failed.";
      console.warn("FluxIQ evidence snapshot unavailable", {
        kind: payload.kind,
        sequence: payload.sequence,
        tabId,
        frameId,
        message
      });
    }
    return undefined;
  }

  private async captureMergedTabSnapshot(
    tabId: number,
    seedSnapshot?: DomSnapshotPayload,
    seedFrameId?: number
  ): Promise<DomSnapshotPayload | undefined> {
    const topFallback = await this.captureSingleFrameSnapshot(tabId, 0);
    const fallback = topFallback ?? seedSnapshot;
    const frames = await withTimeout(allTabFrames(tabId), FRAME_SNAPSHOT_TIMEOUT_MS, []);
    const frameSnapshots: Array<{ frameId: number; snapshot: DomSnapshotPayload }> = [];
    if (seedSnapshot && seedFrameId !== undefined) frameSnapshots.push({ frameId: seedFrameId, snapshot: seedSnapshot });
    await withTimeout(Promise.allSettled(frames.map(async (frame) => {
      if (seedFrameId !== undefined && frame.frameId === seedFrameId && seedSnapshot) return;
      const snapshot = await this.captureSingleFrameSnapshot(tabId, frame.frameId);
      if (snapshot) frameSnapshots.push({ frameId: frame.frameId, snapshot });
    })), FRAME_SNAPSHOT_TIMEOUT_MS, []);
    if (!frameSnapshots.length) return fallback;
    const topSnapshot = frameSnapshots.find((entry) => entry.frameId === 0 || entry.snapshot.frame?.isTop)?.snapshot ?? topFallback;
    if (!topSnapshot) return undefined;
    const mergedElements: NonNullable<RecordingEventPayload["element"]>[] = [];
    for (const entry of frameSnapshots) {
      const elements = entry.snapshot === topSnapshot || entry.snapshot.frame?.isTop
        ? entry.snapshot.interactiveElements
        : translateFrameElements(entry.snapshot, topSnapshot, entry.frameId);
      mergedElements.push(...elements);
    }
    return {
      ...topSnapshot,
      interactiveElements: mergedElements
    };
  }

  private async captureSingleFrameSnapshot(tabId: number, frameId: number): Promise<DomSnapshotPayload | undefined> {
    const snapshot = await withTimeout(sendToTab(tabId, { type: "captureSnapshot" }, frameId), FRAME_SNAPSHOT_TIMEOUT_MS, undefined);
    return isDomSnapshotPayload(snapshot) ? snapshot : undefined;
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
    await this.sendClientMessage("client.action_result", gatewayActionResultFromBrowserResult(result));
    await this.sendRuntimeActionConfirmation(result, tabId, frameId);
    await this.handleRecordingEvent(compactObject({
      kind: "action.result",
      sequence: this.nextBackgroundEventSequence(),
      url: result.url ?? this.activeTabUrl ?? "",
      title: result.title ?? "",
      eventTimestampMs: result.finishedAt,
      element: result.element,
      visualTarget,
      snapshot: result.snapshot,
      actionResult: result
    }), tabId, frameId);
  }

  private async sendRuntimeActionConfirmation(result: BrowserActionResult, tabId?: number, frameId?: number): Promise<void> {
    if (result.status !== "succeeded") return;
    const confirmation = runtimeConfirmationForActionResult(result);
    if (!confirmation) return;
    const event = createWebAutomationRecordingEvent({
      kind: confirmation.kind,
      sequence: this.nextBackgroundEventSequence(),
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
    await this.sendClientMessage("client.recording_event", event);
  }

  private async sendClientMessage<TType extends ClientGatewayClientMessage["type"]>(
    type: TType,
    payload: Extract<ClientGatewayClientMessage, { type: TType }>["payload"],
    _tabId?: number,
    _frameId?: number
  ): Promise<void> {
    if (this.client?.connected) {
      await (this.client.send as (messageType: ClientGatewayClientMessage["type"], messagePayload: unknown) => Promise<unknown>)(type, payload);
      return;
    }
    const message = (createClientGatewayMessage as (
      messageType: ClientGatewayClientMessage["type"],
      messagePayload: unknown,
      options: { clientId?: string; sessionId?: string }
    ) => ClientGatewayClientMessage)(type, payload, {
      clientId: this.session.clientId,
      ...(this.session.sessionId !== undefined ? { sessionId: this.session.sessionId } : {})
    });
    this.queueSize = await queueEvent(message);
    this.emitStatus();
  }

  private async flushQueue(): Promise<void> {
    if (!this.client?.connected) return;
    const queued = await readQueuedEvents();
    for (const message of queued) {
      await (this.client.send as (messageType: ClientGatewayClientMessage["type"], messagePayload: unknown) => Promise<unknown>)(message.type, message.payload);
    }
    await clearQueuedEvents();
    this.queueSize = 0;
    this.emitStatus();
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.connectionState === "connected") void this.sendBrowserState();
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

  private async refreshActiveTab(): Promise<void> {
    const tab = await activeTab();
    this.activeTabId = tab?.tabId;
    this.activeTabUrl = tab?.url;
    this.unsupportedPage = unsupportedPageForUrl(tab?.url);
    this.emitStatus();
  }

  private async broadcastToContent(message: unknown, injectMissing: boolean): Promise<void> {
    const tabs = await chrome.tabs.query({});
    await Promise.allSettled(tabs.map(async (tab) => {
      if (tab.id === undefined || unsupportedPageForUrl(tab.url)) return;
      if (injectMissing) await ensureContentScript(tab.id);
      await sendToTab(tab.id, message);
    }));
  }

  private setState(state: ConnectionState): void {
    this.connectionState = state;
    this.emitStatus();
  }

  private emitStatus(): void {
    const status = this.status();
    for (const listener of this.listeners) listener(status);
    void chrome.runtime.sendMessage({ type: "fluxiq.statusChanged", status }).catch(() => undefined);
  }

  private async captureActiveSnapshot(label: string): Promise<void> {
    const tabId = this.activeTabId;
    if (tabId === undefined) return;
    if (this.unsupportedPage) {
      this.addActivity("snapshot", "Snapshot skipped", this.unsupportedPage.reason, "warning");
      return;
    }
    try {
      await this.attachTabForRecording(tabId);
      const snapshot = await sendToTab(tabId, { type: "captureSnapshot" });
      await this.sendClientMessage("client.snapshot", await this.gatewaySnapshotFromDomSnapshot(snapshot as never, tabId));
      this.addActivity("snapshot", label, this.activeTabUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Content script is unavailable.";
      this.unsupportedPage = { url: this.activeTabUrl, reason: message };
      this.addActivity("snapshot", "Snapshot failed", message, "warning");
      this.emitStatus();
    }
  }

  private addActivity(kind: string, label: string, detail?: string, tone: ActivityEntry["tone"] = "neutral"): void {
    const timestamp = Date.now();
    this.lastActivityAt = timestamp;
    const entry = compactObject({
      id: `${kind}.${timestamp}.${Math.random().toString(36).slice(2)}`,
      timestamp,
      kind,
      label,
      detail,
      tone
    });
    this.recentActivities.unshift(entry);
    this.recentActivities.splice(20);
    this.recordingLog.unshift(entry);
    this.recordingLog.splice(500);
    this.emitStatus();
  }

  private resetRecordingLog(): void {
    this.eventCount = 0;
    this.recentActivities.length = 0;
    this.recordingLog.length = 0;
    this.clearPendingPointerClicks();
    this.lastActivityAt = undefined;
  }

  private startRuntimeAction(action: BrowserActionCommand): void {
    this.startRuntimeStatus({
      commandId: action.commandId,
      actionType: action.actionType,
      label: runtimeActionLabel(action.actionType),
      target: runtimeActionTarget(action),
      startedAt: Date.now()
    });
  }

  private startRuntimeStatus(status: Omit<RuntimeCommandStatus, "state">): void {
    this.runtimeStatus = {
      state: "running",
      startedAt: Date.now(),
      ...status
    };
    this.lastError = undefined;
    this.addActivity("runtime", `Runtime started: ${this.runtimeStatus.label ?? this.runtimeStatus.actionType ?? "Command"}`, this.runtimeStatus.target, "warning");
    this.emitStatus();
  }

  private finishRuntimeStatus(result: BrowserActionResult & { tabId?: number; frameId?: number }): void {
    const failed = result.status !== "succeeded";
    const label = runtimeActionLabel(result.actionType);
    this.runtimeStatus = {
      state: failed ? "failed" : "succeeded",
      commandId: result.commandId,
      actionType: result.actionType,
      label,
      target: runtimeResultTarget(result) ?? this.runtimeStatus.target,
      ...(result.tabId !== undefined ? { tabId: result.tabId } : {}),
      ...(result.frameId !== undefined ? { frameId: result.frameId } : {}),
      startedAt: result.startedAt,
      finishedAt: result.finishedAt,
      ...(result.message ? { message: result.message } : {}),
      ...(failed && result.message ? { error: result.message } : {}),
      ...(result.url ? { url: result.url } : {})
    };
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

  private suppressNextClickDuplicate(signature: string): void {
    if (this.suppressedPointerClicks.has(signature)) return;
    const timer = setTimeout(() => {
      this.suppressedPointerClicks.delete(signature);
    }, POINTER_CLICK_SUPPRESS_DELAY_MS);
    this.suppressedPointerClicks.set(signature, timer);
  }

  private isSuppressedClickDuplicate(signature: string): boolean {
    return this.suppressedPointerClicks.has(signature);
  }

  private clearPendingPointerClicks(): void {
    for (const timer of this.suppressedPointerClicks.values()) clearTimeout(timer);
    this.suppressedPointerClicks.clear();
  }

  private async attachTabForRecording(tabId: number): Promise<void> {
    if (this.recordingState === "recording" && !this.lastRecordedNavigation.has(tabId)) {
      const tab = await chrome.tabs.get(tabId);
      if (tab.url && !unsupportedPageForUrl(tab.url)) this.lastRecordedNavigation.set(tabId, { url: tab.url, timestamp: Date.now() });
    }
    await ensureContentScript(tabId);
    await this.setContentRecordingState(tabId, this.recordingState === "recording");
  }

  private async setContentRecordingState(tabId: number, recording: boolean, frameId?: number): Promise<void> {
    await sendToTab(tabId, { type: "recording", recording, settings: this.settings }, frameId);
  }

  private async buildInitialRecordingState(timestamp: number): Promise<JsonObject> {
    const tabId = this.activeTabId;
    if (tabId !== undefined && !this.unsupportedPage) {
      try {
        await this.attachTabForRecording(tabId);
        const snapshot = await sendToTab(tabId, { type: "captureSnapshot" });
        if (isDomSnapshotPayload(snapshot)) {
          const projectId = await this.resolveRecordingProjectId("initial_state");
          return await this.createStateFromDomSnapshot(snapshot, {
            timestamp,
            ...(projectId ? { projectId } : {}),
            tabId,
            sourceId: this.tabSourceId(tabId)
          });
        }
      } catch {
        // Fall back to browser tab state below.
      }
    }
    return browserStateSnapshotFromTabs(await activeTab(), await allTabs(), this.recordingState, timestamp, this.eventSourceId()) as unknown as JsonObject;
  }

  private recordingEnvironment(): JsonObject {
    return compactObject({
      id: `client.${this.session.clientId}.browser`,
      label: "FluxIQ Browser Extension",
      kind: "browser_extension",
      domainId: WEB_AUTOMATION_DOMAIN_ID,
      capabilities: browserExtensionCapabilities.map((capability) => capability.id),
      metadata: compactObject({
        browser: browserDescriptor() as unknown as JsonObject,
        activeTabUrl: this.activeTabUrl
      }) as JsonObject
    }) as JsonObject;
  }

  private recordingSources(): JsonObject[] {
    return [
      { id: this.eventSourceId(), label: "Browser events", kind: "event", schemaId: WEB_AUTOMATION_DOMAIN_ID, metadata: { clientId: this.session.clientId } },
      { id: this.observationSourceId(), label: "Browser observations", kind: "observation", schemaId: WEB_AUTOMATION_DOMAIN_ID, metadata: { clientId: this.session.clientId } },
      { id: this.stateSourceId(), label: "Browser state", kind: "state", schemaId: WEB_AUTOMATION_DOMAIN_ID, metadata: { clientId: this.session.clientId } }
    ] as JsonObject[];
  }

  private recordingActionChannels(): JsonObject[] {
    return [{
      id: `client.${this.session.clientId}.actions`,
      label: "Browser action channel",
      actionTypes: actionTypesFromCapabilities(browserExtensionCapabilities),
      capabilities: browserExtensionCapabilities.map((capability) => capability.id),
      metadata: { clientId: this.session.clientId }
    }] as JsonObject[];
  }

  private eventSourceId(): string {
    return `client.${this.session.clientId}.events`;
  }

  private observationSourceId(): string {
    return `client.${this.session.clientId}.observations`;
  }

  private stateSourceId(): string {
    return `client.${this.session.clientId}.state`;
  }

  private tabSourceId(tabId: number, frameId?: number): string {
    return `tab:${tabId}${frameId === undefined ? "" : `:frame:${frameId}`}`;
  }

  private async visualSampleForState(tabId: number, projectId: string, timestamp: number, eventKey?: string): Promise<VisualStateSample | undefined> {
    const fresh = await this.captureFreshVisualSampleForState(tabId, projectId, timestamp, eventKey);
    if (fresh) return fresh;
    return undefined;
  }

  private async captureFreshVisualSampleForState(tabId: number, projectId: string, timestamp: number, eventKey?: string): Promise<VisualStateSample | undefined> {
    try {
      const capture = await this.captureScreenPngBytes(tabId);
      const sha256 = await sha256Hex(capture.bytes);
      const screenContentRef = await this.uploadStateAsset(projectId, sha256, capture.bytes, "image/png");
      const capturedAt = Date.now();
      console.info("FluxIQ fresh state screenshot stored", {
        tabId,
        projectId,
        sha256,
        coordinateSpace: capture.coordinateSpace,
        imageSize: capture.imageSize,
        eventKey,
        eventTimestampMs: timestamp,
        capturedAt,
        deltaMs: capturedAt - timestamp
      });
      this.addActivity("snapshot", "Fresh viewport screenshot stored", `${sha256.slice(0, 12)} @ ${Math.max(0, capturedAt - timestamp)}ms after event`, "success");
      return { screenContentRef, screenImageSize: capture.imageSize, capturedAt };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Fresh screenshot capture failed.";
      console.warn("FluxIQ fresh state screenshot failed", {
        tabId,
        projectId,
        eventTimestampMs: timestamp,
        message
      });
      return undefined;
    }
  }

  private async createStateFromDomSnapshot(
    snapshot: Parameters<typeof createWebAutomationStateFromSnapshot>[0],
    input: { timestamp: number; sourceId?: string; projectId?: string; tabId?: number; frameId?: number; eventKey?: string }
  ): Promise<JsonObject> {
    let screenContentRef: string | undefined;
    let stateSnapshot = snapshot;
    let stateTimestamp = input.timestamp;
    let visualSample: VisualStateSample | undefined;
    let missingScreenReason: string | undefined;
    const hasFrameViewportOffset = hasSnapshotFrameViewportOffset(snapshot);
    const canAttachFullTabScreenshot = input.frameId === undefined || input.frameId === 0 || hasFrameViewportOffset;
    if (input.projectId && input.tabId !== undefined && canAttachFullTabScreenshot) {
      visualSample = await this.visualSampleForState(input.tabId, input.projectId, input.timestamp, input.eventKey);
      screenContentRef = visualSample?.screenContentRef;
      if (visualSample?.snapshot) stateSnapshot = visualSample.snapshot;
      if (!screenContentRef) missingScreenReason = "screenshot capture or upload failed";
    } else {
      missingScreenReason = input.frameId !== undefined && input.frameId !== 0
        ? "frame-local state missing iframe viewport offset"
        : input.projectId
          ? "no tab id"
          : "no project id";
      this.noteScreenshotSkipped(input.frameId !== undefined && input.frameId !== 0
        ? "Frame-local state cannot be safely paired with a full-tab screenshot until iframe viewport offset is available."
        : input.projectId
          ? "No active tab id available for screenshot capture."
          : "No project id available for screenshot upload.");
    }
    const options: Parameters<typeof createWebAutomationStateFromSnapshot>[1] = { timestamp: stateTimestamp };
    if (input.sourceId !== undefined) options.sourceId = input.sourceId;
    if (input.projectId !== undefined) options.projectId = input.projectId;
    if (screenContentRef !== undefined) options.screenContentRef = screenContentRef;
    if (visualSample?.screenImageSize !== undefined) options.screenImageSize = visualSample.screenImageSize;
    const state = createWebAutomationStateFromSnapshot(stateSnapshot, options) as unknown as JsonObject;
    if (missingScreenReason) {
      console.warn("FluxIQ state snapshot missing screenshot", {
        reason: missingScreenReason,
        timestamp: input.timestamp,
        stateTimestamp,
        sourceId: input.sourceId,
        projectId: input.projectId,
        tabId: input.tabId,
        frameId: input.frameId
      });
      this.addActivity("snapshot", "State screenshot missing", missingScreenReason, "warning");
      const metadata = objectValue(state.metadata);
      return {
        ...state,
        metadata: compactObject({
          ...(metadata ?? {}),
          missingScreenReason
        }) as JsonObject
      };
    }
    return state;
  }

  private async gatewaySnapshotFromDomSnapshot(
    snapshot: { url: string; title: string; viewport: unknown; focusedElement?: unknown; selectedText?: string; interactiveElements: unknown[] },
    tabId?: number
  ): Promise<ClientGatewaySnapshot> {
    const timestamp = Date.now();
    const projectId = await this.resolveRecordingProjectId("snapshot");
    const state = isDomSnapshotPayload(snapshot)
      ? await this.createStateFromDomSnapshot(snapshot, {
          timestamp,
          ...(projectId ? { projectId } : {}),
          ...(tabId === undefined ? {} : { tabId }),
          ...(tabId === undefined ? {} : { sourceId: this.tabSourceId(tabId) })
        })
      : undefined;
    return compactObject({
      snapshotId: `dom.${timestamp}`,
      timestamp,
      kind: state ? "state" : "structured",
      ...(state !== undefined ? { state } : {}),
      payload: snapshot as unknown as JsonObject
    } satisfies ClientGatewaySnapshot) as ClientGatewaySnapshot;
  }

  private async captureAndStoreScreenContentRef(tabId: number, projectId: string): Promise<VisualStateSample | undefined> {
    try {
      const capture = await this.captureVisibleViewportPngBytes(tabId);
      const sha256 = await sha256Hex(capture.bytes);
      const screenContentRef = await this.uploadStateAsset(projectId, sha256, capture.bytes, "image/png");
      this.addActivity("snapshot", "Screenshot stored", sha256.slice(0, 12), "success");
      return { screenContentRef, screenImageSize: capture.imageSize, capturedAt: Date.now() };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Screenshot capture or upload failed.";
      this.addActivity("snapshot", "Screenshot unavailable", message, "warning");
      return undefined;
    }
  }

  private async captureScreenPngBytes(tabId: number): Promise<{ bytes: ArrayBuffer; imageSize: ScreenImageSize; coordinateSpace: "viewport" }> {
    return await this.captureVisibleViewportPngBytes(tabId);
  }

  private async captureVisibleViewportPngBytes(tabId: number): Promise<{ bytes: ArrayBuffer; imageSize: ScreenImageSize; coordinateSpace: "viewport" }> {
    const tab = await chrome.tabs.get(tabId);
    if (tab.windowId === undefined) throw new Error("Tab window is unavailable for screenshot capture.");
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
    const bytes = await bytesFromDataUrl(dataUrl);
    return { bytes, imageSize: pngImageSize(bytes), coordinateSpace: "viewport" };
  }

  private async uploadStateAsset(projectId: string, sha256: string, bytes: ArrayBuffer, mediaType: string): Promise<string> {
    const url = new URL(`/api/programs/automation-studio/state-assets/${encodeURIComponent(projectId)}/${sha256}`, this.settings.coreApiUrl || DEFAULT_CORE_API_URL);
    const response = await fetch(url.toString(), {
      method: "PUT",
      headers: compactObject({
        "content-type": mediaType,
        "x-content-sha256": sha256,
        ...(this.session.token ? { authorization: `Bearer ${this.session.token}` } : {})
      }) as Record<string, string>,
      body: bytes
    });
    const bodyText = await response.text().catch(() => "");
    const payload = parseJsonBody(bodyText);
    console.info("FluxIQ screenshot upload", {
      url: url.toString(),
      status: response.status,
      body: payload ?? bodyText
    });
    const responseObject = objectValue(payload);
    const responsePayload = objectValue(responseObject?.payload);
    const contentRef = stringValue(responsePayload?.contentRef);
    if (!response.ok || responseObject?.ok !== true || !contentRef) {
      throw new Error(`FluxIQ state asset upload failed (${response.status}).`);
    }
    return contentRef;
  }

  private currentRecordingProjectId(): string | undefined {
    const value = this.activeRecordingProjectId ?? this.session.projectId;
    return typeof value === "string" && value.trim() ? value : undefined;
  }

  private async resolveRecordingProjectId(reason: string): Promise<string | undefined> {
    const current = this.currentRecordingProjectId();
    if (current) return current;
    const hydrated = await this.hydrateProjectIdFromCoreSnapshot(reason);
    return hydrated ?? this.currentRecordingProjectId();
  }

  private async hydrateProjectIdFromCoreSnapshot(reason: string): Promise<string | undefined> {
    if (!this.session.token) return undefined;
    try {
      const url = new URL("/api/client-gateway/snapshot", this.settings.coreApiUrl || DEFAULT_CORE_API_URL);
      const response = await fetch(url.toString(), {
        headers: compactObject({
          accept: "application/json",
          authorization: `Bearer ${this.session.token}`
        }) as Record<string, string>
      });
      const bodyText = await response.text().catch(() => "");
      const payload = parseJsonBody(bodyText);
      console.info("FluxIQ project context lookup", {
        url: url.toString(),
        status: response.status,
        reason,
        body: payload ?? bodyText
      });
      if (!response.ok) return undefined;
      const root = objectValue(payload);
      if (root?.ok !== true) return undefined;
      const body = objectValue(root.payload);
      const sessions = arrayValue(body?.sessions);
      const matchingSession = sessions
        .map(objectValue)
        .find((session) => session && stringValue(session.sessionId) === this.session.sessionId)
        ?? sessions
          .map(objectValue)
          .find((session) => session && stringValue(session.clientId) === this.session.clientId);
      const sessionProjectId = stringValue(matchingSession?.projectId);
      const webRuntime = objectValue(body?.webRuntime);
      const automationStudio = objectValue(webRuntime?.automationStudio);
      const activeProjectId = stringValue(automationStudio?.activeProjectId);
      const projectId = sessionProjectId ?? activeProjectId;
      if (!projectId) return undefined;
      this.session = compactObject({ ...this.session, projectId });
      this.activeRecordingProjectId ??= projectId;
      await writeSession(this.session);
      this.addActivity("recording", "Project context linked", projectId, "success");
      return projectId;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Project context lookup failed.";
      this.addActivity("recording", "Project context unavailable", message, "warning");
      return undefined;
    }
  }

  private noteScreenshotSkipped(message: string): void {
    const now = Date.now();
    if (this.lastScreenshotSkipAt !== undefined && now - this.lastScreenshotSkipAt < 2_000) return;
    this.lastScreenshotSkipAt = now;
    console.warn("FluxIQ screenshot skipped", {
      message,
      sessionId: this.session.sessionId,
      clientId: this.session.clientId,
      projectId: this.session.projectId,
      activeRecordingProjectId: this.activeRecordingProjectId,
      activeTabId: this.activeTabId,
      coreApiUrl: this.settings.coreApiUrl
    });
    this.addActivity("snapshot", "Screenshot skipped", message, "warning");
  }
}

function compactObject<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

function isExecutableRecordedAction(payload: RecordingEventPayload): boolean {
  return recordedInputId(payload) !== undefined;
}

function shouldRequireStateForEvidence(payload: RecordingEventPayload): boolean {
  return isExecutableRecordedAction(payload) ||
    payload.kind === "action.result" ||
    payload.kind === "browser.navigation" ||
    payload.kind === "dom.click" ||
    payload.kind === "dom.input" ||
    payload.kind === "dom.change" ||
    payload.kind === "dom.submit" ||
    payload.kind === "dom.keydown";
}

function isNavigationExplanation(payload: RecordingEventPayload): boolean {
  return payload.kind === "dom.click" || payload.kind === "dom.submit";
}

function stateScreenshotEventKey(payload: RecordingEventPayload): string {
  return `${payload.kind}:${payload.sequence}:${payload.eventTimestampMs}`;
}

function clickEventSignature(payload: RecordingEventPayload, tabId?: number, frameId?: number): string | undefined {
  const element = payload.element;
  if (!element) return undefined;
  const bounds = rectValue(element.bounds);
  return [
    tabId ?? "tab",
    frameId ?? "frame",
    element.selector,
    bounds ? Math.round(bounds.x) : "",
    bounds ? Math.round(bounds.y) : "",
    bounds ? Math.round(bounds.width) : "",
    bounds ? Math.round(bounds.height) : ""
  ].join("|");
}

function recordedInputId(payload: RecordingEventPayload) {
  return webAutomationInputIdForRecordedEvent({
    kind: payload.kind,
    url: payload.url,
    title: payload.title,
    sequence: payload.sequence,
    ...(payload.element ? { element: elementTarget(payload.element) } : {}),
    ...(payload.visualTarget ? { visualTarget: payload.visualTarget as unknown as JsonObject } : {}),
    ...(payload.inputValue !== undefined ? { inputValue: payload.inputValue } : {}),
    ...(payload.key !== undefined ? { key: payload.key } : {}),
    ...(payload.scroll ? { scroll: payload.scroll } : {}),
    ...(payload.metadata ? { metadata: payload.metadata } : {})
  });
}

function recordingEvidencePayload(payload: RecordingEventPayload): JsonObject {
  const visualTarget = visualTargetFromPayload(payload);
  return compactObject({
    kind: payload.kind,
    url: payload.url,
    title: payload.title,
    sequence: payload.sequence,
    timestamp: payload.eventTimestampMs,
    element: payload.element as unknown as JsonObject,
    visualTarget: visualTarget as unknown as JsonObject,
    snapshot: payload.snapshot as unknown as JsonObject,
    inputValue: payload.inputValue,
    key: payload.key,
    scroll: payload.scroll as unknown as JsonObject,
    mutation: payload.mutation as unknown as JsonObject,
    actionResult: payload.actionResult as unknown as JsonObject,
    metadata: payload.metadata
  }) as JsonObject;
}

function translateFrameElements(
  frameSnapshot: DomSnapshotPayload,
  topSnapshot: DomSnapshotPayload,
  frameId: number
): NonNullable<RecordingEventPayload["element"]>[] {
  const offset = rectValue(frameSnapshot.frame?.viewportOffset);
  if (!offset) return frameSnapshot.interactiveElements;
  return frameSnapshot.interactiveElements.map((element) => {
    const viewportBounds = translateFrameRectToTopViewport(element.bounds, element.documentBounds, frameSnapshot, offset);
    const documentBounds = viewportBounds
      ? {
          x: viewportBounds.x + topSnapshot.viewport.scrollX,
          y: viewportBounds.y + topSnapshot.viewport.scrollY,
          width: viewportBounds.width,
          height: viewportBounds.height
        }
      : translateFrameDocumentRectToTopDocument(element.documentBounds, frameSnapshot, topSnapshot, offset);
    return compactObject({
      ...element,
      selector: `frame[${frameId}] >> ${element.selector}`,
      bounds: viewportBounds,
      documentBounds,
      isVisibleOnViewport: viewportBounds !== undefined,
      attributes: compactObject({
        ...(element.attributes ?? {}),
        "data-fluxiq-frame-id": String(frameId),
        "data-fluxiq-frame-url": frameSnapshot.url
      })
    }) as NonNullable<RecordingEventPayload["element"]>;
  });
}

function translateFrameRectToTopViewport(
  bounds: NonNullable<RecordingEventPayload["element"]>["bounds"],
  documentBounds: NonNullable<RecordingEventPayload["element"]>["documentBounds"],
  frameSnapshot: DomSnapshotPayload,
  offset: { x: number; y: number; width: number; height: number }
): NonNullable<RecordingEventPayload["element"]>["bounds"] {
  const rect = rectValue(bounds) ??
    translateFrameDocumentRectToFrameViewport(documentBounds, frameSnapshot);
  if (!rect) return undefined;
  return {
    x: round2(offset.x + rect.x),
    y: round2(offset.y + rect.y),
    width: round2(rect.width),
    height: round2(rect.height)
  };
}

function translateFrameDocumentRectToFrameViewport(
  documentBounds: NonNullable<RecordingEventPayload["element"]>["documentBounds"],
  frameSnapshot: DomSnapshotPayload
): NonNullable<RecordingEventPayload["element"]>["bounds"] {
  const rect = rectValue(documentBounds);
  if (!rect) return undefined;
  return {
    x: round2(rect.x - frameSnapshot.viewport.scrollX),
    y: round2(rect.y - frameSnapshot.viewport.scrollY),
    width: round2(rect.width),
    height: round2(rect.height)
  };
}

function translateFrameDocumentRectToTopDocument(
  documentBounds: NonNullable<RecordingEventPayload["element"]>["documentBounds"],
  frameSnapshot: DomSnapshotPayload,
  topSnapshot: DomSnapshotPayload,
  offset: { x: number; y: number; width: number; height: number }
): NonNullable<RecordingEventPayload["element"]>["documentBounds"] {
  const frameViewportRect = translateFrameDocumentRectToFrameViewport(documentBounds, frameSnapshot);
  if (!frameViewportRect) return undefined;
  return {
    x: round2(topSnapshot.viewport.scrollX + offset.x + frameViewportRect.x),
    y: round2(topSnapshot.viewport.scrollY + offset.y + frameViewportRect.y),
    width: round2(frameViewportRect.width),
    height: round2(frameViewportRect.height)
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(fallback);
      });
  });
}

function stateSnapshotIdFromPayload(payload: RecordingEventPayload): string {
  const kind = payload.kind.replace(/[^a-z0-9_.-]+/gi, "-");
  return `state.${kind}.${payload.sequence}.${payload.eventTimestampMs}`;
}

function browserStateFromTabs(active: Awaited<ReturnType<typeof activeTab>>, tabs: Awaited<ReturnType<typeof allTabs>>, recordingState: RecordingState): ClientGatewayStateUpdate {
  return createWebAutomationStateUpdate({
    ...(active?.tabId === undefined ? {} : { activeContextId: String(active.tabId) }),
    recording: recordingState === "recording",
    contexts: tabs.map((tab) => compactObject({
      contextId: String(tab.tabId),
      url: tab.url,
      title: tab.title,
      faviconUrl: tab.favIconUrl,
      active: tab.active,
      metadata: compactObject({
        kind: "browser.tab",
        windowId: tab.windowId,
        status: tab.status
      }) as JsonObject
    }) as JsonObject),
    state: browserStateSnapshotFromTabs(active, tabs, recordingState, Date.now()) as unknown as JsonObject,
    metadata: { inputId: WEB_AUTOMATION_INPUT_IDS.browserState }
  });
}

function gatewayRecordingEventFromPayload(payload: RecordingEventPayload, tabId?: number, frameId?: number, recordingId?: string): ClientGatewayRecordingEvent {
  const inputId = recordedInputId(payload);
  const visualTarget = visualTargetFromPayload(payload);
  return createWebAutomationRecordingEvent({
    kind: payload.kind,
    sequence: payload.sequence,
    url: payload.url,
    title: payload.title,
    eventTimestampMs: payload.eventTimestampMs,
    element: payload.element ? elementTarget(payload.element) : undefined,
    visualTarget: visualTarget as unknown as JsonObject | undefined,
    snapshot: payload.snapshot as unknown as JsonObject,
    inputValue: payload.inputValue,
    key: payload.key,
    scroll: payload.scroll as unknown as JsonObject,
    mutation: payload.mutation as unknown as JsonObject,
    actionResult: payload.actionResult ? webAutomationActionResultPayload(payload.actionResult as never) : undefined,
    metadata: inputId === undefined
      ? payload.metadata
      : { ...(payload.metadata ?? {}), inputId, ...(visualTarget ? { visualTarget: visualTarget as unknown as JsonObject } : {}) }
  }, {
    ...(recordingId !== undefined ? { recordingId } : {}),
    ...(tabId !== undefined ? { tabId } : {}),
    ...(frameId !== undefined ? { frameId } : {})
  });
}

function elementTarget(element: { selector: string; tagName: string; xpath?: string | undefined; id?: string | undefined; classNames?: string[] | undefined; visibleText?: string | undefined; text?: string | undefined; value?: string | undefined; role?: string | undefined; name?: string | undefined; href?: string | undefined; inputType?: string | undefined; bounds?: unknown; documentBounds?: unknown; isVisibleOnViewport?: boolean | undefined; hasClickHandler?: boolean | undefined; attributes?: Record<string, string> | undefined }): JsonObject {
  return compactObject({
    selector: element.selector,
    tagName: element.tagName,
    xpath: element.xpath,
    id: element.id,
    classNames: element.classNames,
    visibleText: element.visibleText,
    text: element.text,
    value: element.value,
    role: element.role,
    name: element.name,
    href: element.href,
    inputType: element.inputType,
    bounds: element.bounds as JsonObject,
    documentBounds: element.documentBounds as JsonObject,
    isVisibleOnViewport: element.isVisibleOnViewport,
    hasClickHandler: element.hasClickHandler,
    attributes: element.attributes as JsonObject
  }) as JsonObject;
}

function visualTargetFromPayload(payload: RecordingEventPayload) {
  return payload.visualTarget ?? (payload.element
    ? webAutomationActionVisualTargetFromElement(payload.element as never)
    : undefined);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function parseJsonBody(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function pointValue(value: unknown): { x: number; y: number } | undefined {
  if (!value || typeof value !== "object") return undefined;
  const point = value as { x?: unknown; y?: unknown };
  return typeof point.x === "number" && typeof point.y === "number" ? { x: point.x, y: point.y } : undefined;
}

function rectValue(value: unknown): { x: number; y: number; width: number; height: number } | undefined {
  if (!value || typeof value !== "object") return undefined;
  const rect = value as { x?: unknown; y?: unknown; width?: unknown; height?: unknown };
  return typeof rect.x === "number" &&
    typeof rect.y === "number" &&
    typeof rect.width === "number" &&
    typeof rect.height === "number"
    ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    : undefined;
}

function unsupportedPageForUrl(url: string | undefined): UnsupportedPageState | undefined {
  if (!url) return undefined;
  if (/^(chrome|edge|brave|opera|vivaldi|about|moz-extension|chrome-extension):\/\//.test(url)) {
    return { url, reason: "Browser and extension pages cannot be recorded." };
  }
  if (/^https:\/\/chrome\.google\.com\/webstore/.test(url)) {
    return { url, reason: "Browser web store pages cannot be recorded." };
  }
  return undefined;
}

function activityLabel(payload: RecordingEventPayload): string {
  if (payload.kind === "dom.click") return "Click";
  if (payload.kind === "dom.input") return "Input changed";
  if (payload.kind === "dom.change") return "Field changed";
  if (payload.kind === "dom.submit") return "Form submitted";
  if (payload.kind === "dom.keydown") return `Key ${payload.key ?? ""}`.trim();
  if (payload.kind === "dom.wheel") return "Mouse wheel";
  if (payload.kind === "dom.scroll") return "Page scrolled";
  if (payload.kind === "dom.mutation") return "DOM changed";
  if (payload.kind === "browser.navigation") return "Navigation";
  if (payload.kind === "action.result") return "Action result";
  return payload.kind;
}

function activityDetail(payload: RecordingEventPayload): string | undefined {
  if (payload.element?.name) return payload.element.name;
  if (payload.element?.text) return payload.element.text;
  if (payload.element?.selector) return payload.element.selector;
  if (payload.scroll) return `${payload.scroll.x}, ${payload.scroll.y}`;
  if (payload.mutation) return `${payload.mutation.added} added, ${payload.mutation.removed} removed`;
  if (payload.url) return payload.url;
  return undefined;
}

function runtimeActionLabel(actionType: string): string {
  if (actionType === "web.browser.navigate") return "Navigate";
  if (actionType === "web.dom.click") return "Click";
  if (actionType === "web.dom.type") return "Type";
  if (actionType === "web.dom.clear") return "Clear";
  if (actionType === "web.dom.select") return "Select";
  if (actionType === "web.dom.keypress") return "Key press";
  if (actionType === "web.dom.scroll") return "Scroll";
  if (actionType === "web.dom.wait_for_selector") return "Wait for selector";
  if (actionType === "web.dom.wait_for_text") return "Wait for text";
  if (actionType === "web.dom.extract") return "Extract";
  if (actionType === "web.dom.capture_snapshot") return "Capture snapshot";
  return actionType;
}

function runtimeActionTarget(action: BrowserActionCommand): string | undefined {
  return action.url ?? action.selector ?? action.text ?? action.value ?? action.key ?? action.visualTarget?.selector;
}

function runtimeResultTarget(result: BrowserActionResult): string | undefined {
  if (result.actionType === "web.browser.navigate") return result.url ?? result.title;
  return result.element?.name ?? result.element?.selector ?? result.element?.text;
}

function runtimeConfirmationForActionResult(result: BrowserActionResult): {
  kind: RecordingEventPayload["kind"];
  inputId: string;
  inputValue?: string;
  key?: string;
  scroll?: { x: number; y: number };
} | undefined {
  if (result.actionType === "web.browser.navigate") return { kind: "browser.navigation", inputId: WEB_AUTOMATION_INPUT_IDS.navigationRequested };
  if (result.actionType === "web.dom.click") return { kind: "dom.click", inputId: WEB_AUTOMATION_INPUT_IDS.elementClicked };
  if (result.actionType === "web.dom.type") return { kind: "dom.input", inputId: WEB_AUTOMATION_INPUT_IDS.textEntered };
  if (result.actionType === "web.dom.clear") return { kind: "dom.input", inputId: WEB_AUTOMATION_INPUT_IDS.fieldCleared, inputValue: "" };
  if (result.actionType === "web.dom.select") return { kind: "dom.change", inputId: WEB_AUTOMATION_INPUT_IDS.optionSelected };
  if (result.actionType === "web.dom.keypress") return { kind: "dom.keydown", inputId: WEB_AUTOMATION_INPUT_IDS.keyPressed };
  if (result.actionType === "web.dom.scroll") return { kind: "dom.scroll", inputId: WEB_AUTOMATION_INPUT_IDS.pageScrolled };
  return undefined;
}

function isDomSnapshotPayload(value: unknown): value is {
  url: string;
  title: string;
  viewport: { width: number; height: number; scrollX: number; scrollY: number };
  frame?: { isTop: boolean; viewportOffset?: { x: number; y: number; width: number; height: number } };
  focusedElement?: RecordingEventPayload["element"];
  selectedText?: string;
  interactiveElements: NonNullable<RecordingEventPayload["element"]>[];
} {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as {
    url?: unknown;
    title?: unknown;
    viewport?: { width?: unknown; height?: unknown; scrollX?: unknown; scrollY?: unknown };
    interactiveElements?: unknown;
  };
  return typeof snapshot.url === "string" &&
    typeof snapshot.title === "string" &&
    Boolean(snapshot.viewport) &&
    typeof snapshot.viewport?.width === "number" &&
    typeof snapshot.viewport.height === "number" &&
    typeof snapshot.viewport.scrollX === "number" &&
    typeof snapshot.viewport.scrollY === "number" &&
    Array.isArray(snapshot.interactiveElements);
}

function hasSnapshotFrameViewportOffset(snapshot: Parameters<typeof createWebAutomationStateFromSnapshot>[0]): boolean {
  const frame = objectValue((snapshot as { frame?: unknown }).frame);
  const viewportOffset = objectValue(frame?.viewportOffset);
  return typeof viewportOffset?.x === "number" &&
    typeof viewportOffset.y === "number" &&
    typeof viewportOffset.width === "number" &&
    typeof viewportOffset.height === "number";
}

function browserStateSnapshotFromTabs(
  active: Awaited<ReturnType<typeof activeTab>>,
  tabs: Awaited<ReturnType<typeof allTabs>>,
  recordingState: RecordingState,
  timestamp: number,
  sourceId?: string
): unknown {
  const options: { timestamp?: number; sourceId?: string; recording?: boolean; permissions?: string[] } = {
    timestamp,
    recording: recordingState === "recording",
    permissions: ["activeTab", "scripting", "storage", "tabs"]
  };
  if (sourceId !== undefined) options.sourceId = sourceId;
  return createWebAutomationStateFromTabs(active, tabs, options);
}

function describeActiveTabLike(tab: chrome.tabs.Tab): {
  tabId: number;
  windowId?: number;
  url?: string;
  title?: string;
  active?: boolean;
  status?: string;
} {
  const result: { tabId: number; windowId?: number; url?: string; title?: string; active?: boolean; status?: string } = {
    tabId: tab.id ?? -1
  };
  if (tab.windowId !== undefined) result.windowId = tab.windowId;
  if (tab.url !== undefined) result.url = tab.url;
  if (tab.title !== undefined) result.title = tab.title;
  if (tab.active !== undefined) result.active = tab.active;
  if (tab.status !== undefined) result.status = tab.status;
  return result;
}

function actionTypesFromCapabilities(capabilities: ClientGatewayCapability[]): string[] {
  return [...new Set(capabilities.flatMap((capability) => capability.actionTypes ?? []))];
}

function recordingsApiUrl(coreApiUrl: string, page: number, pageSize: number): string {
  const url = new URL("/api/recordings", coreApiUrl || DEFAULT_CORE_API_URL);
  url.searchParams.set("page", String(page));
  url.searchParams.set("pageSize", String(pageSize));
  return url.toString();
}

function normalizeRecordingsResponse(value: unknown, page: number, pageSize: number, sourceUrl: string): CoreRecordingsPage {
  const object = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const rawItems = Array.isArray(object.items) ? object.items : Array.isArray(object.recordings) ? object.recordings : [];
  return {
    items: rawItems.map(normalizeRecordingSummary).filter((item): item is CoreRecordingSummary => Boolean(item)),
    page: numberValue(object.page) ?? page,
    pageSize: numberValue(object.pageSize) ?? pageSize,
    total: numberValue(object.total),
    sourceUrl
  };
}

function normalizeRecordingSummary(value: unknown): CoreRecordingSummary | undefined {
  if (!value || typeof value !== "object") return undefined;
  const object = value as Record<string, unknown>;
  const id = stringValue(object.id) ?? stringValue(object.recordingId);
  if (!id) return undefined;
  return compactObject({
    id,
    title: stringValue(object.title) ?? stringValue(object.name) ?? id,
    status: stringValue(object.status),
    projectId: stringValue(object.projectId),
    taskId: stringValue(object.taskId),
    eventCount: numberValue(object.eventCount),
    startedAt: timestampValue(object.startedAt),
    endedAt: timestampValue(object.endedAt),
    updatedAt: timestampValue(object.updatedAt)
  });
}

function timestampValue(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return undefined;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

async function bytesFromDataUrl(dataUrl: string): Promise<ArrayBuffer> {
  const response = await fetch(dataUrl);
  return await response.arrayBuffer();
}

function pngImageSize(bytes: ArrayBuffer): ScreenImageSize {
  const view = new DataView(bytes);
  const hasPngSignature = view.byteLength >= 24 &&
    view.getUint32(0) === 0x89504e47 &&
    view.getUint32(4) === 0x0d0a1a0a &&
    view.getUint32(12) === 0x49484452;
  if (!hasPngSignature) throw new Error("Captured screenshot is not a PNG image.");
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  if (width <= 0 || height <= 0) throw new Error("Captured screenshot has invalid PNG dimensions.");
  return { width, height };
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
