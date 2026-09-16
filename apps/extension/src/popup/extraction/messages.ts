// What the extraction panel sends the background worker, and what it reads back.
//
// The four message *names* are `EXTRACTION_RUNTIME_MESSAGES` in
// `shared/extraction-messages.ts`, which is the one spelling both sides build
// against. The payload shapes below are declared here, in the panel's own
// directory, because the background half (X4.3) is being written beside this
// one: when its payload types land in the shared file, these move there and
// this module re-exports them. Until then the panel is typed against what it
// actually sends, rather than against `unknown`.
//
// Nothing here carries a value read from the page except `ExtractionPreviewRow`,
// which exists only in memory for as long as the confirmation panel is open.
// A preview row never reaches the confirm payload, and an excluded column's
// values never reach a preview row at all (D12).

import type { WebAutomationExtractFieldHandling, WebAutomationExtractFieldKind, WebAutomationExtractionProposal, WebAutomationExtractListPagination } from "@fluxiq-web-extension/domain/client";

/**
 * How far the pick has got, as the background's session store reports it:
 * `picking`, the overlay is up and the user has not clicked; `picked`, a
 * proposal is waiting to be confirmed; `recorded`, the extraction is in the
 * recording and the panel is done.
 */
export type ExtractionSessionState = "picking" | "picked" | "recorded";

/**
 * One preview row, keyed by the proposal's field key. `null` is a field the
 * page had no value for. A key the user excluded is never present: the page is
 * not asked to read it, and the panel drops the key from every row it holds the
 * moment the user excludes it (D12).
 */
export type ExtractionPreviewRow = Record<string, string | null>;

/** The pick session for the active tab, as `fluxiq.getExtractionSession` reports it. */
export type ExtractionSessionView = {
  state: ExtractionSessionState;
  /** What the picker inferred from the element the user clicked. Absent while picking. */
  proposal?: WebAutomationExtractionProposal | undefined;
  /** At most 20 rows read for the confirmation preview, and never persisted. */
  preview?: ExtractionPreviewRow[] | undefined;
  /** Why no proposal was made, in the content script's fixed refusal vocabulary. */
  refused?: string | undefined;
};

/** The column the user settled on, as the confirm message carries it. */
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
  /** `exclude` means the page never reads the column (D12). `encrypt` is not offered until Core K11 is built (D13). */
  handling: Exclude<WebAutomationExtractFieldHandling, "encrypt">;
};

/** `fluxiq.extractionConfirm`: everything the background needs to build the recorded definition, and nothing read from the page. */
export type ExtractionConfirmRequest = {
  /** The name the dataset is saved under. */
  label: string;
  /** The generalized item selector, exactly as proposed. */
  item: string;
  /** The columns to record, in the order the panel showed them. A column the user removed is simply absent. */
  fields: ExtractionConfirmField[];
  /** How to read past the first page, or absent to read this page only. */
  paginate?: WebAutomationExtractListPagination | undefined;
  /** How many items the list held when the extraction was defined. */
  itemCount: number;
};

/** What `start`, `confirm` and `cancel` answer. The panel re-reads the session afterwards rather than trusting a payload here. */
export type ExtractionCommandResponse = { ok: true } | { ok: false; error: string };

/** What `fluxiq.getExtractionSession` answers. `session` is absent when the tab has no pick in flight. */
export type ExtractionSessionResponse =
  | { ok: true; session?: ExtractionSessionView | null | undefined }
  | { ok: false; error: string };
