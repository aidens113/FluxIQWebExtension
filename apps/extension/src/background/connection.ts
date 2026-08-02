import {
  FluxIQClientGatewayWebSocketClient,
  createClientGatewayMessage
} from "@fluxiq/client-gateway-websocket";
import {
  createWebAutomationRecordingEvent,
  createWebAutomationStateUpdate,
  createWebAutomationStructuredSnapshot,
  webAutomationActionFromGatewayCommand,
  webAutomationActionResultPayload,
  WEB_AUTOMATION_DOMAIN_ID
} from "@fluxiq-web-extension/domain/client";
import {
  HEARTBEAT_INTERVAL_MS,
  RECONNECT_BASE_DELAY_MS,
  RECONNECT_MAX_DELAY_MS
} from "../shared/constants";
import { browserDescriptor } from "../shared/browser";
import {
  browserExtensionCapabilities,
  type BrowserActionResult,
  type BrowserActionCommand,
  type ClientGatewayActionCommand,
  type ClientGatewayActionResult,
  type ClientGatewayClientHello,
  type ClientGatewayClientMessage,
  type ClientGatewayRecordingEvent,
  type ClientGatewayServerMessage,
  type ClientGatewaySnapshot,
  type ClientGatewayStateUpdate,
  type ConnectionState,
  type ExtensionStatus,
  type FluxIQSession,
  type FluxIQSettings,
  type JsonObject,
  type RecordingEventPayload,
  type RecordingState,
  type ServerCommandPayload,
  type ActivityEntry,
  type RecordingBlockState,
  type UnsupportedPageState
} from "../shared/protocol";
import { activeTab, allTabs, ensureContentScript, sendToTab } from "./tabs";
import { clearQueuedEvents, queueEvent, readQueuedEvents, writeSession } from "./storage";

type StatusListener = (status: ExtensionStatus) => void;

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
  private pendingRecordingStart: { recordingId: string; timer: ReturnType<typeof setTimeout> } | undefined;
  private recordingBlock: RecordingBlockState | undefined;
  private lastActivityAt: number | undefined;
  private unsupportedPage: UnsupportedPageState | undefined;
  private readonly recentActivities: ActivityEntry[] = [];
  private readonly listeners = new Set<StatusListener>();

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
      recentActivities: [...this.recentActivities]
    };
    if (this.session.sessionId) status.sessionId = this.session.sessionId;
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
    this.recordingBlock = undefined;
    const recordingId = `client.${this.session.clientId}.${Date.now()}`;
    await this.sendClientMessage("client.start_recording", {
      recordingId,
      startedAt: Date.now(),
      domainId: WEB_AUTOMATION_DOMAIN_ID,
      initialState: { timestamp: Date.now(), namespaces: {} },
      metadata: {
        domainId: WEB_AUTOMATION_DOMAIN_ID,
        requestedBy: "extension-record-button",
        activeTabUrl: this.activeTabUrl ?? null
      }
    });
    this.addActivity("recording", "Starting recording", "Waiting for FluxIQ project acceptance.", "warning");
    this.pendingRecordingStart = {
      recordingId,
      timer: setTimeout(() => void this.beginAcceptedRecording(recordingId), 750)
    };
    this.emitStatus();
  }

  async stopRecording(notifyServer = true): Promise<void> {
    if (this.recordingState !== "recording") return;
    await this.captureActiveSnapshot("Final snapshot captured");
    this.recordingState = "idle";
    this.addActivity("recording", "Recording stopped", `${this.eventCount} user actions captured`, "neutral");
    this.emitStatus();
    await this.broadcastToContent({ type: "recording", recording: false, settings: this.settings }, false);
    await this.sendRecordingEvidence({
      kind: "browser.tab",
      sequence: Date.now(),
      url: this.activeTabUrl ?? "",
      title: "",
      eventTimestampMs: Date.now(),
      metadata: { recordingState: "stopped" }
    });
    if (notifyServer && this.activeRecordingId) {
      await this.sendClientMessage("client.stop_recording", {
        recordingId: this.activeRecordingId,
        endedAt: Date.now()
      });
    }
    this.activeRecordingId = undefined;
  }

  dismissRecordingBlock(): void {
    this.recordingBlock = undefined;
    if (this.lastError === "Open a FluxIQ project before recording.") this.lastError = undefined;
    this.emitStatus();
  }

  async handleRecordingEvent(payload: RecordingEventPayload, tabId?: number, frameId?: number): Promise<void> {
    if (this.recordingState !== "recording") return;
    if (isPrimaryUserActionKind(payload.kind)) {
      this.eventCount += 1;
      this.addActivity(payload.kind, activityLabel(payload), activityDetail(payload));
      await this.sendClientMessage("client.recording_event", gatewayRecordingEventFromPayload(payload, tabId, frameId));
      return;
    }
    if (payload.kind !== "content.ready") {
      this.addActivity(payload.kind, `Evidence: ${activityLabel(payload)}`, activityDetail(payload));
    }
    await this.sendRecordingEvidence(payload, tabId, frameId);
  }

  async handleTabUpdated(tab: chrome.tabs.Tab): Promise<void> {
    const becameActive = Boolean(tab.active && tab.id !== undefined);
    if (tab.active && tab.id !== undefined) {
      this.activeTabId = tab.id;
      this.activeTabUrl = tab.url;
      this.unsupportedPage = unsupportedPageForUrl(tab.url);
      this.emitStatus();
    }
    if (!tab.id) return;
    if (becameActive && this.recordingState === "recording" && !this.unsupportedPage) {
      await this.attachTabForRecording(tab.id);
      this.addActivity("tab", "Recording active tab", tab.url ?? `Tab ${tab.id}`);
    }
    if (this.recordingState === "recording" && tab.url) {
      await this.handleRecordingEvent({
        kind: "browser.navigation",
        sequence: Date.now(),
        url: tab.url,
        title: tab.title ?? "",
        eventTimestampMs: Date.now()
      }, tab.id);
    }
    if (this.connectionState === "connected") {
      await this.sendClientMessage("client.state_update", createWebAutomationStateUpdate({
        activeContextId: String(tab.id),
        contexts: [compactObject({ contextId: String(tab.id), url: tab.url, title: tab.title, status: tab.status }) as JsonObject],
        recording: this.recordingState === "recording",
        metadata: { reason: "tab-updated" }
      }));
      await this.sendBrowserState();
    }
  }

  private async onOpen(): Promise<void> {
    this.reconnectAttempt = 0;
    this.lastError = undefined;
    this.setState(this.session.token ? "connecting" : "pairing");
    this.startHeartbeat();
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
      await this.beginAcceptedRecording(payload.recordingId);
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
      await this.captureActiveSnapshot("Snapshot captured");
      return;
    }
      if (payload.command === "execute_action") {
      const action = payload.action;
      const tabId = action.tabId ?? this.activeTabId;
      if (tabId === undefined) {
        await this.sendActionResult({
          commandId: action.commandId,
          actionType: action.actionType,
          status: "failed",
          message: "No active tab is available.",
          startedAt: Date.now(),
          finishedAt: Date.now()
        });
        return;
      }
      if (action.actionType === "web.browser.navigate" && action.url) {
        const startedAt = Date.now();
        await chrome.tabs.update(tabId, { url: action.url });
        await this.sendActionResult({
          commandId: action.commandId,
          actionType: action.actionType,
          status: "succeeded",
          message: "Navigation requested.",
          url: action.url,
          startedAt,
          finishedAt: Date.now()
        });
        return;
      }
      await this.attachTabForRecording(tabId);
      const result = await sendToTab<BrowserActionResult>(tabId, { type: "executeAction", action }, action.frameId);
      await this.sendActionResult(result, tabId, action.frameId);
    }
  }

  private async beginAcceptedRecording(recordingId: string): Promise<void> {
    this.clearPendingRecordingStart();
    if (this.recordingState === "recording") return;
    this.recordingBlock = undefined;
    this.activeRecordingId = recordingId;
    this.eventCount = 0;
    this.recentActivities.length = 0;
    this.recordingStartedAt = Date.now();
    this.recordingState = "recording";
    this.addActivity("recording", "Recording started", this.activeTabUrl ?? "Active tab", "success");
    this.emitStatus();
    if (this.activeTabId !== undefined) await this.attachTabForRecording(this.activeTabId);
    await this.sendBrowserState();
    await this.handleRecordingEvent({
      kind: "browser.tab",
      sequence: Date.now(),
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
      void this.broadcastToContent({ type: "recording", recording: false, settings: this.settings }, false);
    }
    this.recordingStartedAt = undefined;
    this.activeRecordingId = undefined;
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

  private async sendBrowserState(): Promise<void> {
    await this.sendClientMessage("client.state_update", browserStateFromTabs(await activeTab(), await allTabs(), this.recordingState));
  }

  private async sendRecordingEvidence(payload: RecordingEventPayload, tabId?: number, frameId?: number): Promise<void> {
    await this.sendClientMessage("client.state_update", createWebAutomationStateUpdate({
      ...(tabId === undefined ? {} : { activeContextId: String(tabId) }),
      state: compactObject({
        latestEvidence: recordingEvidencePayload(payload)
      }) as JsonObject,
      metadata: compactObject({
        reason: "recording-evidence",
        clientKind: payload.kind,
        eventTimestampMs: payload.eventTimestampMs,
        ...(tabId === undefined ? {} : { tabId }),
        ...(frameId === undefined ? {} : { frameId }),
        ...(payload.metadata ?? {})
      }) as JsonObject
    }));
  }

  private async sendActionResult(result: BrowserActionResult, tabId?: number, frameId?: number): Promise<void> {
    await this.sendClientMessage("client.action_result", gatewayActionResultFromBrowserResult(result));
    await this.handleRecordingEvent(compactObject({
      kind: "action.result",
      sequence: Date.now(),
      url: result.url ?? this.activeTabUrl ?? "",
      title: result.title ?? "",
      eventTimestampMs: result.finishedAt,
      element: result.element,
      snapshot: result.snapshot,
      actionResult: result
    }), tabId, frameId);
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
      await this.sendClientMessage("client.snapshot", gatewaySnapshotFromDomSnapshot(snapshot as never));
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
    this.recentActivities.unshift(compactObject({
      id: `${kind}.${timestamp}.${Math.random().toString(36).slice(2)}`,
      timestamp,
      kind,
      label,
      detail,
      tone
    }));
    this.recentActivities.splice(20);
    this.emitStatus();
  }

  private async attachTabForRecording(tabId: number): Promise<void> {
    await ensureContentScript(tabId);
    await sendToTab(tabId, { type: "recording", recording: this.recordingState === "recording", settings: this.settings });
  }
}

function compactObject<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

function isPrimaryUserActionKind(kind: string): boolean {
  return kind === "dom.click" || kind === "dom.keydown" || kind === "dom.wheel";
}

function recordingEvidencePayload(payload: RecordingEventPayload): JsonObject {
  return compactObject({
    kind: payload.kind,
    url: payload.url,
    title: payload.title,
    sequence: payload.sequence,
    timestamp: payload.eventTimestampMs,
    element: payload.element as unknown as JsonObject,
    snapshot: payload.snapshot as unknown as JsonObject,
    inputValue: payload.inputValue,
    key: payload.key,
    scroll: payload.scroll as unknown as JsonObject,
    mutation: payload.mutation as unknown as JsonObject,
    actionResult: payload.actionResult as unknown as JsonObject,
    metadata: payload.metadata
  }) as JsonObject;
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
    state: compactObject({
      permissions: ["activeTab", "scripting", "storage", "tabs"],
      activeUrl: active?.url,
      activeTitle: active?.title
    }) as JsonObject
  });
}

function gatewayRecordingEventFromPayload(payload: RecordingEventPayload, tabId?: number, frameId?: number): ClientGatewayRecordingEvent {
  return createWebAutomationRecordingEvent({
    kind: payload.kind,
    sequence: payload.sequence,
    url: payload.url,
    title: payload.title,
    eventTimestampMs: payload.eventTimestampMs,
    element: payload.element ? elementTarget(payload.element) : undefined,
    snapshot: payload.snapshot as unknown as JsonObject,
    inputValue: payload.inputValue,
    key: payload.key,
    scroll: payload.scroll as unknown as JsonObject,
    mutation: payload.mutation as unknown as JsonObject,
    actionResult: payload.actionResult ? webAutomationActionResultPayload(payload.actionResult as never) : undefined,
    metadata: payload.metadata
  }, {
    ...(tabId !== undefined ? { tabId } : {}),
    ...(frameId !== undefined ? { frameId } : {})
  });
}

function gatewaySnapshotFromDomSnapshot(snapshot: { url: string; title: string; viewport: unknown; focusedElement?: unknown; selectedText?: string; interactiveElements: unknown[] }): ClientGatewaySnapshot {
  return createWebAutomationStructuredSnapshot({
    snapshotId: `dom.${Date.now()}`,
    timestamp: Date.now(),
    state: {
      url: snapshot.url,
      title: snapshot.title,
      viewport: snapshot.viewport as JsonObject,
      focusedElement: snapshot.focusedElement as JsonObject,
      selectedText: snapshot.selectedText ?? null,
      interactiveElements: snapshot.interactiveElements as unknown as JsonObject
    },
    payload: snapshot as unknown as JsonObject
  });
}

function browserActionFromGatewayCommand(command: ClientGatewayActionCommand & { commandId: string }): BrowserActionCommand {
  return webAutomationActionFromGatewayCommand(command) as BrowserActionCommand;
}

function gatewayActionResultFromBrowserResult(result: BrowserActionResult): ClientGatewayActionResult {
  return compactObject({
    commandId: result.commandId,
    status: result.status,
    startedAt: result.startedAt,
    completedAt: result.finishedAt,
    message: result.message,
    target: result.element ? elementTarget(result.element) : undefined,
    payload: compactObject({
      url: result.url,
      title: result.title,
      snapshot: result.snapshot as unknown as JsonObject,
      extracted: result.extracted as JsonObject
    }) as JsonObject,
    error: result.status === "failed" ? result.message : undefined
  }) as ClientGatewayActionResult;
}

function elementTarget(element: { selector: string; tagName: string; text?: string | undefined; bounds?: unknown; attributes?: Record<string, string> | undefined }): JsonObject {
  return compactObject({
    selector: element.selector,
    tagName: element.tagName,
    text: element.text,
    bounds: element.bounds as JsonObject,
    attributes: element.attributes as JsonObject
  }) as JsonObject;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function pointValue(value: unknown): { x: number; y: number } | undefined {
  if (!value || typeof value !== "object") return undefined;
  const point = value as { x?: unknown; y?: unknown };
  return typeof point.x === "number" && typeof point.y === "number" ? { x: point.x, y: point.y } : undefined;
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
