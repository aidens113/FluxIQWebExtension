// The web automation action vocabulary: what can be asked for, and what comes
// back. This is the one definition of the action command and the action result;
// the extension re-exports the result through `shared/protocol.ts` rather than
// keeping a copy, so the wire shape cannot drift between the domain, the
// background worker, and the content script.

import type { ElementFingerprint } from "fluxiq/automation-studio";
import type { JsonObject, JsonValue } from "fluxiq/core";
// The result's `failure` is Core's record with `code` narrowed to the closed
// set the browser path may produce. The two modules name each other -- the code
// set reads this module's text bound -- but only that direction is a value
// import; this one is type-only and erased, so nothing is loaded at runtime and
// no cycle exists in the bundle.
import type { WebAutomationFailureRecord } from "../runtime/failure";

export type WebAutomationActionType =
  | "web.browser.navigate"
  | "web.dom.click"
  | "web.dom.type"
  | "web.dom.clear"
  | "web.dom.select"
  | "web.dom.scroll"
  | "web.dom.keypress"
  | "web.dom.wait_for_selector"
  | "web.dom.wait_for_text"
  | "web.dom.extract"
  | "web.dom.capture_snapshot"
  | "web.dom.check"
  | "web.dom.assert"
  | "web.dom.extract_list"
  | "web.dom.upload"
  | "web.dom.dialog"
  | "web.browser.tab"
  | "web.browser.download";

export type WebAutomationPoint = { x: number; y: number };

/**
 * Who the recorded element was, in the vocabulary Core's element matcher scores
 * against runtime candidates (`fingerprinting/element-fingerprint.ts`).
 *
 * This is Core's `ElementFingerprint`, widened by the web-specific signals the
 * domain already puts on the wire — it is not a third element-descriptor shape.
 * `output-nodes/targets.ts` `elementFingerprint` is the one producer, and its
 * output is exactly this: Core's signals plus `text`, `value`, `name`, `href`,
 * `inputType` and `implicitRole`. Core's matcher ignores the extras; the page
 * does not, so declaring only Core's half would hide fields the content script
 * already reads (`content/element-finder.ts` matches on `name`, and
 * `resolve-target.ts` falls back to `implicitRole` for the candidate family).
 */
export type WebAutomationElementFingerprint = ElementFingerprint & {
  /** The element's own text, as the recorder trimmed it. Core weighs `visibleText`, not this. */
  text?: string | undefined;
  /** A non-sensitive control's value. A sensitive control never yields one. */
  value?: string | undefined;
  /** The authored `name` attribute, which `content/element-finder.ts` looks elements up by. */
  name?: string | undefined;
  href?: string | undefined;
  inputType?: string | undefined;
  /** The role the markup implies when no `role` attribute was authored. */
  implicitRole?: string | undefined;
};

export type WebAutomationActionVisualTarget = {
  namespace: "web";
  statePath: string;
  selector?: string | undefined;
  frameId?: string | undefined;
  layerId?: string | undefined;
  documentLayerId?: string | undefined;
  bounds?: { x: number; y: number; width: number; height: number } | undefined;
  documentBounds?: { x: number; y: number; width: number; height: number } | undefined;
  anchor?: { type: "bounds"; bounds: { x: number; y: number; width: number; height: number } } | undefined;
  confidence?: number | undefined;
  metadata?: JsonObject | undefined;
};

/** How `web.dom.select` names the option to choose. A request that matches no option changes nothing. */
export type WebAutomationOptionSelector =
  | { by: "value"; value: string }
  | { by: "label"; label: string }
  | { by: "index"; index: number };

/**
 * How `web.dom.scroll` moves: `by` a delta, `toElement` to bring the resolved
 * target into view, or `untilStable` repeatedly until the document stops
 * growing or `maxScrolls` scrolls have happened. `maxScrolls` is required so an
 * infinite feed can never scroll forever.
 */
export type WebAutomationScrollRequest =
  | { mode: "by"; x?: number | undefined; y?: number | undefined }
  | { mode: "toElement" }
  | { mode: "untilStable"; maxScrolls: number; y?: number | undefined };

/** What a wait waits for. `present` is existence in the DOM, the only condition before Phase 1.2. */
export type WebAutomationWaitCondition = "present" | "visible" | "enabled" | "absent" | "url" | "stable";

export type WebAutomationWaitRequest = {
  condition: WebAutomationWaitCondition;
  /** The URL the `url` condition waits to land on. */
  url?: string | undefined;
  /** How long the page must stop changing for, under the `stable` condition. */
  stableForMs?: number | undefined;
};

export type WebAutomationKeyModifiers = {
  alt?: boolean | undefined;
  ctrl?: boolean | undefined;
  meta?: boolean | undefined;
  shift?: boolean | undefined;
};

/** Follow the `next` control until it is absent or `maxPages` pages, the first included, were read. */
export type WebAutomationExtractListPagination = { next: string; maxPages: number };

/**
 * `web.dom.extract_list` over a repeating structure, mirroring the scenario
 * contract's extract step (`packages/test-contracts/src/scenario.ts`): `item`
 * selects each record's root, and `fields` maps a field name to a selector
 * inside it. `selector@attribute` reads an attribute rather than text, and
 * `column:<header text>` reads the cell under that header when the items are
 * table rows, so extraction survives a column reorder.
 */
export type WebAutomationExtractListRequest = {
  item: string;
  fields: Record<string, string>;
  paginate?: WebAutomationExtractListPagination | undefined;
  maxItems?: number | undefined;
};

/** What `web.dom.assert` claims about the page. `expected` carries the text or URL for `text` and `url`. */
export type WebAutomationAssertKind = "exists" | "absent" | "text" | "url" | "visible" | "enabled";

export type WebAutomationAssertRequest = {
  kind: WebAutomationAssertKind;
  expected?: string | undefined;
  timeoutMs?: number | undefined;
};

/** One file for `web.dom.upload`, carried inline because the page, not the worker, owns the file input. */
export type WebAutomationUploadFile = { name: string; mimeType: string; contentBase64: string };

export type WebAutomationUploadRequest = { files: WebAutomationUploadFile[] };

/** How the next native dialog is answered. `promptText` is the reply to a `prompt`, and only with `accept`. */
export type WebAutomationDialogRequest = {
  response: "accept" | "dismiss";
  promptText?: string | undefined;
};

/** `web.browser.tab`. A switch names the tab by id, or by the URL substring its address must contain. */
export type WebAutomationTabRequest =
  | { operation: "open"; url?: string | undefined; active?: boolean | undefined }
  | { operation: "switch"; tabId?: number | undefined; urlPattern?: string | undefined }
  | { operation: "close"; tabId?: number | undefined };

/** `web.browser.download`: wait for a download, optionally the one with this file name, to complete. */
export type WebAutomationDownloadRequest = {
  filename?: string | undefined;
  timeoutMs?: number | undefined;
};

export type WebAutomationActionCommand = {
  commandId: string;
  actionType: WebAutomationActionType;
  tabId?: number | undefined;
  frameId?: number | undefined;
  selector?: string | undefined;
  text?: string | undefined;
  value?: string | undefined;
  key?: string | undefined;
  url?: string | undefined;
  timeoutMs?: number | undefined;
  coordinates?: WebAutomationPoint | undefined;
  visualTarget?: WebAutomationActionVisualTarget | undefined;
  /**
   * Who the target was when it was recorded, so the page can recognize it again
   * after its selector, id or class have drifted.
   *
   * The same value also travels inside `options` — it is one of the raw
   * parameters — and the resolver reads it from there today. This field is the
   * declared half of that contract: `options` is an untyped bag that nothing
   * checks, so a rename on either side would break resolution silently. It is
   * also the *better* half after Core has adapted the target, because
   * `output-nodes/targets.ts` builds the dispatched `target.element` from the
   * candidate Core matched, while `parameters.element` is still the one that
   * was recorded.
   */
  element?: WebAutomationElementFingerprint | undefined;
  /** `web.browser.navigate`: open a new tab instead of reusing the automation tab. */
  newTab?: boolean | undefined;
  /** `web.dom.select`, when the option is named by label or index rather than by `value`. */
  option?: WebAutomationOptionSelector | undefined;
  /** `web.dom.scroll`. Without it a scroll is the legacy absolute `options.x`/`options.y` move. */
  scroll?: WebAutomationScrollRequest | undefined;
  /** The two waits. Without it a wait is the legacy `present` condition. */
  wait?: WebAutomationWaitRequest | undefined;
  /** `web.dom.keypress`. */
  modifiers?: WebAutomationKeyModifiers | undefined;
  /** `web.dom.check`: the state to leave the checkbox or radio in. */
  checked?: boolean | undefined;
  /** `web.dom.extract_list`. */
  extractList?: WebAutomationExtractListRequest | undefined;
  /** `web.dom.assert`. */
  assert?: WebAutomationAssertRequest | undefined;
  /** `web.dom.upload`. */
  upload?: WebAutomationUploadRequest | undefined;
  /** `web.dom.dialog`: arms the answer to the next native dialog. */
  dialog?: WebAutomationDialogRequest | undefined;
  /** `web.browser.tab`. */
  tab?: WebAutomationTabRequest | undefined;
  /** `web.browser.download`. */
  download?: WebAutomationDownloadRequest | undefined;
  options?: JsonObject | undefined;
};

/**
 * The result status, exactly Core's `ClientGatewayActionResult` union
 * (`packages/contracts/src/client-gateway.ts`), so nothing is flattened on the
 * way to the gateway. There is no `rejected` member: a refused action type is
 * answered before anything is dispatched and never produces an action result.
 */
export type WebAutomationActionStatus = "succeeded" | "failed" | "timed_out" | "cancelled" | "unknown";

/** Why an action carries no post-condition: it only observed the page, or its verb has not been given one yet. */
export type WebAutomationValidationSkipReason = "evidence-only" | "not-yet-validated";

/**
 * The post-condition an action checked after it ran (decision D4). Every result
 * carries one, so an action cannot complete as a silent no-op: `passed` and
 * `failed` both say what was expected and what was observed, and `none` has to
 * name a reason. A `failed` validation makes the whole result `failed` with the
 * `output_not_observed` category.
 *
 * `redacted` is the producer's declaration that it built these two strings
 * without quoting the control's value -- a verb naming a length rather than a
 * secret. It is the one thing the domain cannot work out for itself: it can ask
 * `isSensitiveElementDescriptor` whether the target holds a secret, but not
 * whether a string it is handed has already been withheld, so without the flag
 * both exits (`client/gateway-mapping.ts` and `runtime/adapter.ts`) must
 * withhold every comparison on a sensitive control and the producer's useful
 * phrasing is lost with the leak it never contained.
 *
 * The flag covers every comparison the result carries -- this validation's two
 * strings, and the failure record's `expected` and `actual`, which the producer
 * builds from the same two. It is read through `isProducerRedactedComparison`,
 * which **fails safe when absent**: an unmarked validation is treated as
 * unredacted and withheld, so an older client or a verb nobody taught the flag
 * cannot leak by omission. Setting it while still quoting a value is therefore
 * the one way to defeat the guard, which is why it is a declaration by the code
 * that built the strings and never an inference from them.
 */
export type WebAutomationActionValidation =
  | { status: "passed"; expected: string; actual: string; redacted?: boolean | undefined }
  | { status: "failed"; expected: string; actual: string; redacted?: boolean | undefined }
  | { status: "none"; reason: WebAutomationValidationSkipReason };

/** How the element an action ran on was found, and how sure the resolver was (Phase 1.3). */
export type WebAutomationTargetStrategy =
  | "selector"
  | "coordinates"
  | "visual-target"
  | "fingerprint"
  | "active-element"
  | "scored-candidate";

export type WebAutomationTargetResolution = {
  strategy: WebAutomationTargetStrategy;
  /** How many candidates were considered. Exact strategies that matched at once report 1. */
  candidateCount: number;
  bestScore?: number | undefined;
  runnerUpScore?: number | undefined;
  confidence?: number | undefined;
};

/**
 * The one action result. `TElement` and `TSnapshot` are the shapes of the
 * element descriptor and the page snapshot: the domain sees them as JSON, and
 * the extension binds its own richer `DomElementDescriptor` and `DomSnapshot`
 * without redeclaring any other field.
 *
 * `failure` is Core's structured failure record with one field narrowed: the
 * category vocabulary is Core's, imported rather than restated, while `code` is
 * the closed set in `runtime/failure`. Core types `code` as a bare `string`
 * because it does not own the codes; this is where the producer's own
 * vocabulary is pinned, so a record with an invented code cannot be put on a
 * result at all -- by the content script, the worker, the domain, or a test.
 */
export type WebAutomationActionResult<TElement = JsonObject, TSnapshot = JsonObject> = {
  commandId: string;
  actionType: WebAutomationActionType;
  status: WebAutomationActionStatus;
  validation: WebAutomationActionValidation;
  message?: string | undefined;
  url?: string | undefined;
  title?: string | undefined;
  element?: TElement | undefined;
  visualTarget?: WebAutomationActionVisualTarget | undefined;
  snapshot?: TSnapshot | undefined;
  extracted?: JsonValue | undefined;
  resolution?: WebAutomationTargetResolution | undefined;
  failure?: WebAutomationFailureRecord | undefined;
  startedAt: number;
  finishedAt: number;
};

/**
 * The bound on a validation's `expected` and `actual`. It is Core's
 * `AUTOMATION_STUDIO_FAILURE_RECORD_LIMITS.textMaxLength`, restated as a
 * number because the content script must not import Core's runtime: a failed
 * validation becomes a failure record's `expected` and `actual`, and Core's
 * parser drops a record that exceeds the bound whole rather than truncating it.
 * `domain/src/tests/action-result.test.ts` asserts the two agree.
 */
export const WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH = 1_024;

/** Upper bound on the pages one `web.dom.extract_list` may follow, mirroring the scenario contract's own. */
export const WEB_AUTOMATION_EXTRACT_MAX_PAGES = 50;

/** Bounds on `web.dom.upload`, so a file cannot make an action command unbounded on the wire. */
export const WEB_AUTOMATION_UPLOAD_MAX_FILE_BYTES = 1_048_576;
export const WEB_AUTOMATION_UPLOAD_MAX_TOTAL_BYTES = 4_194_304;

export const WEB_AUTOMATION_ACTION_TYPES: WebAutomationActionType[] = [
  "web.browser.navigate",
  "web.dom.click",
  "web.dom.type",
  "web.dom.clear",
  "web.dom.select",
  "web.dom.scroll",
  "web.dom.keypress",
  "web.dom.wait_for_selector",
  "web.dom.wait_for_text",
  "web.dom.extract",
  "web.dom.capture_snapshot",
  "web.dom.check",
  "web.dom.assert",
  "web.dom.extract_list",
  "web.dom.upload",
  "web.dom.dialog",
  "web.browser.tab",
  "web.browser.download"
];

/**
 * Each canonical output id mapped to the legacy dotted browser action alias it
 * replaced. The seven actions added in Week 1 were never on the wire under a
 * dotted name, so their alias is the name a pre-`web.` client would have used
 * and exists only to keep this map total.
 */
export const WEB_AUTOMATION_ACTION_TO_LEGACY_BROWSER = {
  "web.browser.navigate": "browser.navigate",
  "web.dom.click": "dom.click",
  "web.dom.type": "dom.type",
  "web.dom.clear": "dom.clear",
  "web.dom.select": "dom.select",
  "web.dom.scroll": "dom.scroll",
  "web.dom.keypress": "dom.keypress",
  "web.dom.wait_for_selector": "dom.wait_for_selector",
  "web.dom.wait_for_text": "dom.wait_for_text",
  "web.dom.extract": "dom.extract",
  "web.dom.capture_snapshot": "dom.capture_snapshot",
  "web.dom.check": "dom.check",
  "web.dom.assert": "dom.assert",
  "web.dom.extract_list": "dom.extract_list",
  "web.dom.upload": "dom.upload",
  "web.dom.dialog": "dom.dialog",
  "web.browser.tab": "browser.tab",
  "web.browser.download": "browser.download"
} as const satisfies Record<WebAutomationActionType, string>;
