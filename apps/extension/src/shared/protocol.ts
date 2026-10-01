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
  type WebAutomationActionVisualTarget,
  type WebAutomationRecordedExtraction,
  type WebAutomationRecordedTab
} from "@fluxiq-web-extension/domain/client";
// The page-level evidence a capture gathers is produced in `content/evidence/`
// but travels on the wire as part of the snapshot, so the snapshot shape
// declared here has to name it. Its *shape* is declared in neither place: it is
// `WebAutomationPageEvidence` in the domain package
// (`domain/src/page-evidence/`), which is the one home both sides of the wire
// can reach, because the structure audit forbids `domain/src` importing
// `apps/extension/src`. `content/evidence/types.ts` is the extension's single
// import of that contract and gives it these shorter local names; this file
// goes through it rather than importing the domain twice. The import is
// type-only, so nothing in `content/` reaches the background or panel bundles.
import type { PageEvidence } from "../content/evidence";
import { RUNTIME_MESSAGES } from "./constants";

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
  /**
   * The element's human name -- its accessible name, label or visible text --
   * for the panel to say "Clicking Add to cart". Never a selector, an XPath, an
   * attribute or a value typed into a field; absent when the element has no
   * human name, and for actions that act on no element.
   */
  targetName?: string | undefined;
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
  /**
   * A pairing token is stored, so FluxIQ has approved this browser before. Tells
   * "not set up yet" from "set up, but not connected right now" without the
   * token itself ever leaving the background worker.
   */
  paired: boolean;
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

/**
 * The panel's requests to FluxIQ Core that the background worker relays with
 * the pairing token (`background/panel/`). Each is the `RUNTIME_MESSAGES.panel*`
 * message named beside it, plus these fields. A `projectId` left out means the
 * project this browser's session belongs to (`ExtensionStatus.projectId`).
 *
 * The relay adds nothing and keeps nothing: a successful reply carries Core's
 * payload exactly as Core returned it, and no conversation state lives in the
 * background worker.
 */
export type PanelConversationReadRequest =
  /**
   * `list-conversations`. `projectId: null` lists every thread in the projects
   * this browser can see; left out, it is the session's project when one is
   * known, and every project when none is.
   */
  | { kind: "list"; projectId?: string | null | undefined; status?: "open" | "resolved" | undefined; subjectKind?: string | undefined; subjectId?: string | undefined; limit?: number | undefined }
  /** `get-conversation`: one thread, from `sinceTurnId` when given. */
  | { kind: "get"; projectId?: string | undefined; conversationId: string; sinceTurnId?: string | undefined; limit?: number | undefined };

export type PanelConversationSendRequest = {
  /**
   * `open` starts a thread and sends nothing (`open-conversation`). Otherwise
   * `text` is sent: into `conversationId` when given (`append-turn`), or into a
   * thread opened for it first, whose `conversation` then joins the reply.
   */
  kind?: "open" | "append" | undefined;
  projectId?: string | undefined;
  conversationId?: string | undefined;
  text?: string | undefined;
  /**
   * Extra capabilities Core may answer with. The relay always offers the
   * chat's own (`background/panel/chat-capabilities.ts`, which Core runs
   * itself) and adds these after them, minus any id already offered.
   */
  capabilities?: unknown[] | undefined;
  /**
   * What the panel has open. `pageUrl` is only a fallback: the relay sends the
   * active tab's address when the browser gives one, and Core builds from it.
   */
  onScreen?: { flowId?: string; subflowId?: string; runId?: string; recordingId?: string; pageUrl?: string } | undefined;
  subjectKind?: string | undefined;
  subjectId?: string | undefined;
  title?: string | undefined;
};

/** `answer-ask`: the person's answer to a question FluxIQ asked in a thread. */
export type PanelConversationAnswerRequest = {
  projectId?: string | undefined;
  askId: string;
  kind: string;
  value?: string | undefined;
};

/**
 * `cancel-runtime-session`. With a `runId`, that run; the reply is Core's
 * `{ runtimeSession }`. Without one, every run of the project that has not
 * ended; the reply is `{ runtimeSessions }`, one Core answer per run stopped,
 * and an empty list when nothing was running.
 */
export type PanelStopRunRequest = {
  projectId?: string | undefined;
  runId?: string | undefined;
};

/** `panelSaveSettings`: settings to store without connecting. */
export type PanelSaveSettingsRequest = { settings: Partial<FluxIQSettings> };

/**
 * Why a panel request did not reach an answer.
 *
 * - `forbidden`: the sender is not the side panel or the popup.
 * - `not_paired`: no pairing token is stored.
 * - `no_project`: the request needs a project and none is known yet.
 * - `invalid_request`: a required field is missing.
 * - `unreachable`: FluxIQ did not answer at the address in settings.
 * - `timed_out`: FluxIQ took the whole call's time limit without answering. It
 *   may still be working -- a conversation turn waits on a model -- so the
 *   request is not known to have failed, and repeating it could do it twice.
 * - `refused`: FluxIQ refused the pairing token (401 or 403). An older FluxIQ
 *   that accepts only its login cookie answers this way.
 * - `failed`: FluxIQ answered, and its answer was a failure. `error` is Core's own message.
 */
export type PanelRelayFailureCode = "forbidden" | "not_paired" | "no_project" | "invalid_request" | "unreachable" | "timed_out" | "refused" | "failed";

/** Every panel relay's reply, in the `{ ok: true } & T | { ok: false; error }` envelope the panel already reads. */
export type PanelRelayResponse<TPayload = unknown> =
  | { ok: true; payload: TPayload }
  | { ok: false; error: string; code: PanelRelayFailureCode; httpStatus?: number | undefined };

/**
 * Automation panel requests, by their short names; the strings live in
 * `RUNTIME_MESSAGES` (`shared/constants.ts`), and this module
 * exports them under the same short names. Each is relayed by the background worker
 * (`background/automation-relay/`) to the Core endpoint named beside it, with the
 * pairing token, and answers the `PanelRelayResponse` envelope carrying Core's
 * payload as Core returned it. Accepted only from the side panel or the popup.
 * A `projectId` left out means the project this browser's session belongs to.
 *
 * Core accepts the token on these endpoints only with a narrowed request
 * (`apps/web/src/lib/program-route.ts` in FluxIQ Core): a run names a saved
 * Flow and never an inline document, an LLM intent or external
 * side effects; a proposal is generated directly, never LLM-assisted; the
 * AI-key snapshot answers each key's kind, provider and enabled flag only.
 */
export const AUTOMATION_PANEL_MESSAGES = {
  /** `list-flow-summaries`, then `list-flow-runs` (`sort: "updated"`, `direction: "desc"`). Answers `{ flows, runs }`. */
  listAutomations: RUNTIME_MESSAGES.panelListAutomations,
  /** `run-runtime-session` with `{ projectId, flowId }` and nothing else. */
  runAutomation: RUNTIME_MESSAGES.panelRunAutomation,
  /** `get-flow-run-detail` (`compact: true`), then `list-flow-adaptations` for the run's Flow. Answers `{ runDetail, adaptations }`. */
  runDetail: RUNTIME_MESSAGES.panelRunDetail,
  /** `export-run-dataset` with `{ runId, datasetId, format }`. */
  exportDataset: RUNTIME_MESSAGES.panelExportDataset,
  /** `secret-keys` `snapshot`. Answers `{ keys }`, each key's `kind`, `provider` and `enabled` only. */
  modelReadiness: RUNTIME_MESSAGES.panelModelReadiness,
  /** `generate-recording-proposal` (`mode: "direct"`) for the recording this browser stopped last. */
  generateFromRecording: RUNTIME_MESSAGES.panelGenerateFromRecording,
  /** `run-runtime-session` for the proposal's Flow, as `runAutomation`. */
  testGeneratedAutomation: RUNTIME_MESSAGES.panelTestGeneratedAutomation,
  /** `review-recording-flow-proposal` with `decision: "approved"`. */
  saveGeneratedAutomation: RUNTIME_MESSAGES.panelSaveGeneratedAutomation,
  /**
   * Removes one step of the recording in progress, by the `ActivityEntry.id`
   * the recording log gave it: from the offline queue when it has not been
   * sent, otherwise through Core's `remove-recording-entry`.
   */
  removeRecordingStep: RUNTIME_MESSAGES.panelRemoveRecordingStep
} as const;

export type AutomationPanelMessageType = (typeof AUTOMATION_PANEL_MESSAGES)[keyof typeof AUTOMATION_PANEL_MESSAGES];

/** The fields automation panel requests carry beside `type`. Every field is optional on the wire and checked by the relay. */
export type AutomationPanelRequest = {
  projectId?: string | undefined;
  flowId?: string | undefined;
  runId?: string | undefined;
  datasetId?: string | undefined;
  format?: string | undefined;
  proposalId?: string | undefined;
  entryId?: string | undefined;
};

/**
 * The panel's "Report Problem" request: `{ type: PANEL_REPORT_PROBLEM_MESSAGE }`,
 * accepted only from the side panel or the popup. The background answers
 * `{ ok: true, report: ProblemReport }`; it never fails for want of FluxIQ,
 * because a report is most wanted when FluxIQ cannot be reached, and says in
 * `recentRuns` why Core's part is missing instead.
 */
export const PANEL_REPORT_PROBLEM_MESSAGE = RUNTIME_MESSAGES.panelReportProblem;

/**
 * A page telling the worker's page-load pace (`background/page-pace/`) about
 * a load on the site it is on. `load`: the page is about to load the next page
 * of a list, or reload a refused one, and asks how long to wait first; the
 * worker books the load and answers `PageLoadPaceAnswer`. `refused`: the
 * document the page is on was served with `status` (429 or 503), which slows
 * every later load on the site. The page sends nothing else -- no address, no
 * text; the worker takes the origin from the sender. A page with no pace behind
 * it (a read the worker did not send) gets no such answer and does not wait.
 */
export const PAGE_LOAD_PACE_MESSAGE = "fluxiq.pageLoad.pace";

export type PageLoadPaceMessage =
  | { type: typeof PAGE_LOAD_PACE_MESSAGE; kind: "load" }
  | { type: typeof PAGE_LOAD_PACE_MESSAGE; kind: "refused"; status: number };

/** The worker's answer to a `load`: how long the page waits before loading, 0 for at once. */
export type PageLoadPaceAnswer = { ok: true; waitMs: number };

/**
 * A diagnostic bundle a person can attach to a problem report, assembled by the
 * background worker (`background/diagnostics/`). It is built by allowlist:
 * versions, connection health, ids, states, and recent failures whose text has
 * been through `redactDiagnosticText`. It never holds the pairing token, the
 * pairing code, cookies, a page address beyond its origin, page text, recorded
 * events, typed values, or activity detail; `withheld` names those so a reader
 * knows they are absent by design rather than lost.
 */
export type ProblemReport = {
  schema: "fluxiq.problem-report/1";
  createdAt: string;
  extension: {
    version: string;
    browser: string;
    browserVersion?: string | undefined;
    platform: string;
    language: string;
  };
  connection: {
    state: ConnectionState;
    paired: boolean;
    autoReconnect: boolean;
    /** Scheme, host and port of the gateway address; no path or query. */
    gatewayOrigin: string;
    coreOrigin: string;
    queueSize: number;
    lastMessageAt?: number | undefined;
    lastError?: string | undefined;
  };
  session: {
    clientId: string;
    sessionId?: string | undefined;
    projectId?: string | null | undefined;
  };
  recording: {
    state: RecordingState;
    eventCount: number;
    startedAt?: number | undefined;
  };
  runtime: {
    state: RuntimeCommandStatus["state"];
    commandId?: string | undefined;
    actionType?: BrowserActionType | undefined;
    startedAt?: number | undefined;
    finishedAt?: number | undefined;
    error?: string | undefined;
  };
  /** Activity kinds and tones only: an activity's label and detail can quote the page. */
  recentActivity: Array<{ at: number; kind: string; tone: NonNullable<ActivityEntry["tone"]> }>;
  recentProblems: ProblemLogEntry[];
  recentRuns: { available: true; runs: ProblemReportRun[] } | { available: false; reason: string };
  withheld: string[];
};

/** One failure the background worker noted, its text already redacted. */
export type ProblemLogEntry = {
  at: number;
  source: "connection" | "action" | "saved-state" | "message" | "reconnect";
  message: string;
  commandId?: string | undefined;
  runId?: string | undefined;
};

/** A recent FluxIQ run as `list-runtime-sessions` summarises it, by allowlist. */
export type ProblemReportRun = {
  runId: string;
  status: string;
  targetKind?: string | undefined;
  flowId?: string | undefined;
  startedAt?: number | undefined;
  finishedAt?: number | undefined;
  attemptCount?: number | undefined;
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
  /**
   * A checkbox's or radio's checked state when it was described (B5). State
   * rather than a value, but for these two controls the state is everything
   * they hold, so a sensitive one reports none and no other control reports one.
   */
  checked?: boolean | undefined;
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
  /**
   * How many elements of this one's kind the snapshot held, this one included:
   * the same control, link or cell in every row of one repeated list or table
   * (`content/repeat-exemplars.ts`). Present only on the run's first member --
   * the exemplar -- and only when there are at least two. An annotation only:
   * every member is listed, in document order (t200). Snapshot-scoped, like the
   * two flags above: it counts what one capture held.
   */
  repeatCount?: number | undefined;
  /**
   * The element, one of its seven nearest ancestors, or an open shadow host
   * above it is painted `position: fixed` or `sticky`: it is on a layer the
   * page paints over itself -- a consent banner, a sticky action bar, a chat
   * launcher (`content/evidence/front-layer.ts`). Present only when true. A
   * fact, not an order: every element stays where the page put it (t200).
   * Snapshot-scoped, like `repeatCount`.
   */
  frontLayer?: true | undefined;
  /**
   * The element is one of the main region's own short statements about what
   * the page shows -- "No results for ...", "1-16 of 42 results", "Your cart
   * is empty" (`content/evidence/lead-statements.ts`). Present only when true,
   * on every element the rule recognises, in document order (t200).
   * Snapshot-scoped, like `repeatCount`.
   */
  leadStatement?: true | undefined;
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
  /**
   * That landmark's accessible name, where the page gave it one (B5). A role
   * alone cannot tell two `region`s on one page apart; their names can.
   */
  landmarkName?: string | undefined;
  /** The nearest preceding heading's text. */
  heading?: string | undefined;
  listPosition?: { index: number; total: number } | undefined;
  tablePosition?: { row: number; column: number; columnHeader?: string | undefined } | undefined;
  /**
   * The record -- a table row, a list item, a card -- the element belonged to,
   * where the page repeats one. A position says *where* the control was and a
   * fingerprint says *what* it was; on a page of 240 identical row actions
   * neither says *which*, so a replay resolved the recorded selector's
   * positional answer, agreed with it on every signal, and acted on another
   * record (`content/identity/record.ts`). This is what a replay checks the
   * answer against.
   *
   * `keyAttribute` travels with `key` so the page asks the candidate's record
   * for the same attribute rather than guessing. `text` is the fallback for a
   * record the author keyed by nothing, and is present only when the page held
   * more than one such record at capture time.
   *
   * `values` is never recorded: the domain writes it when a For Each pass runs
   * a step on the current row (`domain/src/output-nodes/native-runtime.ts`), as
   * the values the extraction read from that row. It takes precedence over
   * `key` and `text`, which name the row the Flow was built on, and the page
   * accepts a candidate only in a record holding every one of them.
   */
  record?: {
    keyAttribute?: string | undefined;
    key?: string | undefined;
    text?: string | undefined;
    values?: string[] | undefined;
  } | undefined;
  /**
   * The open shadow roots the element sat inside, outermost first, each named
   * by its host's selector within the tree that host sits in
   * (`content/selector/shadow-host-chain.ts`). A selector for an element in a
   * shadow tree is written within that tree, so on its own it names nothing in
   * the page: a chat widget's Close recorded as `div:nth-of-type(2) > div`
   * matched seven unrelated elements in the light document at replay. The
   * resolver walks this chain first and looks for the element only inside the
   * roots it reaches (`content/selector/shadow-scope.ts`). Absent for an
   * element in the document itself.
   */
  shadowHosts?: string[] | undefined;
};

/**
 * The five identity signals `DomElementDescriptor` groups above, named as a
 * union so both ends of the wire are joined to them by type rather than by
 * memory (Phase 1.3).
 *
 * They existed on the descriptor for a week without reaching the page: the
 * background worker's element projection was a hand-written key list, nobody
 * added them to it, and both sides' suites stayed green because a projection
 * that forgets a field compiles perfectly. The union and the two aliases below
 * are what make that failure a compile error instead.
 */
export type DomElementIdentitySignal = "testId" | "accessibleName" | "label" | "implicitRole" | "context";

/**
 * Descriptor fields the client-gateway element target deliberately does not
 * carry, each for a reason that survives being asked.
 *
 * - `hasValue`, `selectedValue` and `options` describe what a control *holds*.
 *   The recorded value travels as the event's own `inputValue`, which the
 *   sensitivity rule already governs, and a second copy of a control's contents
 *   on the target is a second place for a secret to escape from.
 * - `changed` and `recentlyInteracted` are snapshot-scoped (Phase 1.4): they
 *   say how one capture of a frame differs from the one before it, which is not
 *   a fact about the element a recorded event names.
 * - `repeatCount` is snapshot-scoped too: it counts how many rows one capture
 *   held, which a replay of the recorded control neither needs nor can check.
 * - `frontLayer` and `leadStatement` are snapshot-scoped the same way: they say
 *   where one capture found the element painted and what it said on that
 *   page, and only the snapshot's element list writes them.
 *
 * Nothing else may be left out silently. `WireElementTarget` is the descriptor
 * minus exactly this list, and the producer writes it through `present<T>()`,
 * so a field added to the descriptor stops the producer compiling until it is
 * either carried or named here.
 */
type UnwiredElementField = "hasValue" | "selectedValue" | "options" | "changed" | "recentlyInteracted" | "repeatCount" | "frontLayer" | "leadStatement";

/**
 * The recorded element's identity as it crosses the client gateway.
 *
 * This is the shape `background/connection/gateway-payloads.ts` sends and the
 * shape Core stores on a recording timeline entry, from which
 * `domain/src/output-nodes/targets.ts` `elementFingerprint` builds the element
 * every generated Flow replays against. A signal absent here is absent from
 * every replay, whatever the recorder captured.
 */
export type WireElementTarget = Omit<DomElementDescriptor, UnwiredElementField>;

/** A type that is only satisfiable when the argument is `never`. */
type Nothing<T extends never> = T;

/**
 * Compile-time proof that every identity signal crosses the wire: reclassify
 * one as `UnwiredElementField` and this alias stops compiling.
 *
 * A type rather than a test on purpose. The test beside the producer proves the
 * values arrive; this proves the *contract* cannot quietly stop asking for
 * them, which is the half a green suite has twice failed to notice.
 */
export type WiredIdentitySignals = Nothing<Exclude<DomElementIdentitySignal, keyof WireElementTarget>>;

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
   *
   * `evidence.elements.truncated` is this capture's element cap and nothing
   * else, and the capture has none (t200): every rendered element of every
   * frame is listed, so neither the content script nor the frame merge sets
   * it. A child frame that did not answer the merge is named in
   * `evidence.unansweredFrameIds` rather than dropped silently.
   */
  evidence?: PageEvidence | undefined;
};

// The evidence shapes are re-exported here so a consumer outside `content/` --
// the background worker's frame merge, above all -- reads one wire seam rather
// than reaching into the content script's modules for a type. Each is an alias
// of the domain's contract type, so a rename anywhere on this side of the wire
// fails to compile against the producer and both domain readers at once.
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
  // The extraction the user defined with the picker (X4). It is executable: the
  // definition it carries becomes a `web.dom.extract_list` or `web.dom.extract`
  // node, which is why it flushes the pending mutation batch like a click does.
  | "data.extract"
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
  /** A tab switch or close the background recorded; the recording-start marker has none. */
  tab?: WebAutomationRecordedTab | undefined;
  /**
   * `data.extract`: the extraction the user defined. Selectors, field keys,
   * labels and counts -- never a value read from the page (decision D3), and
   * never a column the user excluded (decision D12), which is absent from the
   * request itself rather than filtered out of the result.
   */
  extraction?: WebAutomationRecordedExtraction | undefined;
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
  WebAutomationExtractItemCondition,
  WebAutomationExtractListPagination,
  WebAutomationExtractListRequest,
  WebAutomationKeyModifiers,
  WebAutomationOptionSelector,
  WebAutomationScrollRequest,
  WebAutomationStructureDetection,
  WebAutomationStructureDetectionRequest,
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
