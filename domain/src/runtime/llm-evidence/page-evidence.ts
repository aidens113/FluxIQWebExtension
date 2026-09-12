// The page-level evidence the packet carries beside its elements: which frame
// the capture came from, whether the page is still settling, whether a dialog
// or an overlay is standing in front of everything, what the user has
// selected, and how much of the page was left out.
//
// These are the items that cannot be derived from an element. The ones that
// can -- forms, landmarks and repeating structure -- ride on the elements
// themselves in `elements.ts`, so trimming an element for budget can never
// leave a page-level list pointing at something the packet no longer holds.
//
// ## Where every field is read from
//
// The producer is `apps/extension/src/content/evidence/`, which writes one
// nested `evidence` object on the snapshot. Its shape is
// `WebAutomationPageEvidence` in `domain/src/page-evidence/` -- one declaration,
// imported by the producer and by both of this package's readers -- and every
// read below goes through `pageEvidenceWire<T>` with the contract's own type,
// so a field renamed on either side of the wire stops compiling here.
//
// It did not always. This module was written against a guessed flat shape --
// `snapshot.loading`, `snapshot.navigation`, `snapshot.dialogs`,
// `snapshot.blockingOverlay`, `snapshot.pendingNativeDialog` -- and every one
// of those paths was empty against the real capture, so the model was handed
// nothing for the very items Phase 1.4 exists to give it. The tests passed
// because they built the shape this reader expected rather than the shape the
// producer emits. `domain/src/tests/page-evidence-joinery.test.ts` drives real
// captures (`page-evidence/capture.ts`) into this reader and into the state
// projection together, so the type is backed by data.
//
// The table is the contract. A left column entry with no right column entry is
// a packet field with no producer, and there are none: that is the invariant.
//
// | Packet field             | Snapshot path                                      | Note |
// | ------------------------ | -------------------------------------------------- | ---- |
// | `frame`                  | `frame.isTop`, plus `data-fluxiq-frame-id` on merged elements | |
// | `selectedText`           | `selectedText`                                      | |
// | `elementTotal`           | `elementTotal`, else `evidence.elements.matched`, else the elements carried | |
// | `captureTruncated`       | `truncated`, else `evidence.elements.truncated`     | the one field read at two paths, and why is on `capturedTruncated` |
// | `loading.readyState`     | `evidence.loading.documentState`                    | omitted when `complete` |
// | `loading.busy`           | `evidence.loading.busy`                             | |
// | `loading.spinner`        | `evidence.loading.indicators[].kind === "spinner"`  | |
// | `loading.pendingNavigation` | `evidence.loading.pendingNavigation`             | |
// | `navigation.type`        | `evidence.navigation.type`                          | omitted when `navigate` |
// | `navigation.redirects`   | `evidence.navigation.redirects`                     | omitted when none |
// | `navigation.referrer`    | `evidence.navigation.referrer`                      | origin and path only |
// | `dialogs[].role`         | `evidence.dialogs.open[].role`                      | |
// | `dialogs[].name`         | `evidence.dialogs.open[].label`                     | `name` is the packet's word for an accessible name, as on an element |
// | `dialogs[].modal`        | `evidence.dialogs.open[].modal`                     | |
// | `dialogs[].selector`     | `evidence.dialogs.open[].selector`                  | |
// | `blockedBy.selector`     | `evidence.overlays.blockers[0].selector`            | the producer orders them most-blocking first |
// | `blockedBy.role`         | `evidence.overlays.blockers[0].role`                | |
// | `blockedBy.name`         | `evidence.overlays.blockers[0].label`               | |
// | `blockedBy.blocks`       | `evidence.overlays.blockers[0].blocks`              | how many controls it takes the hit for |
//
// Two producer facts are deliberately not carried. `evidence.dialogs.armPending`
// is not "a native dialog is pending": it is an arming for `web.dom.dialog`
// that the page-world override has not acknowledged, so a persistent `true`
// means the override is missing, and a packet field called
// `pendingNativeDialog` fed from it would tell a model a dialog is on screen
// when none is. A native dialog that is actually on screen is not observable
// at all -- it blocks the page's script, so no snapshot can be taken while one
// stands. `evidence.dialogs.lastNative` is a dialog already answered, which is
// history rather than the state of the page, and it is not worth the bytes on
// a 3,000-byte failure packet.
//
// Every reader below is defensive over untrusted JSON, so a malformed field
// costs nothing and reports nothing rather than failing the whole packet. The
// contract fixes the key; the readers still decide whether the value is worth
// anything.
//
// The table has no exception: there is no packet field here without a producer.
// `pendingNativeDialog` used to be one -- unproduced, and unproducible, because
// an unanswered `alert` blocks the page's own script so no snapshot can leave
// the page while one stands -- and it is gone.

import type {
  PageEvidenceWire,
  WebAutomationDialogEvidence,
  WebAutomationDialogEvidenceItem,
  WebAutomationLoadingEvidence,
  WebAutomationLoadingIndicator,
  WebAutomationNavigationEvidence,
  WebAutomationOverlayEvidence,
  WebAutomationOverlayEvidenceItem,
  WebAutomationPageEvidence,
  WebAutomationSnapshotElementTotals
} from "../../page-evidence";
import { pageEvidenceWire } from "../../page-evidence";
import { WEB_LLM_EVIDENCE_BOUNDS } from "./limits";
import { evidenceLocation, safeEvidenceUrl } from "./location";
import { boundedCount, boundedText, isJsonRecord, trueFlag } from "./untrusted-json";

const READY_STATES = ["loading", "interactive", "complete"];
/** The navigation type of an ordinary link or address-bar visit: it tells a reader nothing it had not assumed. */
const ORDINARY_NAVIGATION_TYPE = "navigate";
/** A redirect chain longer than this is a page defect, not a fact worth carrying. */
const MAX_REDIRECTS = 100;
/** More controls than a page can hold; the bound only stops a hostile number reaching the packet. */
const MAX_BLOCKED_CONTROLS = 10_000;

export type WebLlmEvidenceFrame = {
  isTop: boolean;
  /** The child frames whose elements reached this packet, for a merged capture. */
  childFrameIds?: number[];
};

export type WebLlmEvidenceDialog = {
  role?: string;
  name?: string;
  modal?: true;
  selector?: string;
};

export type WebLlmPageContext = {
  frame?: WebLlmEvidenceFrame;
  loading?: { readyState?: string; busy?: true; spinner?: true; pendingNavigation?: true };
  /** How this document was reached, when that was anything other than an ordinary visit. */
  navigation?: { type?: string; redirects?: number; referrer?: string };
  dialogs?: WebLlmEvidenceDialog[];
  /** What is painted over the page's controls, and how many of them it takes the click for. */
  blockedBy?: { selector: string; role?: string; name?: string; blocks?: number };
  selectedText?: string;
  /** How many elements the page held before the capture's own filter, when that is more than the packet carries. */
  elementTotal?: number;
};

/** Every page-level item the snapshot can supply, each omitted when it says nothing. */
export function webLlmPageContext(snapshot: Record<string, unknown>, childFrameIds: number[]): WebLlmPageContext {
  const evidence = pageEvidence(snapshot);
  const frame = evidenceFrame(snapshot.frame, childFrameIds);
  const loading = evidenceLoading(pageEvidenceWire<WebAutomationLoadingEvidence>(evidence?.loading));
  const navigation = evidenceNavigation(pageEvidenceWire<WebAutomationNavigationEvidence>(evidence?.navigation));
  const dialogs = evidenceDialogs(pageEvidenceWire<WebAutomationDialogEvidence>(evidence?.dialogs));
  const blockedBy = evidenceBlocker(pageEvidenceWire<WebAutomationOverlayEvidence>(evidence?.overlays));
  const selectedText = boundedText(snapshot.selectedText, WEB_LLM_EVIDENCE_BOUNDS.text);
  return {
    ...(frame ? { frame } : {}),
    ...(loading ? { loading } : {}),
    ...(navigation ? { navigation } : {}),
    ...(dialogs ? { dialogs } : {}),
    ...(blockedBy ? { blockedBy } : {}),
    ...(selectedText ? { selectedText } : {})
  };
}

/**
 * The pre-filter element total the packet should report, or `undefined` when
 * it would only restate the number of elements already carried.
 *
 * It is the number half of `captureTruncated`: the flag says elements were cut
 * before the packet saw them and this says how many there were, so it reads
 * the same two places. `evidence.elements.matched` is what passed the content
 * script's inclusion filter before its cap; `scanned` is deliberately not
 * used, because it counts every node the sweep walked, most of which were
 * never candidates.
 */
export function evidenceElementTotal(snapshot: Record<string, unknown>, carried: number): number | undefined {
  const declared = boundedCount(snapshot.elementTotal, 10_000_000) ?? boundedCount(captureElementTotals(snapshot)?.matched, 10_000_000);
  const received = Array.isArray(snapshot.interactiveElements) ? snapshot.interactiveElements.length : 0;
  const total = Math.max(declared ?? 0, received);
  return total > carried ? total : undefined;
}

/**
 * Whether the capture itself says it dropped elements before the packet ever
 * saw them -- the `captureTruncated` limit, whose remedy is to capture less of
 * the page rather than to ask for a bigger packet.
 *
 * The content script reports its element funnel at `evidence.elements`
 * (`apps/extension/src/content/evidence/types.ts`), and that is the only place
 * the flag is written today. Reading only a bare top-level `truncated` -- the
 * shape the packet was first built against and which no producer has ever set
 * -- made this signal dead: a page whose tail had already been dropped in the
 * browser arrived at the model as `truncated: false`. The top-level flag is
 * still honoured beside the funnel, deliberately and unlike the five page
 * items above, because a host or a test that sets it is stating the same fact
 * and should not be silently ignored.
 */
export function capturedTruncated(snapshot: Record<string, unknown>): boolean {
  if (trueFlag(snapshot.truncated) === true) return true;
  return trueFlag(captureElementTotals(snapshot)?.truncated) === true;
}

/** The one nested object the producer writes its page evidence into. */
function pageEvidence(snapshot: Record<string, unknown>): PageEvidenceWire<WebAutomationPageEvidence> | undefined {
  return pageEvidenceWire<WebAutomationPageEvidence>(snapshot.evidence);
}

/** The content script's element funnel, when the snapshot carries one. */
function captureElementTotals(snapshot: Record<string, unknown>): PageEvidenceWire<WebAutomationSnapshotElementTotals> | undefined {
  return pageEvidenceWire<WebAutomationSnapshotElementTotals>(pageEvidence(snapshot)?.elements);
}

function items(input: unknown): unknown[] {
  return Array.isArray(input) ? input : [];
}

function evidenceFrame(input: unknown, childFrameIds: number[]): WebLlmEvidenceFrame | undefined {
  const declared = isJsonRecord(input) ? input : undefined;
  const isTop = typeof declared?.isTop === "boolean" ? declared.isTop : undefined;
  if (isTop === undefined && !childFrameIds.length) return undefined;
  return {
    isTop: isTop ?? true,
    ...(childFrameIds.length ? { childFrameIds } : {})
  };
}

function evidenceLoading(input: PageEvidenceWire<WebAutomationLoadingEvidence> | undefined): WebLlmPageContext["loading"] {
  if (!input) return undefined;
  const documentState = boundedText(input.documentState, WEB_LLM_EVIDENCE_BOUNDS.tag)?.toLowerCase();
  const readyState = documentState && READY_STATES.includes(documentState) ? documentState : undefined;
  const spinner = items(input.indicators)
    .map((indicator) => pageEvidenceWire<WebAutomationLoadingIndicator>(indicator))
    .some((indicator) => indicator?.kind === "spinner");
  const loading = {
    ...(readyState && readyState !== "complete" ? { readyState } : {}),
    ...(trueFlag(input.busy) ? { busy: true as const } : {}),
    ...(spinner ? { spinner: true as const } : {}),
    ...(trueFlag(input.pendingNavigation) ? { pendingNavigation: true as const } : {})
  };
  return Object.keys(loading).length ? loading : undefined;
}

function evidenceNavigation(input: PageEvidenceWire<WebAutomationNavigationEvidence> | undefined): WebLlmPageContext["navigation"] {
  if (!input) return undefined;
  const type = boundedText(input.type, WEB_LLM_EVIDENCE_BOUNDS.tag)?.toLowerCase();
  const redirects = boundedCount(input.redirects, MAX_REDIRECTS);
  const navigation = {
    ...(type && type !== ORDINARY_NAVIGATION_TYPE ? { type } : {}),
    ...(redirects ? { redirects } : {}),
    ...safeLocationField("referrer", input.referrer)
  };
  return Object.keys(navigation).length ? navigation : undefined;
}

/** A URL the page reported, reduced to origin and path, or nothing at all when it is not a safe HTTP(S) URL. */
function safeLocationField(key: "referrer", input: unknown): Record<string, string> {
  try {
    return { [key]: evidenceLocation(safeEvidenceUrl(input)) };
  } catch {
    return {};
  }
}

function evidenceDialogs(input: PageEvidenceWire<WebAutomationDialogEvidence> | undefined): WebLlmEvidenceDialog[] | undefined {
  if (!input) return undefined;
  const dialogs: WebLlmEvidenceDialog[] = [];
  for (const item of items(input.open).slice(0, WEB_LLM_EVIDENCE_BOUNDS.dialogs)) {
    const raw = pageEvidenceWire<WebAutomationDialogEvidenceItem>(item);
    if (!raw) continue;
    const role = boundedText(raw.role, WEB_LLM_EVIDENCE_BOUNDS.role);
    const name = boundedText(raw.label, WEB_LLM_EVIDENCE_BOUNDS.text);
    const selector = boundedText(raw.selector, WEB_LLM_EVIDENCE_BOUNDS.selector);
    const modal = trueFlag(raw.modal);
    if (!role && !name && !selector && !modal) continue;
    dialogs.push({
      ...(role ? { role } : {}),
      ...(name ? { name } : {}),
      ...(modal ? { modal } : {}),
      ...(selector ? { selector } : {})
    });
  }
  return dialogs.length ? dialogs : undefined;
}

/**
 * The one overlay worth naming: the producer orders its blockers most-blocking
 * first, so the head of the list is the thing a reader has to deal with. The
 * rest are usually its own ancestors and descendants, and none of them is what
 * a click has to get past.
 */
function evidenceBlocker(input: PageEvidenceWire<WebAutomationOverlayEvidence> | undefined): WebLlmPageContext["blockedBy"] {
  const blocker = items(input?.blockers)
    .map((item) => pageEvidenceWire<WebAutomationOverlayEvidenceItem>(item))
    .find((item) => item !== undefined);
  if (!blocker) return undefined;
  const selector = boundedText(blocker.selector, WEB_LLM_EVIDENCE_BOUNDS.selector);
  if (!selector) return undefined;
  const role = boundedText(blocker.role, WEB_LLM_EVIDENCE_BOUNDS.role);
  const name = boundedText(blocker.label, WEB_LLM_EVIDENCE_BOUNDS.text);
  const blocks = boundedCount(blocker.blocks, MAX_BLOCKED_CONTROLS);
  return {
    selector,
    ...(role ? { role } : {}),
    ...(name ? { name } : {}),
    ...(blocks ? { blocks } : {})
  };
}
