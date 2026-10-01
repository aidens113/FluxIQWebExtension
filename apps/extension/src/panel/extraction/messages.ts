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

import type { ExtractionConfirmOutcome, ExtractionSessionIdentity, ExtractionSessionView } from "../../shared/extraction-messages";

export type {
  ExtractionConfirmField,
  ExtractionConfirmOutcome,
  ExtractionConfirmRequest,
  ExtractionPreviewColumn,
  ExtractionPreviewRow,
  ExtractionSessionRefusal,
  ExtractionSessionIdentity,
  ExtractionSessionView
} from "../../shared/extraction-messages";

/** Preserve the panel's public state alias over the synchronized shared view. */
export type ExtractionSessionState = ExtractionSessionView["state"];

/** A start acknowledges its real identity; older workers and cancel may acknowledge without one. */
export type ExtractionCommandResponse = ({ ok: true } & Partial<ExtractionSessionIdentity>) | { ok: false; error: string };

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
