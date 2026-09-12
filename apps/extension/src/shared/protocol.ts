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
  type WebAutomationActionCommand,
  type WebAutomationActionResult,
  type WebAutomationActionType,
  type WebAutomationActionVisualTarget
} from "@fluxiq-web-extension/domain/client";
// The page-level evidence a capture gathers is shaped by the modules that
// produce it, in `content/evidence/`, but it travels on the wire as part of the
// snapshot, so the snapshot shape declared here has to name it. The import is
// type-only, so nothing in `content/` reaches the background or panel bundles.
import type { PageEvidence } from "../content/evidence";

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
  coreApiUrl: string;
  autoReconnect: boolean;
  captureMutations: boolean;
  captureInputValues: boolean;
  captureSnapshots: boolean;
};

export type FluxIQSession = {
  clientId: string;
  token?: string | undefined;
  sessionId?: string | undefined;
  projectId?: string | null | undefined;
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

export type RecordingLogPage = {
  items: ActivityEntry[];
  page: number;
  pageSize: number;
  total: number;
};

export type CoreRecordingSummary = {
  id: string;
  title: string;
  status?: string | undefined;
  projectId?: string | undefined;
  taskId?: string | undefined;
  eventCount?: number | undefined;
  startedAt?: number | undefined;
  endedAt?: number | undefined;
  updatedAt?: number | undefined;
};

export type CoreRecordingsPage = {
  items: CoreRecordingSummary[];
  page: number;
  pageSize: number;
  total?: number | undefined;
  sourceUrl: string;
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

export type RuntimeCommandStatus = {
  state: "idle" | "running" | "succeeded" | "failed";
  commandId?: string | undefined;
  actionType?: BrowserActionType | undefined;
  label?: string | undefined;
  target?: string | undefined;
  tabId?: number | undefined;
  frameId?: number | undefined;
  startedAt?: number | undefined;
  finishedAt?: number | undefined;
  message?: string | undefined;
  error?: string | undefined;
  url?: string | undefined;
};

export type ExtensionStatus = {
  connectionState: ConnectionState;
  recordingState: RecordingState;
  gatewayUrl: string;
  settings?: FluxIQSettings | undefined;
  clientId: string;
  sessionId?: string | undefined;
  projectId?: string | null | undefined;
  activeTabId?: number | undefined;
  activeTabUrl?: string | undefined;
  queueSize: number;
  pairingReferenceCode?: string | undefined;
  eventCount: number;
  recordingStartedAt?: number | undefined;
  lastActivityAt?: number | undefined;
  recentActivities: ActivityEntry[];
  runtime?: RuntimeCommandStatus | undefined;
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
  xpath?: string | undefined;
  id?: string | undefined;
  classNames?: string[] | undefined;
  visibleText?: string | undefined;
  text?: string | undefined;
  value?: string | undefined;
  role?: string | undefined;
  name?: string | undefined;
  href?: string | undefined;
  inputType?: string | undefined;
  hasValue?: boolean | undefined;
  selectedValue?: string | undefined;
  bounds?: RectDescriptor | undefined;
  documentBounds?: RectDescriptor | undefined;
  isVisibleOnViewport?: boolean | undefined;
  hasClickHandler?: boolean | undefined;
  attributes?: Record<string, string> | undefined;
  options?: Array<{ value: string; label: string }> | undefined;
  /** Identity signals, matching Core's fingerprint normalizer (Phase 1.3). */
  testId?: string | undefined;
  accessibleName?: string | undefined;
  label?: string | undefined;
  implicitRole?: string | undefined;
  context?: DomElementContext | undefined;
  /**
   * The element's fingerprint differs from the previous snapshot of this frame
   * (Phase 1.4). Optional rather than `false` by default: the first snapshot of
   * a frame has nothing to have changed from, and a producer that does not
   * compute it must not be read as saying "unchanged".
   */
  changed?: boolean | undefined;
  /** The element is among those most recently interacted with, by a person or by an action. */
  recentlyInteracted?: boolean | undefined;
};

/**
 * Where an element sits on the page, so two otherwise identical controls can be
 * told apart (Phase 1.3). Every field is optional: a producer emits only what
 * the element actually has.
 */
export type DomElementContext = {
  formId?: string | undefined;
  formName?: string | undefined;
  formAction?: string | undefined;
  fieldsetLegend?: string | undefined;
  /** The nearest landmark role, for example `main`, `navigation`, `search`. */
  landmark?: string | undefined;
  /** The nearest preceding heading's text. */
  heading?: string | undefined;
  listPosition?: { index: number; total: number } | undefined;
  tablePosition?: { row: number; column: number; columnHeader?: string | undefined } | undefined;
};

/** The domain's visual target, named as the extension has always called it. */
export type ActionVisualTarget = WebAutomationActionVisualTarget;

export type DomSnapshot = {
  url: string;
  title: string;
  viewport: { width: number; height: number; scrollX: number; scrollY: number; documentWidth?: number | undefined; documentHeight?: number | undefined; devicePixelRatio?: number | undefined };
  frame?: {
    isTop: boolean;
    viewportOffset?: RectDescriptor | undefined;
  } | undefined;
  focusedElement?: DomElementDescriptor | undefined;
  selectedText?: string | undefined;
  interactiveElements: DomElementDescriptor[];
  /**
   * What the capture says about the page rather than about one element
   * (Phase 1.4): the dialogs in front of it, what covers its controls, whether
   * it is still working, how it is laid out, what repeats on it, its forms, and
   * how it was navigated to. Optional, because a producer older than Phase 1.4
   * carries none.
   *
   * Per frame, like the snapshot itself, until the background worker merges the
   * frames (`background/connection/dom-snapshot.ts captureMergedTabSnapshot`),
   * which folds the additive items across every frame and keeps the top frame's
   * for the ones that describe a single document.
   */
  evidence?: PageEvidence | undefined;
};

// The evidence shapes are re-exported here so a consumer outside `content/` --
// the background worker's frame merge, above all -- reads one wire seam rather
// than reaching into the content script's modules for a type.
export type {
  DialogEvidence,
  DialogEvidenceItem,
  FormControlEvidence,
  FormEvidence,
  LoadingEvidence,
  LoadingIndicator,
  LoadingIndicatorKind,
  NativeDialogEvidence,
  NavigationEvidence,
  OverlayEvidence,
  OverlayEvidenceItem,
  PageEvidence,
  RegionEvidence,
  RepeatingStructureEvidence,
  SnapshotElementTotals
} from "../content/evidence";

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
  visualTarget?: ActionVisualTarget | undefined;
  snapshot?: DomSnapshot | undefined;
  inputValue?: string | undefined;
  key?: string | undefined;
  scroll?: { x: number; y: number } | undefined;
  mutation?: { added: number; removed: number; attributes: number; text: number } | undefined;
  actionResult?: BrowserActionResult | undefined;
  metadata?: JsonObject | undefined;
};

export type BrowserActionType = WebAutomationActionType;

/**
 * The action command and its result are the domain's own types, not copies.
 * Before Phase 1.2 the same result was declared three times -- here, in
 * `content/types.ts`, and in `domain/src/actions/types.ts` -- and the three
 * could drift. The result is generic over the element descriptor and the
 * snapshot so the extension keeps its richer shapes while every other field,
 * including `status`, `validation`, `resolution`, and `failure`, is declared
 * once in the domain.
 */
export type BrowserActionCommand = WebAutomationActionCommand;

export type BrowserActionResult = WebAutomationActionResult<DomElementDescriptor, DomSnapshot>;

export type {
  WebAutomationActionStatus as BrowserActionStatus,
  WebAutomationActionValidation as BrowserActionValidation,
  WebAutomationValidationSkipReason as BrowserActionValidationSkipReason,
  WebAutomationTargetResolution as BrowserActionTargetResolution,
  WebAutomationTargetStrategy as BrowserActionTargetStrategy,
  WebAutomationAssertKind,
  WebAutomationAssertRequest,
  WebAutomationDialogRequest,
  WebAutomationDownloadRequest,
  WebAutomationExtractListPagination,
  WebAutomationExtractListRequest,
  WebAutomationKeyModifiers,
  WebAutomationOptionSelector,
  WebAutomationScrollRequest,
  WebAutomationTabRequest,
  WebAutomationUploadFile,
  WebAutomationUploadRequest,
  WebAutomationWaitCondition,
  WebAutomationWaitRequest
} from "@fluxiq-web-extension/domain/client";

export type ServerCommandPayload =
  | { command: "start_recording"; recordingId: string; projectId?: string | null | undefined; taskId?: string | undefined }
  | { command: "stop_recording"; recordingId?: string | undefined }
  | { command: "capture_snapshot"; kind?: string | undefined; metadata?: JsonObject | undefined }
  | { command: "execute_action"; action: BrowserActionCommand }
  | { command: "set_active_tab"; tabId: string }
  | { command: "disconnect"; reason?: string | undefined }
  | { command: "ping"; nonce?: string | undefined };

export const browserExtensionCapabilities: ClientGatewayCapability[] = webAutomationClientCapabilities;
