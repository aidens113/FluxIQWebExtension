// What the snapshot says about the page as a whole, rather than about one
// element: the dialogs standing in front of it, what is covering its controls,
// whether it is still working, how it is laid out, what repeats on it, the
// forms it holds, and how it was navigated to.
//
// Every field is what a reader -- a person, a deterministic check, or a model
// reading the sanitized packet -- needs to decide whether an action can be
// attempted at all. So each shape stays compact and says one thing: selectors
// and counts rather than nested descriptors, bounded text rather than page
// content, and never a control's value, which belongs to nothing outside the
// page (the sensitivity rule lives in `shared/sensitive-field.ts`).
//
// `RectDescriptor` comes from the protocol rather than from `../types` so this
// module can be read without pulling the content script's own type surface in
// behind it.

import type { RectDescriptor } from "../../shared/protocol";

/** One dialog or modal the page is currently showing. */
export type DialogEvidenceItem = {
  selector: string;
  /** `dialog` for a native `<dialog>`, otherwise the ARIA role that made it one. */
  role: string;
  /** True when the page behind it cannot be acted on. */
  modal: boolean;
  /** True for a native `<dialog open>` rather than an ARIA-authored one. */
  native: boolean;
  label?: string | undefined;
  bounds?: RectDescriptor | undefined;
};

/** A native `alert`, `confirm` or `prompt` the page-world override answered. */
export type NativeDialogEvidence = {
  kind: "alert" | "confirm" | "prompt" | "beforeunload";
  message: string;
  response: "accept" | "dismiss";
  at: number;
};

export type DialogEvidence = {
  /** Every open dialog, top-most first -- reverse document order, which is the stacking order pages rely on. */
  open: DialogEvidenceItem[];
  /** True when any open dialog is modal, so nothing behind it is actionable. */
  modal: boolean;
  /**
   * An arming for `web.dom.dialog` written to the document and not yet taken by
   * the page-world override. It is true only in the window between writing and
   * acknowledgement, so a persistent `true` means the override is not installed.
   */
  armPending?: true | undefined;
  /** The most recent native dialog the override handled, as evidence after the fact. */
  lastNative?: NativeDialogEvidence | undefined;
};

/** Something painted over interactive controls, and what it covers. */
export type OverlayEvidenceItem = {
  selector: string;
  role?: string | undefined;
  label?: string | undefined;
  bounds?: RectDescriptor | undefined;
  /** Interactive candidates whose centre this element takes the hit for. */
  blocks: number;
  /** Selectors of the covered controls, capped. */
  blocked: string[];
};

export type OverlayEvidence = {
  /** Interactive candidates tested by the occlusion hit-test. */
  tested: number;
  /** How many of them something else answered for. */
  blockedCount: number;
  /** The blockers, most-blocking first; the first is the top-most. */
  blockers: OverlayEvidenceItem[];
};

export type LoadingIndicatorKind = "progressbar" | "spinner" | "status";

export type LoadingIndicator = {
  selector: string;
  kind: LoadingIndicatorKind;
  label?: string | undefined;
};

export type LoadingEvidence = {
  /** `document.readyState`. */
  documentState: DocumentReadyState;
  /** True when anything here says work is still in flight. */
  busy: boolean;
  /** Selectors of the regions the page marked `aria-busy="true"`. */
  busyRegions: string[];
  /** Progress bars, spinners and loading messages currently on screen. */
  indicators: LoadingIndicator[];
  /** The document has not finished loading, so the page is still arriving. */
  pendingNavigation: boolean;
};

/** One landmark region of the page, as a reader would name it. */
export type RegionEvidence = {
  /** The ARIA landmark role, explicit or implied by the tag. */
  role: string;
  label?: string | undefined;
  selector: string;
  bounds?: RectDescriptor | undefined;
};

/** A run of sibling elements the page renders from the same template. */
export type RepeatingStructureEvidence = {
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
export type FormControlEvidence = {
  selector: string;
  /** The input's `type`, or the tag for a `select` or `textarea`. */
  controlType: string;
  name?: string | undefined;
  label?: string | undefined;
  required?: true | undefined;
  disabled?: true | undefined;
  /** Whether the control holds a value. Sensitive controls report this too; their value never travels. */
  hasValue?: boolean | undefined;
  /** True when the shared sensitivity rule marks the control, so no reader should ask for its value. */
  sensitive?: true | undefined;
};

export type FormEvidence = {
  selector: string;
  name?: string | undefined;
  label?: string | undefined;
  action?: string | undefined;
  method?: string | undefined;
  /** Controls the form owns, before the per-form cap. */
  controlCount: number;
  controls: FormControlEvidence[];
  /** The control that submits it, when the form has one. */
  submit?: string | undefined;
};

export type NavigationEvidence = {
  url: string;
  origin: string;
  path: string;
  referrer?: string | undefined;
  /** How this document was reached, from the Navigation Timing entry. */
  type?: string | undefined;
  redirects?: number | undefined;
  /** Session history entries, so a reader knows whether going back is possible. */
  historyLength: number;
  visibility: DocumentVisibilityState;
};

/**
 * How many elements the snapshot looked at against how many it carries. The
 * pre-filter totals are the point: without them a caller cannot tell a page
 * with forty controls from a page with four thousand whose tail was dropped.
 */
export type SnapshotElementTotals = {
  /** Elements the generic sweep walked, before any filter. */
  scanned: number;
  /** Distinct candidates gathered across every pass. */
  candidates: number;
  /** Candidates that passed the inclusion filter. */
  matched: number;
  /** Descriptors the snapshot carries. */
  returned: number;
  /** True when `matched` exceeded the cap, so the lowest-ranked were dropped. */
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
 * (`background/connection/dom-snapshot.ts captureMergedTabSnapshot`): the
 * additive items fold across every frame -- the element totals sum, and
 * dialogs, overlays, regions, repeating runs and forms concatenate -- while a
 * child frame's selectors are qualified `frame[<id>] >> <selector>` and its
 * rects are placed on the top frame's page, so they can be joined to the merged
 * element list. `navigation` and `loading.documentState` stay the top frame's,
 * because each describes one document and there is no honest merge of two: a
 * merged snapshot can therefore read `complete` and still be `busy`. The action
 * path is top-frame only unless a frame is addressed, where the two agree.
 */
export type PageEvidence = {
  elements: SnapshotElementTotals;
  loading: LoadingEvidence;
  navigation: NavigationEvidence;
  dialogs?: DialogEvidence | undefined;
  overlays?: OverlayEvidence | undefined;
  regions?: RegionEvidence[] | undefined;
  repeating?: RepeatingStructureEvidence[] | undefined;
  forms?: FormEvidence[] | undefined;
};
