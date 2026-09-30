// The page-level evidence the packet carries beside its elements: which frame
// the capture came from and which child frames did not answer, whether the
// page is still settling and what says so, every dialog and everything painted
// over the page's controls, how the page was reached, and what the user has
// selected.
//
// These are the items that cannot be derived from an element. The ones that
// can -- forms, landmarks and repeating structure -- ride on the elements
// themselves in `elements.ts`.
//
// Nothing here is cut or chosen (t200). Until 2026-09-30 the packet named at
// most three dialogs, only the first blocker, reduced the loading indicators to
// a spinner flag, cut the selection to 300 characters and the referrer to its
// origin and path. Every dialog and every blocker is now listed in the order
// the producer reports them, each indicator with its label, and every string
// whole but screened (`./withheld.ts`, `./location.ts`).
//
// ## Where every field is read from
//
// The producer is `apps/extension/src/content/evidence/`, which writes one
// nested `evidence` object on the snapshot. Its shape is
// `WebAutomationPageEvidence` in `domain/src/page-evidence/` -- one declaration,
// imported by the producer and by both of this package's readers -- and every
// read below goes through `pageEvidenceWire<T>` with the contract's own type,
// so a field renamed on either side of the wire stops compiling here.
// `domain/src/tests/page-evidence-joinery.test.ts` drives real captures
// (`page-evidence/capture.ts`) into this reader and into the state projection
// together, so the type is backed by data.
//
// The table is the contract. A left column entry with no right column entry is
// a packet field with no producer, and there are none: that is the invariant.
//
// | Packet field                  | Snapshot path                                   | Note |
// | ----------------------------- | ----------------------------------------------- | ---- |
// | `frame.isTop`                 | `frame.isTop`                                   | |
// | `frame.childFrameIds`         | `data-fluxiq-frame-id` on merged elements       | |
// | `frame.unansweredFrameIds`    | `evidence.unansweredFrameIds`                   | child frames the merge got no snapshot from |
// | `selectedText`                | `selectedText`                                  | |
// | `captureTruncated`            | `truncated`, else `evidence.elements.truncated` | the capture itself left elements out |
// | `loading.readyState`          | `evidence.loading.documentState`                | omitted when `complete` |
// | `loading.busy`                | `evidence.loading.busy`                         | |
// | `loading.indicators[]`        | `evidence.loading.indicators[]`                 | `kind` and `label`, never the selector |
// | `loading.pendingNavigation`   | `evidence.loading.pendingNavigation`            | |
// | `navigation.url`              | `evidence.navigation.url`                       | screened as a location is |
// | `navigation.type`             | `evidence.navigation.type`                      | omitted when `navigate` |
// | `navigation.redirects`        | `evidence.navigation.redirects`                 | omitted when none |
// | `navigation.referrer`         | `evidence.navigation.referrer`                  | screened as a location is |
// | `dialogs[].role`              | `evidence.dialogs.open[].role`                  | |
// | `dialogs[].name`              | `evidence.dialogs.open[].label`                 | `name` is the packet's word for an accessible name, as on an element |
// | `dialogs[].modal`             | `evidence.dialogs.open[].modal`                 | |
// | `dialogs[].target`            | `evidence.dialogs.open[].selector`              | the handle of the element the capture described with it, never the selector |
// | `dialogs[].kind`              | `evidence.dialogs.open[].kind`                  | consent, robot_check, ... |
// | `blockedBy[].role`            | `evidence.overlays.blockers[].role`             | in document order, as the producer lists them |
// | `blockedBy[].name`            | `evidence.overlays.blockers[].label`            | |
// | `blockedBy[].blocks`          | `evidence.overlays.blockers[].blocks`           | how many controls it takes the hit for |
// | `blockedBy[].target`          | `evidence.overlays.blockers[].selector`         | as `dialogs[].target` |
// | `blockedBy[].kind`            | `evidence.overlays.blockers[].kind`             | |
//
// The same dialogs and blockers are also marked on the elements they are and
// cover (`./layers.ts`), which is where a model reading the elements meets them.
//
// Two producer facts are deliberately not carried. `evidence.dialogs.armPending`
// is not "a native dialog is pending": it is an arming for `web.dom.dialog`
// that the page-world override has not acknowledged, so a packet field fed
// from it would tell a model a dialog is on screen when none is. A native
// dialog that is actually on screen is not observable at all -- it blocks the
// page's script, so no snapshot can be taken while one stands.
// `evidence.dialogs.lastNative` is a dialog already answered, which is history
// rather than the state of the page. Selectors -- a dialog's, a blocker's, a
// busy region's, an indicator's -- are addresses, and no address is published:
// a dialog or a blocker is named by its element's handle instead, where the
// capture described it.
//
// Every reader below is defensive over untrusted JSON, so a malformed field
// costs nothing and reports nothing rather than failing the whole packet.

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
import { pageEvidenceWire, type WebAutomationLayerKind } from "../../page-evidence";
import { webLlmLayerKind } from "./layer-marks";
import { screenedEvidenceUrl } from "./location";
import { present } from "./present";
import { countValue, isJsonRecord, pageText, trueFlag } from "./untrusted-json";
import { screenedPageText } from "./withheld";

const READY_STATES = ["loading", "interactive", "complete"];
const INDICATOR_KINDS = ["progressbar", "spinner", "status"];
/** The navigation type of an ordinary link or address-bar visit: it tells a reader nothing it had not assumed. */
const ORDINARY_NAVIGATION_TYPE = "navigate";

export type WebLlmEvidenceFrame = {
  isTop: boolean;
  /** The child frames whose elements reached this packet, for a merged capture. */
  childFrameIds?: number[];
  /** Child frames the capture asked and got no answer from, so their elements are absent. */
  unansweredFrameIds?: number[];
};

/**
 * A dialog the model is told about so it can reason about what is on screen.
 * It carries no selector: nothing the model may do names a dialog, and the
 * packet is the one thing the model reads.
 */
export type WebLlmEvidenceDialog = {
  role?: string;
  name?: string;
  modal?: true;
  /** The handle of the element that is this dialog, where the capture described it. */
  target?: string;
  /** What the dialog is (a consent wall, a robot check), where the capture recognised it. */
  kind?: WebAutomationLayerKind;
};

/**
 * Something painted over the page's controls, and how many of them it takes
 * the click for. Described, never addressed: the model's answer to an overlay
 * is to say so, not to be handed a way to reach into it.
 */
export type WebLlmEvidenceBlocker = {
  role?: string;
  name?: string;
  blocks?: number;
  /** The handle of the element that is this blocker, where the capture described it. */
  target?: string;
  /** What the layer is, where the capture recognised it. */
  kind?: WebAutomationLayerKind;
};

/** A progress bar, spinner or loading message on screen, and what it says. */
export type WebLlmEvidenceLoadingIndicator = {
  kind: string;
  label?: string;
};

export type WebLlmPageContext = {
  frame?: WebLlmEvidenceFrame;
  loading?: { readyState?: string; busy?: true; indicators?: WebLlmEvidenceLoadingIndicator[]; pendingNavigation?: true };
  /** How this document was reached. */
  navigation?: { url?: string; type?: string; redirects?: number; referrer?: string };
  /** Every open dialog, top-most first. */
  dialogs?: WebLlmEvidenceDialog[];
  /** Everything painted over the page's controls, in document order. */
  blockedBy?: WebLlmEvidenceBlocker[];
  selectedText?: string;
};

/**
 * Every page-level item the snapshot can supply, each omitted when it says
 * nothing. `handleOf` names a capture selector by the handle of the element it
 * addresses (`./layers.ts`).
 */
export function webLlmPageContext(snapshot: Record<string, unknown>, childFrameIds: number[], handleOf: (selector: unknown) => string | undefined = () => undefined): WebLlmPageContext {
  const evidence = pageEvidence(snapshot);
  return present<WebLlmPageContext>({
    frame: evidenceFrame(snapshot.frame, childFrameIds, evidence?.unansweredFrameIds),
    loading: evidenceLoading(pageEvidenceWire<WebAutomationLoadingEvidence>(evidence?.loading)),
    navigation: evidenceNavigation(pageEvidenceWire<WebAutomationNavigationEvidence>(evidence?.navigation)),
    dialogs: evidenceDialogs(pageEvidenceWire<WebAutomationDialogEvidence>(evidence?.dialogs), handleOf),
    blockedBy: evidenceBlockers(pageEvidenceWire<WebAutomationOverlayEvidence>(evidence?.overlays), handleOf),
    selectedText: screenedPageText(snapshot.selectedText)
  });
}

/**
 * Whether the capture itself says it left elements out before the packet ever
 * saw them. The packet leaves nothing out of its own; this is the one way it
 * can be less than the page, and the remedy is the capture's, not the packet's.
 *
 * The content script reports its element funnel at `evidence.elements`
 * (`apps/extension/src/content/evidence/types.ts`). A bare top-level
 * `truncated` is honoured beside it, because a host or a test that sets it is
 * stating the same fact and should not be silently ignored.
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

function frameIds(input: unknown): number[] {
  const ids = items(input).flatMap((id) => {
    const value = countValue(id);
    return value === undefined ? [] : [value];
  });
  return [...new Set(ids)].sort((left, right) => left - right);
}

function evidenceFrame(input: unknown, childFrameIds: number[], unanswered: unknown): WebLlmEvidenceFrame | undefined {
  const declared = isJsonRecord(input) ? input : undefined;
  const isTop = typeof declared?.isTop === "boolean" ? declared.isTop : undefined;
  const unansweredFrameIds = frameIds(unanswered);
  if (isTop === undefined && !childFrameIds.length && !unansweredFrameIds.length) return undefined;
  return present<WebLlmEvidenceFrame>({
    isTop: isTop ?? true,
    childFrameIds: childFrameIds.length ? childFrameIds : undefined,
    unansweredFrameIds: unansweredFrameIds.length ? unansweredFrameIds : undefined
  });
}

function evidenceLoading(input: PageEvidenceWire<WebAutomationLoadingEvidence> | undefined): WebLlmPageContext["loading"] {
  if (!input) return undefined;
  const documentState = pageText(input.documentState)?.toLowerCase();
  const readyState = documentState && READY_STATES.includes(documentState) ? documentState : undefined;
  const indicators = items(input.indicators).flatMap((item) => {
    const indicator = pageEvidenceWire<WebAutomationLoadingIndicator>(item);
    const kind = pageText(indicator?.kind)?.toLowerCase();
    if (!indicator || !kind || !INDICATOR_KINDS.includes(kind)) return [];
    return [present<WebLlmEvidenceLoadingIndicator>({ kind, label: screenedPageText(indicator.label) })];
  });
  const loading = present<NonNullable<WebLlmPageContext["loading"]>>({
    readyState: readyState && readyState !== "complete" ? readyState : undefined,
    busy: trueFlag(input.busy),
    indicators: indicators.length ? indicators : undefined,
    pendingNavigation: trueFlag(input.pendingNavigation)
  });
  return Object.keys(loading).length ? loading : undefined;
}

function evidenceNavigation(input: PageEvidenceWire<WebAutomationNavigationEvidence> | undefined): WebLlmPageContext["navigation"] {
  if (!input) return undefined;
  const type = pageText(input.type)?.toLowerCase();
  const redirects = countValue(input.redirects);
  const navigation = present<NonNullable<WebLlmPageContext["navigation"]>>({
    url: screenedEvidenceUrl(input.url),
    type: type && type !== ORDINARY_NAVIGATION_TYPE ? type : undefined,
    redirects: redirects || undefined,
    referrer: screenedEvidenceUrl(input.referrer)
  });
  return Object.keys(navigation).length ? navigation : undefined;
}

function evidenceDialogs(input: PageEvidenceWire<WebAutomationDialogEvidence> | undefined, handleOf: (selector: unknown) => string | undefined): WebLlmEvidenceDialog[] | undefined {
  if (!input) return undefined;
  const dialogs = items(input.open).flatMap((item) => {
    const raw = pageEvidenceWire<WebAutomationDialogEvidenceItem>(item);
    if (!raw) return [];
    const dialog = present<WebLlmEvidenceDialog>({
      role: screenedPageText(raw.role),
      name: screenedPageText(raw.label),
      modal: trueFlag(raw.modal),
      target: handleOf(raw.selector),
      kind: webLlmLayerKind(raw.kind)
    });
    return Object.keys(dialog).length ? [dialog] : [];
  });
  return dialogs.length ? dialogs : undefined;
}

/**
 * Every blocker the producer reports, in the document order it lists them.
 * A blocker is reported when it says anything at all -- what it is, what it is
 * called, or how much it covers.
 */
function evidenceBlockers(input: PageEvidenceWire<WebAutomationOverlayEvidence> | undefined, handleOf: (selector: unknown) => string | undefined): WebLlmEvidenceBlocker[] | undefined {
  const blockers = items(input?.blockers).flatMap((item) => {
    const raw = pageEvidenceWire<WebAutomationOverlayEvidenceItem>(item);
    if (!raw) return [];
    const blocks = countValue(raw.blocks);
    const blocker = present<WebLlmEvidenceBlocker>({
      role: screenedPageText(raw.role),
      name: screenedPageText(raw.label),
      blocks: blocks || undefined,
      target: handleOf(raw.selector),
      kind: webLlmLayerKind(raw.kind)
    });
    return Object.keys(blocker).length ? [blocker] : [];
  });
  return blockers.length ? blockers : undefined;
}
