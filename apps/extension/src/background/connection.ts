import {
  HEARTBEAT_INTERVAL_MS,
  RECONNECT_BASE_DELAY_MS,
  RECONNECT_MAX_DELAY_MS
} from "../shared/constants";
import { browserDescriptor } from "../shared/browser";
import {
  browserExtensionCapabilities,
  createClientEnvelope,
  type BrowserActionResult,
  type BrowserActionCommand,
  type ClientGatewayActionCommand,
  type ClientGatewayActionResult,
  type ClientGatewayBrowserState,
  type ClientGatewayRecordingEvent,
  type ClientGatewaySnapshot,
  type ClientMessage,
  type ConnectionState,
  type ExtensionStatus,
  type FluxIQSession,
  type FluxIQSettings,
  type JsonObject,
  type RecordingEventPayload,
  type RecordingState,
  type ServerCommandPayload,
  type ServerMessage
} from "../shared/protocol";
import { activeTab, allTabs, sendToTab } from "./tabs";
import { clearQueuedEvents, queueEvent, readQueuedEvents, writeSession } from "./storage";

type StatusListener = (status: ExtensionStatus) => void;

export class FluxIQConnection {
  private socket: WebSocket | null = null;
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
      queueSize: this.queueSize
    };
    if (this.session.sessionId) status.sessionId = this.session.sessionId;
    if (this.activeTabId !== undefined) status.activeTabId = this.activeTabId;
    if (this.activeTabUrl) status.activeTabUrl = this.activeTabUrl;
    if (this.pairingReferenceCode) status.pairingReferenceCode = this.pairingReferenceCode;
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
    this.socket?.close();
    this.socket = new WebSocket(this.settings.gatewayUrl);
    this.socket.addEventListener("open", () => void this.onOpen());
    this.socket.addEventListener("message", (event) => void this.onMessage(event));
    this.socket.addEventListener("close", () => this.onClose());
    this.socket.addEventListener("error", () => this.onError("WebSocket connection failed."));
  }

  disconnect(): void {
    this.shouldStayConnected = false;
    this.clearReconnect();
    this.stopHeartbeat();
    this.socket?.close();
    this.socket = null;
    this.setState("disconnected");
  }

  async startRecording(): Promise<void> {
    this.recordingState = "recording";
    this.emitStatus();
    await this.broadcastToContent({ type: "recording", recording: true, settings: this.settings });
    await this.handleRecordingEvent({
      kind: "browser.tab",
      sequence: Date.now(),
      url: this.activeTabUrl ?? "",
      title: "",
      eventTimestampMs: Date.now(),
      metadata: { recordingState: "started" }
    });
  }

  async stopRecording(): Promise<void> {
    this.recordingState = "idle";
    this.emitStatus();
    await this.broadcastToContent({ type: "recording", recording: false, settings: this.settings });
    await this.sendClientMessage("client.recording_event", gatewayRecordingEventFromPayload({
      kind: "browser.tab",
      sequence: Date.now(),
      url: this.activeTabUrl ?? "",
      title: "",
      eventTimestampMs: Date.now(),
      metadata: { recordingState: "stopped" }
    }));
  }

  async handleRecordingEvent(payload: RecordingEventPayload, tabId?: number, frameId?: number): Promise<void> {
    if (this.recordingState !== "recording" && payload.kind !== "content.ready") return;
    await this.sendClientMessage("client.recording_event", gatewayRecordingEventFromPayload(payload, tabId, frameId));
  }

  async handleTabUpdated(tab: chrome.tabs.Tab): Promise<void> {
    if (tab.active && tab.id !== undefined) {
      this.activeTabId = tab.id;
      this.activeTabUrl = tab.url;
      this.emitStatus();
    }
    if (!tab.id) return;
    await this.sendClientMessage("client.tab_state", compactObject({ tabId: String(tab.id), url: tab.url, title: tab.title, status: tab.status }) as JsonObject);
  }

  private async onOpen(): Promise<void> {
    this.reconnectAttempt = 0;
    this.lastError = undefined;
    this.setState(this.session.token ? "connecting" : "pairing");
    this.startHeartbeat();
    await this.sendHello();
  }

  private onClose(): void {
    this.stopHeartbeat();
    this.socket = null;
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

  private async onMessage(event: MessageEvent): Promise<void> {
    this.lastMessageAt = Date.now();
    let message: ServerMessage;
    try {
      message = JSON.parse(String(event.data)) as ServerMessage;
    } catch {
      this.lastError = "Received invalid JSON from FluxIQ gateway.";
      this.emitStatus();
      return;
    }

    if (message.type === "server.ping") {
      this.lastMessageAt = Date.now();
      this.emitStatus();
      return;
    }

    if (message.type === "server.pairing_required") {
      this.pairingReferenceCode = message.payload.referenceCode;
      this.setState("pairing");
      this.lastError = message.payload.reason || "Approve this client in FluxIQ.";
      this.emitStatus();
      return;
    }

    if (message.type === "server.error") {
      this.lastError = message.payload.message;
      this.setState("error");
      return;
    }

    if (message.type === "server.session_ready") {
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
      await this.sendBrowserState();
      await this.flushQueue();
      return;
    }

    if (message.type === "server.start_recording") {
      await this.handleServerCommandPayload({ ...message.payload, command: "start_recording" }, message.id);
      return;
    }
    if (message.type === "server.stop_recording") {
      await this.handleServerCommandPayload({ ...message.payload, command: "stop_recording" }, message.id);
      return;
    }
    if (message.type === "server.capture_snapshot") {
      await this.handleServerCommandPayload({ ...message.payload, command: "capture_snapshot" }, message.id);
      return;
    }
    if (message.type === "server.set_active_tab") {
      await this.handleServerCommandPayload({ ...message.payload, command: "set_active_tab" }, message.id);
      return;
    }
    if (message.type === "server.execute_action") {
      await this.handleServerCommandPayload({ command: "execute_action", action: browserActionFromGatewayCommand(message.payload) }, message.id);
      return;
    }
    if (message.type === "server.disconnect") {
      this.disconnect();
    }
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
      await this.startRecording();
      return;
    }
    if (payload.command === "stop_recording") {
      await this.stopRecording();
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
      const tabId = this.activeTabId;
      if (tabId === undefined) return;
      const snapshot = await sendToTab(tabId, { type: "captureSnapshot" });
      await this.sendClientMessage("client.dom_snapshot", gatewaySnapshotFromDomSnapshot(snapshot as never));
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
      if (action.actionType === "browser.navigate" && action.url) {
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
      const result = await sendToTab<BrowserActionResult>(tabId, { type: "executeAction", action }, action.frameId);
      await this.sendActionResult(result, tabId, action.frameId);
    }
  }

  private async sendHello(): Promise<void> {
    const tab = await activeTab();
    await this.sendClientMessage("client.hello", compactObject({
      clientId: this.session.clientId,
      clientType: "browser-extension",
      name: "FluxIQ Browser Extension",
      version: browserDescriptor().extensionVersion,
      token: this.session.token,
      capabilities: browserExtensionCapabilities,
      metadata: {
        browser: browserDescriptor() as unknown as JsonObject,
        settings: {
          captureMutations: this.settings.captureMutations,
          captureInputValues: this.settings.captureInputValues,
          captureSnapshots: this.settings.captureSnapshots
        }
      }
    }));
  }

  private async sendBrowserState(): Promise<void> {
    await this.sendClientMessage("client.browser_state", browserStateFromTabs(await activeTab(), await allTabs(), this.recordingState));
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

  private async sendClientMessage<TType extends ClientMessage["type"]>(
    type: TType,
    payload: Extract<ClientMessage, { type: TType }>["payload"],
    _tabId?: number,
    _frameId?: number
  ): Promise<void> {
    const message = createClientEnvelope(compactObject({
      type,
      clientId: this.session.clientId,
      sessionId: this.session.sessionId,
      payload
    })) as ClientMessage;
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
      return;
    }
    this.queueSize = await queueEvent(message);
    this.emitStatus();
  }

  private async flushQueue(): Promise<void> {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    const queued = await readQueuedEvents();
    for (const message of queued) this.socket.send(JSON.stringify(message));
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
    this.emitStatus();
  }

  private async broadcastToContent(message: unknown): Promise<void> {
    const tabs = await chrome.tabs.query({});
    await Promise.allSettled(tabs.map((tab) => tab.id === undefined ? Promise.resolve() : sendToTab(tab.id, message)));
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
}

function compactObject<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

function browserStateFromTabs(active: Awaited<ReturnType<typeof activeTab>>, tabs: Awaited<ReturnType<typeof allTabs>>, recordingState: RecordingState): ClientGatewayBrowserState {
  return compactObject({
    activeTabId: active?.tabId === undefined ? undefined : String(active.tabId),
    recording: recordingState === "recording",
    tabs: tabs.map((tab) => compactObject({
      tabId: String(tab.tabId),
      url: tab.url,
      title: tab.title,
      faviconUrl: tab.favIconUrl,
      active: tab.active,
      metadata: compactObject({
        windowId: tab.windowId,
        status: tab.status
      }) as JsonObject
    })),
    permissions: ["activeTab", "scripting", "storage", "tabs"]
  });
}

function gatewayRecordingEventFromPayload(payload: RecordingEventPayload, tabId?: number, frameId?: number): ClientGatewayRecordingEvent {
  return compactObject({
    eventId: `event.${payload.sequence}.${payload.eventTimestampMs}`,
    eventType: payload.kind,
    timestamp: payload.eventTimestampMs,
    sourceId: tabId === undefined ? undefined : `tab:${tabId}${frameId === undefined ? "" : `:frame:${frameId}`}`,
    target: payload.element ? elementTarget(payload.element) : undefined,
    payload: compactObject({
      url: payload.url,
      title: payload.title,
      sequence: payload.sequence,
      inputValue: payload.inputValue,
      key: payload.key,
      scroll: payload.scroll as unknown as JsonObject,
      mutation: payload.mutation as unknown as JsonObject,
      snapshot: payload.snapshot as unknown as JsonObject,
      actionResult: payload.actionResult as unknown as JsonObject
    }) as JsonObject,
    metadata: payload.metadata
  });
}

function gatewaySnapshotFromDomSnapshot(snapshot: { url: string; title: string; viewport: unknown; focusedElement?: unknown; selectedText?: string; interactiveElements: unknown[] }): ClientGatewaySnapshot {
  return {
    snapshotId: `dom.${Date.now()}`,
    timestamp: Date.now(),
    kind: "dom",
    state: {
      url: snapshot.url,
      title: snapshot.title,
      viewport: snapshot.viewport as JsonObject,
      focusedElement: snapshot.focusedElement as JsonObject,
      selectedText: snapshot.selectedText ?? null,
      interactiveElements: snapshot.interactiveElements as unknown as JsonObject
    },
    payload: snapshot as unknown as JsonObject
  };
}

function browserActionFromGatewayCommand(command: ClientGatewayActionCommand): BrowserActionCommand {
  const parameters = command.parameters ?? {};
  const target = command.target ?? {};
  return compactObject({
    commandId: command.commandId,
    actionType: command.actionType,
    selector: stringValue(target.selector) ?? stringValue(parameters.selector),
    text: stringValue(parameters.text),
    value: stringValue(parameters.value),
    key: stringValue(parameters.key),
    url: stringValue(parameters.url),
    timeoutMs: numberValue(command.timeoutMs ?? parameters.timeoutMs),
    coordinates: pointValue(target.coordinates ?? parameters.coordinates),
    options: parameters
  });
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
  });
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
