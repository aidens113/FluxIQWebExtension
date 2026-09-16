// The four messages the extraction panel sends the background worker.
//
// The names are `EXTRACTION_RUNTIME_MESSAGES` (`shared/extraction-messages.ts`),
// which is the one spelling both halves build against; nothing here re-declares
// a name. `testDefineExtraction` is deliberately absent: it exists for the
// Testing Lab's control page, and the panel has a human to pick with.
//
// Every call answers `{ ok: true }` or throws. A panel that has to branch on a
// refusal at each of four call sites gets the branch wrong somewhere, so the
// refusal is raised once and caught once, where the panel shows it.
//
// A response can also be `undefined`: `chrome.runtime.sendMessage` resolves with
// nothing when no listener answered, which is what a torn-down service worker
// looks like from here. That is turned into a plain sentence rather than being
// read through, because reading `.ok` off it is the `TypeError` that would
// otherwise reach the user as "cannot read properties of undefined".

import { runtimeSendMessage } from "../../shared/browser";
import { EXTRACTION_RUNTIME_MESSAGES } from "../../shared/extraction-messages";
import type {
  ExtractionCommandResponse,
  ExtractionConfirmRequest,
  ExtractionSessionResponse,
  ExtractionSessionView
} from "./messages";

const NO_LISTENER = "FluxIQ's background worker did not answer. Reopen the panel and try again.";

/** Begins a pick: the overlay goes up on the active tab and the next click chooses the example item. */
export async function startExtractionPick(): Promise<void> {
  await command({ type: EXTRACTION_RUNTIME_MESSAGES.start });
}

/** Records the confirmed definition. The request carries selectors, names and counts only, never a previewed value. */
export async function confirmExtraction(request: ExtractionConfirmRequest): Promise<void> {
  await command({ type: EXTRACTION_RUNTIME_MESSAGES.confirm, request });
}

/** Abandons the pick: the overlay comes down and the session, with whatever preview it held, is dropped. */
export async function cancelExtraction(): Promise<void> {
  await command({ type: EXTRACTION_RUNTIME_MESSAGES.cancel });
}

/**
 * The pick session for the active tab, or `undefined` when there is none.
 *
 * This is what makes the Firefox popup work at all: clicking the page closes the
 * popup, so the panel is rebuilt from the background's session rather than from
 * anything it remembered.
 */
export async function readExtractionSession(): Promise<ExtractionSessionView | undefined> {
  const response = await runtimeSendMessage<ExtractionSessionResponse | undefined>({ type: EXTRACTION_RUNTIME_MESSAGES.getSession });
  if (!response) throw new Error(NO_LISTENER);
  if (!response.ok) throw new Error(response.error);
  return response.session ?? undefined;
}

async function command(message: { type: string; request?: ExtractionConfirmRequest }): Promise<void> {
  const response = await runtimeSendMessage<ExtractionCommandResponse | undefined>(message);
  if (!response) throw new Error(NO_LISTENER);
  if (!response.ok) throw new Error(response.error);
}
