// What the extraction panel sends the background worker, and what it reads back.
//
// The four message *names* are `EXTRACTION_RUNTIME_MESSAGES` in
// `shared/extraction-messages.ts`, which is the one spelling both sides build
// against -- and so, now, is the confirm payload: the panel writes it and the
// background worker reads it, each held a copy of the shape while the two
// halves were being written in parallel, and the copies are gone. This module
// re-exports the shared declarations so the panel's own imports stay local, and
// declares only what the panel alone reads: how a session looks to it, and what
// its four calls answer.
//
// Nothing here carries a value read from the page except `ExtractionPreviewRow`,
// which exists only in memory for as long as the confirmation panel is open.
// A preview row never reaches the confirm payload, and an excluded column's
// values never reach a preview row at all (D12).

import type { WebAutomationExtractionProposal } from "@fluxiq-web-extension/domain/client";
import type { ExtractionConfirmOutcome, ExtractionPreviewRow, ExtractionSessionRefusal } from "../../shared/extraction-messages";

export type {
  ExtractionConfirmField,
  ExtractionConfirmOutcome,
  ExtractionConfirmRequest,
  ExtractionPreviewColumn,
  ExtractionPreviewRow,
  ExtractionSessionRefusal
} from "../../shared/extraction-messages";

/**
 * How far the pick has got, as the background's session store reports it:
 * `picking`, the overlay is up and the user has not clicked; `picked`, a
 * proposal is waiting to be confirmed; `recorded`, the extraction is in the
 * recording and the panel is done.
 */
export type ExtractionSessionState = "picking" | "picked" | "recorded";

/** The pick session for the active tab, as `fluxiq.getExtractionSession` reports it. */
export type ExtractionSessionView = {
  state: ExtractionSessionState;
  /** What the picker inferred from the element the user clicked. Absent while picking. */
  proposal?: WebAutomationExtractionProposal | undefined;
  /**
   * At most 20 rows read for the confirmation preview, and never persisted.
   *
   * They are read under the columns the panel last named on `getSession`, so
   * excluding a column and re-reading is what removes its values from here --
   * not a filter applied to rows that still hold them.
   */
  preview?: ExtractionPreviewRow[] | undefined;
  /**
   * Why there is nothing to confirm, in the one refusal vocabulary both halves
   * share. It is typed rather than `string` so the panel's sentence for each
   * word is a compile-time obligation: a word the background can send and the
   * panel has no sentence for is a build error, not a blank notice.
   */
  refused?: ExtractionSessionRefusal | undefined;
};

/** What `start` and `cancel` answer. The panel re-reads the session afterwards rather than trusting a payload here. */
export type ExtractionCommandResponse = { ok: true } | { ok: false; error: string };

/**
 * What `confirm` answers: the refusal, or what was captured.
 *
 * The counts arrive flat on the reply rather than nested, which is how the
 * worker sends them. They are optional here because an older worker sends a
 * bare `{ ok: true }`, and the panel says "recorded" rather than inventing a
 * number when they are missing.
 */
export type ExtractionConfirmResponse =
  | ({ ok: true } & Partial<ExtractionConfirmOutcome>)
  | { ok: false; error: string };

/** What `fluxiq.getExtractionSession` answers. `session` is absent when the tab has no pick in flight. */
export type ExtractionSessionResponse =
  | { ok: true; session?: ExtractionSessionView | null | undefined }
  | { ok: false; error: string };
