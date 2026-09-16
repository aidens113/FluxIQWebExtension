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

import type { WebAutomationExtractionProposal } from "@fluxiq-web-extension/domain/client";

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
