// The `extraction.propose` content message: what the background worker asks a
// frame for when the user picks an element, and what that frame answers.
//
// It lives here rather than in `shared/protocol.ts` because that file is the
// action and snapshot wire, already 449 lines, and this is a message pair of
// its own. The content script answers it from `content/message-handler.ts`; the
// picker (X4) sends it, and the content harness sends it to prove inference on
// a real page.
//
// A proposal holds selectors, names and counts only, never a value read from
// the page (decision D3): the reply crosses a message channel and is shown
// before the user has decided which columns are sensitive, so `refused` says
// why in a fixed vocabulary rather than quoting anything the page holds.

import type {
  WebAutomationExtractFieldHandling,
  WebAutomationExtractFieldKind,
  WebAutomationExtractListPagination,
  WebAutomationExtractListRequest,
  WebAutomationExtractionProposal,
  WebAutomationRecordedExtraction
} from "@fluxiq-web-extension/domain/client";

/** The message name, which the background worker and the content script must spell identically. */
export const EXTRACTION_PROPOSE_MESSAGE = "extraction.propose";

/** Propose an extraction for the element `selector` names in this frame. */
export type ExtractionProposeMessage = {
  type: typeof EXTRACTION_PROPOSE_MESSAGE;
  /** A selector for the picked element, resolved in the frame that receives the message. */
  selector: string;
};

/**
 * Why no proposal was made, as a fact about page structure:
 * `target_not_found`, nothing in this frame matched the selector;
 * `no_repeating_run`, the element belongs to no run of at least three items
 * that a selector can name and that exposes a field to read.
 */
export type ExtractionProposeRefusal = "target_not_found" | "no_repeating_run";

export type ExtractionProposeResponse =
  | { ok: true; proposal: WebAutomationExtractionProposal }
  | { ok: false; refused: ExtractionProposeRefusal };

// The picker's message names (X4). They live here, rather than in
// `shared/constants.ts`, so that the content picker, the background control and
// the popup UI can be built against one spelling without waiting on each other.
// Payload types are added beside each name by the picker; a name is grouped
// into a const object rather than exported one by one because this file is
// budgeted at 15 exported values and the names alone would exhaust it.

/** Messages the background worker sends into a frame's content script. */
export const EXTRACTION_CONTENT_MESSAGES = {
  /** Begin picking: show the overlay and capture the next click. */
  pickStart: "extraction.pick_start",
  /** Stop picking and remove the overlay, with nothing chosen. */
  pickCancel: "extraction.pick_cancel",
  /** Read at most `limit` (≤ 20) rows for the confirmation preview. */
  preview: "extraction.preview",
  /** Put `data.extract` in the recording for the confirmed definition. */
  record: "extraction.record"
} as const;

/** The name a frame uses to tell the background worker what the user picked. */
export const EXTRACTION_PICKED_MESSAGE = "fluxiq.extractionPicked";

/**
 * Runtime messages between the popup or side panel and the background worker.
 * `testDefineExtraction` is accepted from the control page only and never from
 * a page under test; it exists so the Testing Lab can drive the confirm path
 * without a human pick.
 */
export const EXTRACTION_RUNTIME_MESSAGES = {
  start: "fluxiq.extractionStart",
  confirm: "fluxiq.extractionConfirm",
  cancel: "fluxiq.extractionCancel",
  getSession: "fluxiq.getExtractionSession",
  testDefineExtraction: "fluxiq.test.defineExtraction"
} as const;

/** Which shape of extraction a pick is for: a list of records, or one value. */
export type ExtractionPickForm = "list" | "value";

/**
 * A picked element as structure alone: where it is, never what it says.
 *
 * A `value` pick has no proposal to send, so this is what crosses instead, and
 * D3 binds it exactly as it binds a proposal -- hence a selector, a tag name
 * and a test id, and no text, value or attribute read off the element.
 */
export type ExtractionPickedElement = {
  selector: string;
  tagName: string;
  testId?: string | undefined;
};

/**
 * One preview row: an included field key, and what the page read for it.
 *
 * Preview rows are the one extraction payload that does carry page values, and
 * they travel only from the frame to the extension's own UI, for the user to
 * see before confirming. They are never recorded, never stored and never
 * exported (D3), and an excluded column is absent from the request that
 * produced them rather than filtered out afterwards (D12).
 */
export type ExtractionPreviewRow = Record<string, string | null>;

/** What the background worker sends into a frame's content script. */
export type ExtractionContentMessage =
  | { type: typeof EXTRACTION_CONTENT_MESSAGES.pickStart; sessionId: string; form?: ExtractionPickForm }
  | { type: typeof EXTRACTION_CONTENT_MESSAGES.pickCancel; sessionId: string }
  | { type: typeof EXTRACTION_CONTENT_MESSAGES.preview; sessionId: string; request: WebAutomationExtractListRequest; limit?: number }
  | { type: typeof EXTRACTION_CONTENT_MESSAGES.record; sessionId: string; definition: WebAutomationRecordedExtraction };

/**
 * Why a frame did not do what it was asked, as a fact about the frame or the
 * request: `not_picking`, no pick is open for that session; `unreadable_request`,
 * the request names no readable field, or the page refused to read it;
 * `not_recording`, nothing is being recorded, so no event could be added;
 * `invalid_definition`, what arrived is not a recorded extraction.
 *
 * A fixed vocabulary, like `ExtractionProposeRefusal`'s: a refusal crosses the
 * same channel a proposal does, so it says why in words chosen here rather than
 * quoting anything the page holds (D3).
 */
export type ExtractionContentRefusal = "not_picking" | "unreadable_request" | "not_recording" | "invalid_definition";

/** What a frame answers an `ExtractionContentMessage` with. `rows` belongs to a preview alone. */
export type ExtractionContentResponse =
  | { ok: true; rows?: ExtractionPreviewRow[] }
  | { ok: false; refused: ExtractionContentRefusal };

/**
 * What the user picked, sent to the background worker.
 *
 * A `list` pick carries the proposal inference made; a `value` pick carries the
 * element it was made on. A pick the page cannot propose an extraction for
 * carries `refused` and neither, so the panel can say why instead of waiting on
 * a pick that already happened.
 */
export type ExtractionPickedMessage = {
  type: typeof EXTRACTION_PICKED_MESSAGE;
  sessionId: string;
  proposal?: WebAutomationExtractionProposal | undefined;
  element?: ExtractionPickedElement | undefined;
  refused?: ExtractionProposeRefusal | undefined;
};

// The confirm payload. It is declared here because both halves of the panel
// conversation build it: `popup/extraction/` writes it, `background/extraction/`
// reads it, and each held its own copy until this one existed. The panel's
// shape is the shape -- it was written and tested first -- with the two
// widenings each marked below, which change nothing the panel sends.
//
// It travels **under `request`** on the confirm message:
// `{ type: EXTRACTION_RUNTIME_MESSAGES.confirm, request }`. The worker also
// accepts the payload's fields flat on the message, which is what an older
// caller sends.

/**
 * One column the user settled on.
 *
 * `key` is derived by the panel with the domain's own
 * `webAutomationExtractionFieldKey`, so a rename that collides with another
 * column is settled the one way the domain settles it (D16), and the worker
 * records the key it is given rather than deriving a second one.
 *
 * The rest is the field's spec, flattened: what to read and from where. The
 * spec is not nested, because the panel edits these one control at a time and a
 * nested spec would make every edit a copy of the whole object.
 */
export type ExtractionConfirmField = {
  /** The record field key (D16), unique within the message. */
  key: string;
  /** The column's name: a header, a test id, or what the user renamed it to. Never text read inside an item. */
  label: string;
  kind: WebAutomationExtractFieldKind;
  /** Where inside an item the value is read; absent, the item itself. */
  selector?: string | undefined;
  attribute?: string | undefined;
  header?: string | undefined;
  /** `false` marks the column optional: an item the page cannot read it from carries `null` for it (D16). */
  required?: boolean | undefined;
  /**
   * `exclude` means the page never reads the column (D12), and the exclusion is
   * recorded so field detection does not propose it again.
   *
   * The domain's whole vocabulary is allowed here, rather than the panel's
   * `include | exclude`, because the worker builds one of these from a
   * *proposal* too, and inference may already have marked a field `encrypt`.
   * What the panel offers is narrower and is enforced where it is offered
   * (`popup/extraction/view-model.ts`): `encrypt` waits for Core's K11 (D13).
   */
  handling: WebAutomationExtractFieldHandling;
};

/**
 * `fluxiq.extractionConfirm`: everything the worker needs to build the recorded
 * definition, and nothing read from the page.
 *
 * No preview row reaches it. The rows the panel displays are a separate value
 * the payload builder is never given, so a recorded definition cannot carry a
 * sample of the page (D3), and an excluded column has no value anywhere in this
 * path to carry (D12).
 */
export type ExtractionConfirmRequest = {
  /** The name the dataset is saved under. Never page text. */
  label: string;
  /** The generalized item selector, exactly as proposed. The worker records the proposal's own copy, which the panel does not offer to edit. */
  item: string;
  /** The columns to record, in the order the panel showed them. A column the user removed is simply absent. */
  fields: readonly ExtractionConfirmField[];
  /** How to read past the first page, or absent to read this page only. */
  paginate?: WebAutomationExtractListPagination | undefined;
  /** How many items the list held when the extraction was defined. */
  itemCount: number;
  /** At most this many records; absent, the domain's own bound applies. The panel sends none, and the Testing Lab's seam does. */
  maxItems?: number | undefined;
};
