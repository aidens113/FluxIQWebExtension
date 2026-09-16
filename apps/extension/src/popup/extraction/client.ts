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
  ExtractionConfirmOutcome,
  ExtractionConfirmRequest,
  ExtractionConfirmResponse,
  ExtractionPreviewColumn,
  ExtractionSessionResponse,
  ExtractionSessionView
} from "./messages";

const NO_LISTENER = "FluxIQ's background worker did not answer. Reopen the panel and try again.";

/** Begins a pick: the overlay goes up on the active tab and the next click chooses the example item. */
export async function startExtractionPick(): Promise<void> {
  await command({ type: EXTRACTION_RUNTIME_MESSAGES.start });
}

/**
 * Records the confirmed definition and answers what it captured.
 *
 * The request carries selectors, names and counts only, never a previewed value;
 * the reply carries counts and the name the user gave, and no record. It is what
 * lets the panel answer the first question anyone asks after pressing Confirm --
 * did it actually get my rows? -- and `undefined` means the worker recorded the
 * definition without saying, which an older build does.
 */
export async function confirmExtraction(request: ExtractionConfirmRequest): Promise<ExtractionConfirmOutcome | undefined> {
  const response = await runtimeSendMessage<ExtractionConfirmResponse | undefined>({ type: EXTRACTION_RUNTIME_MESSAGES.confirm, request });
  if (!response) throw new Error(NO_LISTENER);
  if (!response.ok) throw new Error(response.error);
  return capturedOutcome(response);
}

/** The reply's counts, or `undefined` when it carried none. Every field is checked, so a half-filled reply is no outcome rather than a sentence with `undefined` in it. */
function capturedOutcome(response: { ok: true } & Partial<ExtractionConfirmOutcome>): ExtractionConfirmOutcome | undefined {
  const { datasetId, label, recordCount, pagesRead, truncated, durationMs } = response;
  if (typeof datasetId !== "string" || typeof label !== "string") return undefined;
  if (typeof recordCount !== "number" || typeof pagesRead !== "number" || typeof durationMs !== "number") return undefined;
  return { datasetId, label, recordCount, pagesRead, truncated: truncated === true, durationMs };
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
 *
 * `columns` is how the preview stays honest after an edit. The worker reads the
 * rows, so only the worker can stop reading a column; naming the columns the
 * panel may still show makes it re-read without them, and the answer carries
 * rows the excluded column is absent from rather than present and hidden (D12).
 * Sending none means "as the proposal named them", which is the first read.
 */
export async function readExtractionSession(columns?: readonly ExtractionPreviewColumn[]): Promise<ExtractionSessionView | undefined> {
  const message = { type: EXTRACTION_RUNTIME_MESSAGES.getSession, ...(columns === undefined ? {} : { fields: columns }) };
  const response = await runtimeSendMessage<ExtractionSessionResponse | undefined>(message);
  if (!response) throw new Error(NO_LISTENER);
  if (!response.ok) throw new Error(response.error);
  return response.session ?? undefined;
}

async function command(message: { type: string }): Promise<void> {
  const response = await runtimeSendMessage<ExtractionCommandResponse | undefined>(message);
  if (!response) throw new Error(NO_LISTENER);
  if (!response.ok) throw new Error(response.error);
}
