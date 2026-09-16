// The picker's worker half: the messages that start a pick, take what a frame
// picked, serve the session to the panel, confirm it, and cancel it.
//
// Shaped like `scripted-navigation-control.ts`: one `handled` / `response`
// answer per message, so `background/index.ts` gains two lines rather than a
// sixth branch of its own.
//
// **Who may say what.** Every message named in `EXTRACTION_RUNTIME_MESSAGES` is
// accepted from the extension's own side panel or popup and from nothing else.
// The one message that is not is the pick itself, which by definition comes
// from a content script -- and that one is checked differently and no less
// strictly: it must come from the top frame of the very tab the session was
// opened against, so no other page, and no child frame of the page under test,
// can fill a session the user opened somewhere else.
//
// `fluxiq.test.defineExtraction` is the sharpest case. It runs an extraction
// and answers with the records, so a page under test that could send it would
// be able to drive FluxIQ's own reader and read the page back out of it. It is
// refused like the rest, and `tests/extraction-control.test.ts` proves the
// refusal rather than assuming it.
//
// Every refusal carries both a `code`, which the Testing Lab and the tests
// branch on, and an `error` sentence, which is what the panel shows the person
// (`popup/extraction/client.ts` raises it).

import {
  EXTRACTION_CONTENT_MESSAGES,
  EXTRACTION_PICK_CANCELLED_MESSAGE,
  EXTRACTION_PICKED_MESSAGE,
  EXTRACTION_RUNTIME_MESSAGES,
  type ExtractionConfirmOutcome,
  type ExtractionContentMessage,
  type ExtractionContentResponse,
  type ExtractionPickCancelledMessage,
  type ExtractionPickedMessage,
  type ExtractionPreviewColumn,
  type ExtractionPreviewRow,
  type ExtractionSessionRefusal
} from "../../shared/extraction-messages";
import type { WebAutomationExtractionProposal, WebAutomationRecordedExtraction } from "@fluxiq-web-extension/domain/client";
import type { FluxIQConnection } from "../connection";
import { isControlPage } from "../control-page";
import { confirmExtraction } from "./confirm";
import { extractionPreviewRequest, recordedListExtraction, type ExtractionConfirmRequest } from "./definition";
import { extractionControlDeps, type ExtractionControlDeps } from "./deps";
import { EXTRACTION_PREVIEW_MAX_ROWS, type ExtractionSession } from "./session-store";

type ControlResult = { readonly handled: false } | { readonly handled: true; readonly response: unknown };

type ControlMessage = { readonly type?: string; readonly [key: string]: unknown };

/** The session as the panel sees it. It carries the proposal and the preview, and never a records array. */
export type ExtractionSessionView = {
  sessionId: string;
  tabId: number;
  state: ExtractionSession["state"];
  form: ExtractionSession["form"];
  proposal?: WebAutomationExtractionProposal | undefined;
  /** Why there is nothing to confirm: the frame proposed nothing for the element, or the pick was for a form this worker cannot land. */
  refused?: ExtractionSessionRefusal | undefined;
  preview: ExtractionPreviewRow[];
};

/** Why a message was refused, and the sentence the panel shows for it. */
const REFUSALS = {
  forbidden: "Only the FluxIQ panel can drive extraction.",
  no_tab: "FluxIQ has no page to extract from. Open the page you want to record first.",
  no_session: "There is no extraction waiting to be confirmed.",
  not_recording: "Start recording before confirming an extraction.",
  invalid_definition: "Those columns do not make an extraction FluxIQ can run.",
  page_refused: "The page did not answer the extraction request.",
  run_failed: "The extraction did not run.",
  top_frame_only: "An extraction can only be picked in the page's main frame.",
  // The one refusal that is about FluxIQ rather than the page or the sender.
  // Its code is the word the session carries, so the panel's sentence and this
  // one come from the same vocabulary (`ExtractionSessionRefusal`).
  value_form_unsupported: "FluxIQ cannot record a single value yet. Pick an item in a repeating list."
} as const;

function refuse(code: keyof typeof REFUSALS, error?: string): { ok: false; code: string; error: string } {
  return { ok: false, code, error: error ?? REFUSALS[code] };
}

export async function handleExtractionControl(
  message: ControlMessage,
  sender: chrome.runtime.MessageSender,
  manager: FluxIQConnection,
  deps: ExtractionControlDeps = extractionControlDeps
): Promise<ControlResult> {
  if (message.type === EXTRACTION_PICKED_MESSAGE) {
    return { handled: true, response: await acceptPick(message, sender, deps) };
  }
  if (message.type === EXTRACTION_PICK_CANCELLED_MESSAGE) {
    return { handled: true, response: acceptPickCancelled(message, sender, deps) };
  }
  const runtime = Object.values(EXTRACTION_RUNTIME_MESSAGES).find((name) => name === message.type);
  if (runtime === undefined) return { handled: false };
  if (!isControlPage(sender)) return { handled: true, response: refuse("forbidden") };
  if (runtime === EXTRACTION_RUNTIME_MESSAGES.start) return { handled: true, response: await startPick(message, manager, deps) };
  if (runtime === EXTRACTION_RUNTIME_MESSAGES.getSession) return { handled: true, response: await readSession(message, deps) };
  if (runtime === EXTRACTION_RUNTIME_MESSAGES.cancel) return { handled: true, response: await cancelPick(message, deps) };
  if (runtime === EXTRACTION_RUNTIME_MESSAGES.confirm) return { handled: true, response: await confirmPick(message, manager, deps) };
  return { handled: true, response: await defineForTest(message, manager, deps) };
}

/**
 * Drops every session against a tab. Both callers leave the page the proposal's
 * selectors were written against: the tab closed, or its top frame navigated.
 */
export function clearExtractionTab(tabId: number, deps: ExtractionControlDeps = extractionControlDeps): void {
  deps.sessions.clearTab(tabId);
}

/**
 * Opens a session on the automation tab and puts the overlay up in its top
 * frame.
 *
 * A `value` pick is refused here rather than opened. Nothing downstream can
 * land one -- `confirm.ts` refuses a `value` definition on the run path, and a
 * recorded value extraction needs the element target the picker's recorded
 * event does not attach -- so a value session could only ever end in a pick
 * that did nothing. Refusing at the door is what makes that visible, and
 * `acceptPick` refuses the pick itself for the same reason.
 */
async function startPick(message: ControlMessage, manager: FluxIQConnection, deps: ExtractionControlDeps): Promise<unknown> {
  const tabId = manager.status().activeTabId;
  if (tabId === undefined) return refuse("no_tab");
  if (message.form === "value") return refuse("value_form_unsupported");
  const form = "list";
  const sessionId = deps.newId();
  deps.sessions.start(sessionId, tabId, form);
  try {
    await deps.ensureContentScript(tabId, 0);
    const pickStart: ExtractionContentMessage = { type: EXTRACTION_CONTENT_MESSAGES.pickStart, sessionId, form };
    const answer = await deps.sendToTab<ExtractionContentResponse | undefined>(tabId, pickStart, 0);
    if (answer?.ok !== true) {
      deps.sessions.clear(sessionId);
      return refuse("page_refused");
    }
  } catch (error) {
    deps.sessions.clear(sessionId);
    return refuse("page_refused", error instanceof Error ? error.message : undefined);
  }
  return { ok: true, sessionId, tabId };
}

/**
 * What a frame picked. The sender's own tab and frame decide whether it is
 * accepted, never anything the message says: the frame id must be the top one,
 * and `ExtractionSessions.picked` refuses a tab that is not the session's.
 *
 * Three things can arrive, and every one of them is answered. A proposal fills
 * the session. A refusal from the frame, and an `element` from a `value` pick
 * this worker cannot land, both leave the session open carrying the word that
 * says why -- and both re-arm the pick, because the frame closed its overlay on
 * the press and the panel is about to tell the user to click again.
 */
async function acceptPick(message: ControlMessage, sender: chrome.runtime.MessageSender, deps: ExtractionControlDeps): Promise<unknown> {
  const tabId = sender.tab?.id;
  if (tabId === undefined || sender.frameId !== 0) return refuse("top_frame_only");
  const picked = message as unknown as ExtractionPickedMessage;
  if (typeof picked.sessionId !== "string") return refuse("no_session");
  if (picked.proposal !== undefined) {
    const filled = deps.sessions.picked(picked.sessionId, tabId, picked.proposal);
    return filled === undefined ? refuse("no_session") : { ok: true, sessionId: picked.sessionId };
  }
  const refusal: ExtractionSessionRefusal | undefined = picked.refused ?? (picked.element !== undefined ? "value_form_unsupported" : undefined);
  if (refusal === undefined) return refuse("no_session");
  const session = deps.sessions.refuse(picked.sessionId, tabId, refusal);
  if (session === undefined) return refuse("no_session");
  await rearmPick(session, deps);
  // The frame's own refusal is a pick this worker took: it was told, and it kept
  // the session. A `value` pick is not, and is answered with the word the
  // session now carries, so the reply a caller reads and the session the panel
  // reads say the same thing rather than one of them saying nothing.
  return refusal === "value_form_unsupported" ? refuse("value_form_unsupported") : { ok: true, sessionId: picked.sessionId };
}

/**
 * The user pressed Escape in the page.
 *
 * Checked exactly as a pick is, and for the same reason: it arrives from a
 * content script, so the sender's own tab and frame decide whether it is taken,
 * never anything the message says. Cancelling a session that is not there, or
 * not this tab's, is not an error -- Escape is allowed to be pressed twice.
 */
function acceptPickCancelled(message: ControlMessage, sender: chrome.runtime.MessageSender, deps: ExtractionControlDeps): unknown {
  const tabId = sender.tab?.id;
  if (tabId === undefined || sender.frameId !== 0) return refuse("top_frame_only");
  const cancelled = message as unknown as ExtractionPickCancelledMessage;
  if (typeof cancelled.sessionId !== "string") return refuse("no_session");
  return { ok: true, cancelled: deps.sessions.cancelled(cancelled.sessionId, tabId) !== undefined };
}

/**
 * Puts the overlay back up after a pick that left nothing to confirm.
 *
 * The frame closes its overlay on **every** pick and forgets its own session
 * when the press finishes (`content/picker/session.ts`), so without this the
 * panel would show "pick another item" over a page that can no longer be picked
 * in, and the only way out would be Cancel. A frame that cannot be reached
 * leaves the session refused, which is what the panel already displays.
 */
async function rearmPick(session: ExtractionSession, deps: ExtractionControlDeps): Promise<void> {
  try {
    const pickStart: ExtractionContentMessage = { type: EXTRACTION_CONTENT_MESSAGES.pickStart, sessionId: session.sessionId, form: session.form };
    await deps.sendToTab(session.tabId, pickStart, 0);
  } catch {
    // The tab may be gone or navigating; the session keeps its refusal either way.
  }
}

/**
 * The session, with the confirmation preview.
 *
 * The first read is for the columns the proposal did not already mark
 * `exclude`. After that the panel sends the columns it may still show
 * (`fields`, keyed by proposal field key), and a set that differs from the one
 * the rows were read under is **re-read rather than filtered** -- so a column
 * the user excludes is not read at all from that moment, instead of being read
 * and hidden (D12). The panel drops the values from its own copy in the same
 * turn, so neither half is left holding them.
 */
async function readSession(message: ControlMessage, deps: ExtractionControlDeps): Promise<unknown> {
  const session = deps.sessions.get(sessionIdOf(message));
  if (session === undefined) return { ok: true };
  if (session.state === "picked" && session.proposal !== undefined) {
    await refreshPreview(session, session.proposal, columnsOf(message), deps);
  }
  const view: ExtractionSessionView = {
    sessionId: session.sessionId,
    tabId: session.tabId,
    state: session.state,
    form: session.form,
    ...(session.proposal !== undefined ? { proposal: session.proposal } : {}),
    ...(session.refused !== undefined ? { refused: session.refused } : {}),
    preview: session.preview
  };
  return { ok: true, session: view };
}

async function refreshPreview(
  session: ExtractionSession,
  proposal: WebAutomationExtractionProposal,
  columns: readonly ExtractionPreviewColumn[] | undefined,
  deps: ExtractionControlDeps
): Promise<void> {
  const preview = extractionPreviewRequest(proposal, columns);
  if (preview === undefined || preview.columnsKey === session.previewKey) return;
  try {
    const read: ExtractionContentMessage = {
      type: EXTRACTION_CONTENT_MESSAGES.preview,
      sessionId: session.sessionId,
      request: preview.request,
      limit: EXTRACTION_PREVIEW_MAX_ROWS
    };
    const answer = await deps.sendToTab<ExtractionContentResponse | undefined>(session.tabId, read, 0);
    if (answer?.ok === true) deps.sessions.setPreview(session.sessionId, preview.columnsKey, answer.rows ?? []);
    else deps.sessions.clearPreview(session.sessionId);
  } catch {
    // A frame that will not read the new columns leaves the worker holding rows
    // read under the old ones, and the commonest reason the columns changed is
    // that the user just excluded one. Keeping those rows would be keeping that
    // column's values, so they go and the panel shows no preview rather than a
    // stale one (D12). The key goes with them, so the next `getSession` asks
    // again instead of treating the failure as the answer.
    deps.sessions.clearPreview(session.sessionId);
  }
}

/** Takes the overlay down and forgets the session. Cancelling nothing is not an error. */
async function cancelPick(message: ControlMessage, deps: ExtractionControlDeps): Promise<unknown> {
  const session = deps.sessions.get(sessionIdOf(message));
  if (session === undefined) return { ok: true, cancelled: false };
  deps.sessions.clear(session.sessionId);
  try {
    const cancel: ExtractionContentMessage = { type: EXTRACTION_CONTENT_MESSAGES.pickCancel, sessionId: session.sessionId };
    await deps.sendToTab(session.tabId, cancel, 0);
  } catch {
    // The tab may already be gone, which is the same outcome as cancelling.
  }
  return { ok: true, cancelled: true };
}

/**
 * The user's Confirm: build the definition from the held proposal and the
 * columns the panel settled on, record it, run it once, and answer with counts
 * only.
 *
 * Outside a recording it is refused rather than run. A definition nothing keeps
 * is a silent no-op to the person who just confirmed it.
 */
async function confirmPick(message: ControlMessage, manager: FluxIQConnection, deps: ExtractionControlDeps): Promise<unknown> {
  if (manager.status().recordingState !== "recording") return refuse("not_recording");
  const session = deps.sessions.get(sessionIdOf(message));
  if (session === undefined || session.state !== "picked" || session.proposal === undefined) return refuse("no_session");
  const confirm = confirmRequestOf(message);
  if (confirm === undefined) return refuse("invalid_definition");
  const definition = recordedListExtraction(session.proposal, confirm, deps.newId().slice(0, 8));
  if (definition === undefined) return refuse("invalid_definition");
  const outcome = await confirmExtraction(definition, session.tabId, { sessionId: session.sessionId, recording: true }, deps);
  if (!outcome.ok) return refuse(outcome.code, outcome.message);
  deps.sessions.markRecorded(session.sessionId);
  // Written as the declared shape rather than a loose literal, because the panel
  // now reads every one of these into a sentence: a field renamed here and read
  // there is the defect `shared/extraction-messages.ts` exists to prevent.
  const captured: ExtractionConfirmOutcome = {
    datasetId: definition.datasetId,
    label: definition.label,
    recordCount: Array.isArray(outcome.records) ? outcome.records.length : 0,
    pagesRead: outcome.pagesRead,
    truncated: outcome.truncated,
    durationMs: outcome.durationMs
  };
  return { ok: true, ...captured };
}

/**
 * X5.3's seam: the same confirm path with the definition supplied instead of
 * picked, answering with the records so the Lab can judge a read it did not
 * write. The records go to the control page in this reply and are stored
 * nowhere.
 */
async function defineForTest(message: ControlMessage, manager: FluxIQConnection, deps: ExtractionControlDeps): Promise<unknown> {
  const status = manager.status();
  if (status.activeTabId === undefined) return refuse("no_tab");
  const definition = message.definition;
  if (definition === null || typeof definition !== "object") return refuse("invalid_definition");
  const outcome = await confirmExtraction(
    definition as WebAutomationRecordedExtraction,
    status.activeTabId,
    {
      sessionId: deps.newId(),
      recording: status.recordingState === "recording",
      ...(typeof message.timeoutMs === "number" ? { timeoutMs: message.timeoutMs } : {})
    },
    deps
  );
  if (!outcome.ok) return refuse(outcome.code, outcome.message);
  return { ok: true, records: outcome.records, pagesRead: outcome.pagesRead, truncated: outcome.truncated, durationMs: outcome.durationMs };
}

function sessionIdOf(message: ControlMessage): string | undefined {
  return typeof message.sessionId === "string" ? message.sessionId : undefined;
}

/**
 * The confirm payload, which the panel nests under `request`
 * (`popup/extraction/client.ts`). A message that carries its own `label`
 * instead is accepted too, so the Lab and a test can confirm without building
 * the envelope.
 */
function confirmRequestOf(message: ControlMessage): ExtractionConfirmRequest | undefined {
  const nested = message.request;
  if (nested !== null && typeof nested === "object") return nested as ExtractionConfirmRequest;
  return typeof message.label === "string" ? message as unknown as ExtractionConfirmRequest : undefined;
}

/**
 * The columns a caller names for the preview, when it names any. A caller that
 * names none gets the proposal's, which is the first read.
 *
 * Only `fields` on the message itself is read, and every key in it is a
 * **proposal** field key (`ExtractionPreviewColumn`). A confirm payload nested
 * under `request` is deliberately not accepted here: its keys are the record
 * keys derived from the user's labels, so a renamed column would match no
 * proposal field, fall back to "as proposed", and put a column the user had
 * just excluded back into the read -- silently, and only for the columns they
 * had renamed.
 */
function columnsOf(message: ControlMessage): readonly ExtractionPreviewColumn[] | undefined {
  return Array.isArray(message.fields) ? message.fields as readonly ExtractionPreviewColumn[] : undefined;
}
