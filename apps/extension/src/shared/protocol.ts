import {
  CLIENT_GATEWAY_PROTOCOL_VERSION,
  type ClientGatewayActionCommand,
  type ClientGatewayActionResult,
  type ClientGatewayCapability,
  type ClientGatewayClientHello,
  type ClientGatewayClientMessage,
  type ClientGatewayClientType,
  type ClientGatewayRecordingEvent,
  type ClientGatewayServerMessage,
  type ClientGatewaySnapshot,
  type ClientGatewayStateUpdate
} from "@fluxiq/client-gateway-websocket";
import {
  webAutomationClientCapabilities,
  type WebAutomationActionType
} from "@fluxiq-web-extension/domain/client";

export {
  CLIENT_GATEWAY_PROTOCOL_VERSION,
  type ClientGatewayActionCommand,
  type ClientGatewayActionResult,
  type ClientGatewayCapability,
  type ClientGatewayClientHello,
  type ClientGatewayClientMessage,
  type ClientGatewayClientType,
  type ClientGatewayRecordingEvent,
  type ClientGatewayServerMessage,
  type ClientGatewaySnapshot,
  type ClientGatewayStateUpdate
};

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

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

export type ActivityEntry = {
  id: string;
  timestamp: number;
  kind: string;
  label: string;
  detail?: string | undefined;
  tone?: "neutral" | "success" | "warning" | "danger" | undefined;
};

export type UnsupportedPageState = {
  url?: string | undefined;
  reason: string;
};

export type RecordingBlockState = {
  code: string;
  title: string;
  message: string;
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
  eventCount: number;
  recordingStartedAt?: number | undefined;
  lastActivityAt?: number | undefined;
  recentActivities: ActivityEntry[];
  unsupportedPage?: UnsupportedPageState | undefined;
  recordingBlock?: RecordingBlockState | undefined;
  lastError?: string | undefined;
  lastMessageAt?: number | undefined;
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
  | "dom.wheel"
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

export type BrowserActionType = WebAutomationActionType;

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

export type ServerCommandPayload =
  | { command: "start_recording"; recordingId: string; projectId?: string | null | undefined; taskId?: string | undefined }
  | { command: "stop_recording"; recordingId?: string | undefined }
  | { command: "capture_snapshot"; kind?: string | undefined; metadata?: JsonObject | undefined }
  | { command: "execute_action"; action: BrowserActionCommand }
  | { command: "set_active_tab"; tabId: string }
  | { command: "disconnect"; reason?: string | undefined }
  | { command: "ping"; nonce?: string | undefined };

export const browserExtensionCapabilities: ClientGatewayCapability[] = webAutomationClientCapabilities;
