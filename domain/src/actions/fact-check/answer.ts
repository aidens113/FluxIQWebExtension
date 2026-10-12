// What a fact check answers: per claim, `true`, `false` or `unknown`, with the
// evidence it rests on and when it was read (plan B1, Core C9).
//
// `false` is a positive observation in a fully read document; anything that
// could not be observed -- a frame that did not answer, a capture that threw, a
// document still being parsed, a document other than the one asked about, a
// subject the claim could not be put to -- is `unknown`, never `false`.
//
// The evidence is closed and bounded. It names the element (a short
// fingerprint of its identity, never its value) and quotes at most
// `WEB_AUTOMATION_FACT_EXCERPT_MAX` characters of what was read, and nothing at
// all from a sensitive control: such a claim is answered `unknown` with the
// reason `sensitive`. The domain screens every string again before Core sees it.

import type { WebAutomationLayerKind } from "../../page-evidence";

export type WebAutomationFactVerdict = "true" | "false" | "unknown";

/**
 * Why a claim is `unknown`, in closed words:
 * `unreadable_frame` -- the frame never answered; `capture_failed` -- reading
 * the page threw; `stale_document` -- the page holds another document than the
 * one asked about; `loading` -- the document is still being parsed, so an
 * absence proves nothing; `ambiguous` -- the target matched several elements
 * equally; `sensitive` -- the subject is a secret-holding control;
 * `no_state` -- the element shows no such state; `unclassified_dialog` -- an
 * open dialog no classifier could name may be the one asked about;
 * `unbound` -- the Flow input or bound value it compares with was not
 * supplied; `unsupported` -- the claim could not be put to the page.
 */
export type WebAutomationFactUnknownReason =
  | "unreadable_frame"
  | "capture_failed"
  | "stale_document"
  | "loading"
  | "ambiguous"
  | "sensitive"
  | "no_state"
  | "unclassified_dialog"
  | "unbound"
  | "unsupported";

/** Who the element is, as far as a reader needs to recognise it again. Never its value. */
export type WebAutomationFactElement = {
  tagName: string;
  role?: string | undefined;
  id?: string | undefined;
  testId?: string | undefined;
  name?: string | undefined;
  accessibleName?: string | undefined;
  selector?: string | undefined;
};

export type WebAutomationFactEvidence = {
  element?: WebAutomationFactElement | undefined;
  /** At most `WEB_AUTOMATION_FACT_EXCERPT_MAX` characters of what was read. */
  excerpt?: string | undefined;
  /** `count`: how many matched; `dialog`: how many open dialogs met the claim. */
  count?: number | undefined;
  dialogKind?: WebAutomationLayerKind | undefined;
  reason?: WebAutomationFactUnknownReason | undefined;
};

export type WebAutomationFactAnswer = {
  result: WebAutomationFactVerdict;
  evidence?: WebAutomationFactEvidence | undefined;
  /** When the page was read, in epoch milliseconds. */
  capturedAt: number;
};

/** The document the claims were judged in. */
export type WebAutomationFactDocument = {
  url?: string | undefined;
  timeOrigin?: number | undefined;
  readyState?: "loading" | "interactive" | "complete" | undefined;
};

/** The whole batch's answer, one entry per query and in the same order. */
export type WebAutomationFactCheckResult = {
  answers: WebAutomationFactAnswer[];
  document?: WebAutomationFactDocument | undefined;
};

/** The longest excerpt an answer may quote. */
export const WEB_AUTOMATION_FACT_EXCERPT_MAX = 120;
