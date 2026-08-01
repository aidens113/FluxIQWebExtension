export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export const CLIENT_GATEWAY_PROTOCOL_VERSION = "0.1";

export type ConnectionState = "disconnected" | "connecting" | "pairing" | "connected" | "reconnecting" | "error";
export type RecordingState = "idle" | "recording" | "paused";

export type FluxIQSettings = {
  gatewayUrl: string;
  autoReconnect: boolean;
  captureMutations: boolean;
  captureInputValues: boolean;
  captureSnapshots: boolean;
};

export type FluxIQSession = {
  clientId: string;
  token?: string | undefined;
  sessionId?: string | undefined;
  serverUrl?: string | undefined;
  connectedAt?: number | undefined;
};

export type ExtensionStatus = {
  connectionState: ConnectionState;
  recordingState: RecordingState;
  gatewayUrl: string;
  settings?: FluxIQSettings | undefined;
  clientId: string;
  sessionId?: string | undefined;
  activeTabId?: number | undefined;
  activeTabUrl?: string | undefined;
  queueSize: number;
  pairingReferenceCode?: string | undefined;
  lastError?: string | undefined;
  lastMessageAt?: number | undefined;
};

export type ProtocolEnvelope<TType extends string = string, TPayload extends object = JsonObject> = {
  id: string;
  type: TType;
  protocolVersion: typeof CLIENT_GATEWAY_PROTOCOL_VERSION;
  timestamp: number;
  sessionId?: string | undefined;
  clientId?: string | undefined;
  correlationId?: string | undefined;
  payload: TPayload;
};

export type ClientGatewayClientType = "browser-extension";

export type ClientGatewayCapability = {
  id: string;
  label?: string | undefined;
  kind: "recording" | "snapshot" | "action" | "state" | "runtime" | "custom";
  actionTypes?: string[] | undefined;
  metadata?: JsonObject | undefined;
};

export type BrowserDescriptor = {
  clientKind: "browser_extension";
  clientName: string;
  extensionVersion: string;
  userAgent: string;
  language: string;
  platform: string;
  timezone: string;
};

export type TabDescriptor = {
  tabId: number;
  windowId?: number | undefined;
  url?: string | undefined;
  title?: string | undefined;
  favIconUrl?: string | undefined;
  active?: boolean | undefined;
  status?: string | undefined;
};

export type ClientGatewayBrowserState = {
  activeTabId?: string | undefined;
  tabs?: Array<{
    tabId: string;
    url?: string | undefined;
    title?: string | undefined;
    faviconUrl?: string | undefined;
    active?: boolean | undefined;
    viewport?: { width: number; height: number; deviceScaleFactor?: number | undefined } | undefined;
    frameTree?: JsonObject | undefined;
    metadata?: JsonObject | undefined;
  }> | undefined;
  permissions?: string[] | undefined;
  recording?: boolean | undefined;
  metadata?: JsonObject | undefined;
};

export type RectDescriptor = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DomElementDescriptor = {
  tagName: string;
  selector: string;
  text?: string | undefined;
  value?: string | undefined;
  role?: string | undefined;
  name?: string | undefined;
  href?: string | undefined;
  inputType?: string | undefined;
  bounds?: RectDescriptor | undefined;
  attributes?: Record<string, string> | undefined;
};

export type DomSnapshot = {
  url: string;
  title: string;
  viewport: { width: number; height: number; scrollX: number; scrollY: number };
  focusedElement?: DomElementDescriptor | undefined;
  selectedText?: string | undefined;
  interactiveElements: DomElementDescriptor[];
};

export type ClientGatewaySnapshot = {
  snapshotId?: string | undefined;
  timestamp?: number | undefined;
  kind: "dom" | "state" | "screenshot" | "custom";
  state?: JsonObject | undefined;
  payload?: JsonObject | undefined;
  metadata?: JsonObject | undefined;
};

export type RecordingEventKind =
  | "content.ready"
  | "browser.tab"
  | "browser.navigation"
  | "dom.click"
  | "dom.input"
  | "dom.change"
  | "dom.submit"
  | "dom.focus"
  | "dom.blur"
  | "dom.keydown"
  | "dom.scroll"
  | "dom.mutation"
  | "dom.snapshot"
  | "action.result"
  | "client.error";

export type RecordingEventPayload = {
  kind: RecordingEventKind;
  sequence: number;
  url: string;
  title: string;
  eventTimestampMs: number;
  element?: DomElementDescriptor | undefined;
  snapshot?: DomSnapshot | undefined;
  inputValue?: string | undefined;
  key?: string | undefined;
  scroll?: { x: number; y: number } | undefined;
  mutation?: { added: number; removed: number; attributes: number; text: number } | undefined;
  actionResult?: BrowserActionResult | undefined;
  metadata?: JsonObject | undefined;
};

export type ClientGatewayRecordingEvent = {
  eventId?: string | undefined;
  recordingId?: string | undefined;
  eventType: string;
  timestamp?: number | undefined;
  sourceId?: string | undefined;
  target?: JsonObject | undefined;
  payload?: JsonObject | undefined;
  metadata?: JsonObject | undefined;
};

export type BrowserActionType =
  | "browser.navigate"
  | "dom.click"
  | "dom.type"
  | "dom.clear"
  | "dom.select"
  | "dom.scroll"
  | "dom.keypress"
  | "dom.wait_for_selector"
  | "dom.wait_for_text"
  | "dom.extract"
  | "dom.capture_snapshot";

export type BrowserActionCommand = {
  commandId: string;
  actionType: BrowserActionType;
  tabId?: number | undefined;
  frameId?: number | undefined;
  selector?: string | undefined;
  text?: string | undefined;
  value?: string | undefined;
  key?: string | undefined;
  url?: string | undefined;
  timeoutMs?: number | undefined;
  coordinates?: { x: number; y: number } | undefined;
  options?: JsonObject | undefined;
};

export type ClientGatewayActionCommand = {
  commandId: string;
  actionType: BrowserActionType;
  parameters?: JsonObject | undefined;
  target?: JsonObject | undefined;
  timeoutMs?: number | undefined;
  metadata?: JsonObject | undefined;
};

export type BrowserActionResult = {
  commandId: string;
  actionType: BrowserActionType;
  status: "succeeded" | "failed" | "timed_out" | "cancelled";
  message?: string | undefined;
  url?: string | undefined;
  title?: string | undefined;
  element?: DomElementDescriptor | undefined;
  snapshot?: DomSnapshot | undefined;
  extracted?: JsonValue | undefined;
  startedAt: number;
  finishedAt: number;
};

export type ClientGatewayActionResult = {
  commandId: string;
  status: "succeeded" | "failed" | "timed_out" | "cancelled" | "unknown";
  startedAt?: number | undefined;
  completedAt?: number | undefined;
  message?: string | undefined;
  target?: JsonObject | undefined;
  payload?: JsonObject | undefined;
  error?: string | undefined;
  metadata?: JsonObject | undefined;
};

export type ClientHelloPayload = {
  clientId?: string | undefined;
  clientType: ClientGatewayClientType;
  name?: string | undefined;
  version?: string | undefined;
  token?: string | undefined;
  capabilities?: ClientGatewayCapability[] | undefined;
  metadata?: JsonObject | undefined;
};

export type ServerPairingRequiredPayload = {
  referenceCode?: string | undefined;
  reason: string;
};

export type ServerSessionReadyPayload = {
  sessionId: string;
  token: string;
  projectId?: string | null | undefined;
};

export type ServerCommandPayload =
  | { command: "start_recording"; recordingId: string; projectId?: string | null | undefined; taskId?: string | undefined }
  | { command: "stop_recording"; recordingId?: string | undefined }
  | { command: "capture_snapshot"; kind?: string | undefined; metadata?: JsonObject | undefined }
  | { command: "execute_action"; action: BrowserActionCommand }
  | { command: "set_active_tab"; tabId: string }
  | { command: "disconnect"; reason?: string | undefined }
  | { command: "ping"; nonce?: string | undefined };

export type ClientMessage =
  | ProtocolEnvelope<"client.hello", ClientHelloPayload>
  | ProtocolEnvelope<"client.capabilities", { capabilities: ClientGatewayCapability[] }>
  | ProtocolEnvelope<"client.browser_state", ClientGatewayBrowserState>
  | ProtocolEnvelope<"client.tab_state", JsonObject>
  | ProtocolEnvelope<"client.recording_event", ClientGatewayRecordingEvent>
  | ProtocolEnvelope<"client.dom_snapshot", ClientGatewaySnapshot>
  | ProtocolEnvelope<"client.action_result", ClientGatewayActionResult>
  | ProtocolEnvelope<"client.error", { message: string; code?: string | undefined; metadata?: JsonObject | undefined }>;

export type ServerMessage =
  | ProtocolEnvelope<"server.pairing_required", ServerPairingRequiredPayload>
  | ProtocolEnvelope<"server.session_ready", ServerSessionReadyPayload>
  | ProtocolEnvelope<"server.start_recording", { recordingId: string; projectId?: string | null | undefined; taskId?: string | undefined }>
  | ProtocolEnvelope<"server.stop_recording", { recordingId?: string | undefined }>
  | ProtocolEnvelope<"server.capture_snapshot", { kind?: string | undefined; metadata?: JsonObject | undefined }>
  | ProtocolEnvelope<"server.execute_action", ClientGatewayActionCommand>
  | ProtocolEnvelope<"server.set_active_tab", { tabId: string }>
  | ProtocolEnvelope<"server.ping", { nonce: string }>
  | ProtocolEnvelope<"server.disconnect", { reason: string }>
  | ProtocolEnvelope<"server.error", { message: string; code?: string | undefined; metadata?: JsonObject | undefined }>;

export const browserExtensionCapabilities: ClientGatewayCapability[] = [
  { id: "browser.state", label: "Browser state", kind: "state" },
  { id: "dom.snapshot", label: "DOM snapshot", kind: "snapshot" },
  { id: "recording.events", label: "Recording events", kind: "recording" },
  {
    id: "browser.actions",
    label: "Browser actions",
    kind: "action",
    actionTypes: [
      "browser.navigate",
      "dom.click",
      "dom.type",
      "dom.clear",
      "dom.select",
      "dom.scroll",
      "dom.keypress",
      "dom.wait_for_selector",
      "dom.wait_for_text",
      "dom.extract",
      "dom.capture_snapshot"
    ]
  }
];

export function createClientEnvelope<TType extends ClientMessage["type"], TPayload extends object>(params: {
  type: TType;
  clientId: string;
  sessionId?: string | undefined;
  correlationId?: string | undefined;
  payload: TPayload;
}): ProtocolEnvelope<TType, TPayload> {
  const envelope: ProtocolEnvelope<TType, TPayload> = {
    id: `${params.clientId}:${Date.now()}:${Math.random().toString(36).slice(2)}`,
    type: params.type,
    protocolVersion: CLIENT_GATEWAY_PROTOCOL_VERSION,
    timestamp: Date.now(),
    clientId: params.clientId,
    payload: params.payload
  };
  if (params.sessionId) envelope.sessionId = params.sessionId;
  if (params.correlationId) envelope.correlationId = params.correlationId;
  return envelope;
}
