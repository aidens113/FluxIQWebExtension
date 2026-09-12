// The page-evidence wire contract: what a browser capture says about the page
// as a whole, rather than about one element.
//
// This is the **only** declaration of that shape. It is declared here, in the
// domain package, for one reason: the structure audit forbids `domain/src`
// importing `apps/extension/src` (`scripts/structure-audit/config.mjs`), and
// the extension may import the domain, so the domain is the one place both
// sides of the wire can reach. The extension's producer imports these types
// through `apps/extension/src/content/evidence/types.ts`, which re-exports them
// under the extension's shorter local spellings and adds nothing.
//
// ## Why it is here rather than restated twice
//
// It was restated twice, and the two restatements came apart three times in one
// plan:
//
//  - `capturedTruncated` read `snapshot.truncated`, a field no producer has
//    ever written, so the capture's element cap was dead at the packet;
//  - five page items (`loading`, `navigation`, `dialogs`, `blockedBy`,
//    `pendingNativeDialog`) were read at top-level paths against a producer
//    that writes one nested object, and `navigation`'s read shape had no
//    producer at all;
//  - a state-path ratchet passed vacuously over thirty `evidence.*` paths.
//
// None of the three was a careless edit. Each side was individually well
// tested -- against its own restatement of the shape. A shared type is what
// stops that: a producer that renames a field now fails to compile against
// every reader, because the readers reach the wire through
// `PageEvidenceWire<T>` in `./wire`, whose keys are these keys.
//
// The type alone was not enough, and it took a fourth near-miss to see why.
// TypeScript performs no excess-property check through an object spread, so a
// producer emitting an optional field as `...(label ? { label } : {})` could
// rename it to `title` with both packages' `check` and every test still green:
// the field simply stopped arriving. Every optional field on this contract was
// written that way, thirty-three times. So the producer now writes each field
// as a plain property through `present` in
// `apps/extension/src/content/evidence/present.ts`, which is checked against
// these keys and then drops the fields that came out `undefined`. `wire.ts` is
// how this contract is read; `present.ts` is how it is written.
//
// A type both sides satisfy can still be populated by neither, so the type is
// only half of it. `./capture.ts` is the other half: one capture taken from the
// real content script in a real browser, asserted by both readers.
//
// ## Rules for anything added here
//
// Every field is what a reader -- a person, a deterministic check, or a model
// reading the sanitized packet -- needs to decide whether an action can be
// attempted at all. So each shape stays compact and says one thing: selectors
// and counts rather than nested descriptors, bounded text rather than page
// content, and never a control's value, which belongs to nothing outside the
// page (the sensitivity rule lives in `domain/src/sensitivity/`).
//
// Nothing here may depend on the DOM lib. `documentState` and `visibility`
// would naturally be TypeScript's `DocumentReadyState` and
// `DocumentVisibilityState`; they are written out as unions instead, identical
// member for member, so the contract carries no browser dependency into a
// package that must not have one. The producer assigns the DOM values to them
// directly and the compiler checks the two agree.

/**
 * A rectangle on the page, in CSS pixels.
 *
 * Structurally identical to the extension's `RectDescriptor` and to the state
 * projection's `WebAutomationRect`, and deliberately so: those two are declared
 * for element geometry and this one for evidence geometry, and folding all
 * three into one is a change to `domain/src/recording/web-state/types.ts` that
 * belongs to whoever owns that file.
 */
export type WebAutomationEvidenceRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** `document.readyState`, written out so the contract needs no DOM lib. */
export type WebAutomationDocumentReadyState = "loading" | "interactive" | "complete";

/** `document.visibilityState`, written out so the contract needs no DOM lib. */
export type WebAutomationDocumentVisibility = "hidden" | "visible";

/** One dialog or modal the page is currently showing. */
export type WebAutomationDialogEvidenceItem = {
  selector: string;
  /** `dialog` for a native `<dialog>`, otherwise the ARIA role that made it one. */
  role: string;
  /** True when the page behind it cannot be acted on. */
  modal: boolean;
  /** True for a native `<dialog open>` rather than an ARIA-authored one. */
  native: boolean;
  label?: string | undefined;
  bounds?: WebAutomationEvidenceRect | undefined;
};

/** A native `alert`, `confirm` or `prompt` the page-world override answered. */
export type WebAutomationNativeDialogEvidence = {
  kind: "alert" | "confirm" | "prompt" | "beforeunload";
  message: string;
  response: "accept" | "dismiss";
  at: number;
};

export type WebAutomationDialogEvidence = {
  /** Every open dialog, top-most first -- reverse document order, which is the stacking order pages rely on. */
  open: WebAutomationDialogEvidenceItem[];
  /** True when any open dialog is modal, so nothing behind it is actionable. */
  modal: boolean;
  /**
   * An arming for `web.dom.dialog` written to the document and not yet taken by
   * the page-world override. It is true only in the window between writing and
   * acknowledgement, so a persistent `true` means the override is not installed.
   *
   * It is **not** "a native dialog is on screen". Nothing can report that: an
   * unanswered `alert` or `confirm` blocks the page's own script, so no snapshot
   * leaves the page while one stands. A reader that treats this as a pending
   * dialog tells its consumer the opposite of the truth.
   */
  armPending?: true | undefined;
  /** The most recent native dialog the override handled, as evidence after the fact. */
  lastNative?: WebAutomationNativeDialogEvidence | undefined;
};

/** Something painted over interactive controls, and what it covers. */
export type WebAutomationOverlayEvidenceItem = {
  selector: string;
  role?: string | undefined;
  label?: string | undefined;
  bounds?: WebAutomationEvidenceRect | undefined;
  /** Interactive candidates whose centre this element takes the hit for. */
  blocks: number;
  /** Selectors of the covered controls, capped. */
  blocked: string[];
};

export type WebAutomationOverlayEvidence = {
  /** Interactive candidates tested by the occlusion hit-test. */
  tested: number;
  /** How many of them something else answered for. */
  blockedCount: number;
  /** The blockers, most-blocking first; the first is the top-most. */
  blockers: WebAutomationOverlayEvidenceItem[];
};

export type WebAutomationLoadingIndicatorKind = "progressbar" | "spinner" | "status";

export type WebAutomationLoadingIndicator = {
  selector: string;
  kind: WebAutomationLoadingIndicatorKind;
  label?: string | undefined;
};

export type WebAutomationLoadingEvidence = {
  /** `document.readyState`. */
  documentState: WebAutomationDocumentReadyState;
  /** True when anything here says work is still in flight. */
  busy: boolean;
  /** Selectors of the regions the page marked `aria-busy="true"`. */
  busyRegions: string[];
  /** Progress bars, spinners and loading messages currently on screen. */
  indicators: WebAutomationLoadingIndicator[];
  /** The document has not finished loading, so the page is still arriving. */
  pendingNavigation: boolean;
};

/** One landmark region of the page, as a reader would name it. */
export type WebAutomationRegionEvidence = {
  /** The ARIA landmark role, explicit or implied by the tag. */
  role: string;
  label?: string | undefined;
  selector: string;
  bounds?: WebAutomationEvidenceRect | undefined;
};

/** A run of sibling elements the page renders from the same template. */
export type WebAutomationRepeatingStructureEvidence = {
  /** The element holding the run. */
  containerSelector: string;
  /** What the items have in common: tag, role, test-id pattern and shared classes. */
  signature: string;
  itemCount: number;
  /** The first item, so a reader can tell what the run holds. */
  representative: {
    selector: string;
    testId?: string | undefined;
    text?: string | undefined;
  };
  /** Test ids found inside the representative item, which name its fields. */
  fields?: string[] | undefined;
};

/** One control of a form. Presence of a value, never the value itself. */
export type WebAutomationFormControlEvidence = {
  selector: string;
  /** The input's `type`, or the tag for a `select` or `textarea`. */
  controlType: string;
  name?: string | undefined;
  label?: string | undefined;
  required?: true | undefined;
  disabled?: true | undefined;
  /** Whether the control holds a value. Sensitive controls report this too; their value never travels. */
  hasValue?: boolean | undefined;
  /**
   * The control's `autocomplete` tokens, so a consumer can ask the shared
   * sensitivity rule itself rather than trusting `sensitive` below.
   *
   * This is a signal, not a value: it is page markup naming what the field is
   * for, and it is the half of the rule that has leaked a card number twice in
   * this plan. Carrying it makes the two ends of the wire independent -- both
   * checks must fail before a value escapes, rather than the consumer inheriting
   * whatever the producer happened to conclude.
   */
  autocomplete?: string | undefined;
  /** True when the shared sensitivity rule marks the control, so no reader should ask for its value. */
  sensitive?: true | undefined;
};

export type WebAutomationFormEvidence = {
  selector: string;
  name?: string | undefined;
  label?: string | undefined;
  action?: string | undefined;
  method?: string | undefined;
  /** Controls the form owns, before the per-form cap. */
  controlCount: number;
  controls: WebAutomationFormControlEvidence[];
  /** The control that submits it, when the form has one. */
  submit?: string | undefined;
};

export type WebAutomationNavigationEvidence = {
  url: string;
  origin: string;
  path: string;
  referrer?: string | undefined;
  /** How this document was reached, from the Navigation Timing entry. */
  type?: string | undefined;
  redirects?: number | undefined;
  /** Session history entries, so a reader knows whether going back is possible. */
  historyLength: number;
  visibility: WebAutomationDocumentVisibility;
};

/**
 * How many elements the snapshot looked at against how many it carries. The
 * pre-filter totals are the point: without them a caller cannot tell a page
 * with forty controls from a page with four thousand whose tail was dropped.
 *
 * This is the first of four caps a page's elements pass on their way to a
 * reader, and `truncated` here reports only this one. The rule that keeps the
 * four apart is stated once, with the remedy for each, in
 * `domain/src/recording/web-state/evidence/input.ts`. In short: a bare
 * `truncated` is legal only inside the structure whose own cap set it, beside
 * that structure's counts; anywhere a flag would summarise more than one cap it
 * is named for the cap instead.
 */
export type WebAutomationSnapshotElementTotals = {
  /** Elements the generic sweep walked, before any filter. */
  scanned: number;
  /** Distinct candidates gathered across every pass. */
  candidates: number;
  /** Candidates that passed the inclusion filter. */
  matched: number;
  /** Descriptors the snapshot carries. */
  returned: number;
  /**
   * True when `matched` exceeded this capture's cap, so the lowest-ranked
   * descriptors were dropped before the snapshot left the page. This cap and
   * this cap only: it is read downstream as `captureTruncated`, and the remedy
   * is to capture less of the page (one frame, one region) rather than to ask
   * the projection or the packet for more.
   */
  truncated: boolean;
  /** Descriptors whose fingerprint differs from the previous snapshot of this frame. */
  changed: number;
  /** Descriptors the user has interacted with recently. */
  recentlyInteracted: number;
};

/**
 * The page-level evidence a snapshot carries. Empty collections are omitted.
 *
 * Gathered per frame, like the snapshot itself. On the recording path the
 * background worker merges every frame's into one
 * (`apps/extension/src/background/connection/dom-snapshot.ts`
 * `captureMergedTabSnapshot`): the additive items fold across every frame --
 * the element totals sum, and dialogs, overlays, regions, repeating runs and
 * forms concatenate -- while a child frame's selectors are qualified
 * `frame[<id>] >> <selector>` and its rects are placed on the top frame's page,
 * so they can be joined to the merged element list. `navigation` and
 * `loading.documentState` stay the top frame's, because each describes one
 * document and there is no honest merge of two: a merged snapshot can therefore
 * read `complete` and still be `busy`. The action path is top-frame only unless
 * a frame is addressed, where the two agree.
 */
export type WebAutomationPageEvidence = {
  elements: WebAutomationSnapshotElementTotals;
  loading: WebAutomationLoadingEvidence;
  navigation: WebAutomationNavigationEvidence;
  dialogs?: WebAutomationDialogEvidence | undefined;
  overlays?: WebAutomationOverlayEvidence | undefined;
  regions?: WebAutomationRegionEvidence[] | undefined;
  repeating?: WebAutomationRepeatingStructureEvidence[] | undefined;
  forms?: WebAutomationFormEvidence[] | undefined;
};
