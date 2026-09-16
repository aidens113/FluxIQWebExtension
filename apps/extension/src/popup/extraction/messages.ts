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
import type { ExtractionPreviewRow } from "../../shared/extraction-messages";

export type { ExtractionConfirmField, ExtractionConfirmRequest, ExtractionPreviewRow } from "../../shared/extraction-messages";

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
  /** At most 20 rows read for the confirmation preview, and never persisted. */
  preview?: ExtractionPreviewRow[] | undefined;
  /** Why no proposal was made, in the content script's fixed refusal vocabulary. */
  refused?: string | undefined;
};

/** What `start`, `confirm` and `cancel` answer. The panel re-reads the session afterwards rather than trusting a payload here. */
export type ExtractionCommandResponse = { ok: true } | { ok: false; error: string };

/** What `fluxiq.getExtractionSession` answers. `session` is absent when the tab has no pick in flight. */
export type ExtractionSessionResponse =
  | { ok: true; session?: ExtractionSessionView | null | undefined }
  | { ok: false; error: string };
