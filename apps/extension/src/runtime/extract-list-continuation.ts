// The worker's half of a paginated `web.dom.extract_list` read that outlives
// the document it began in (`shared/extraction-continuation.ts` says why), and
// of a `web.dom.next_page` step whose press loads a new document.
//
// The command goes out as any other does, with a token beside it. Before the
// page follows each pagination control it sends a checkpoint under that token
// and waits for it to be taken here. When the command's reply is then lost --
// the control loaded a new document, and the script that was reading died with
// the old one -- the tab is given time to settle on its new document, the
// content script is made ready there, and the same command goes out again
// carrying the last checkpoint and the time the read has left. The new
// document goes on from it, so the reply that finally comes back holds every
// record from every document, in order, as one read.
//
// A next-page step goes the same way with a mark in place of a checkpoint: the
// page marks its press just before it makes it, and again before it reloads a
// landing the server refused. A reply lost after a mark is a press that was
// made, so the new document is handed the mark and asked whether the list
// arrived; it presses nothing. No rows are carried.
//
// What makes re-sending safe is what the page promises: it never follows a
// control before its checkpoint, or mark, was taken. A reply lost before the
// first one therefore lost nothing but reading -- nothing was pressed -- and
// the command goes out again from the start; one lost after it goes on from
// what that one holds. Either way no control is followed twice.
//
// How long this may go on. A document that goes away without the page having
// checkpointed since it arrived -- a check page that reloads itself, a
// redirect -- is allowed `STALLED_DOCUMENTS_ALLOWED` in a row; a checkpoint
// resets the count, because it is progress. The command's own `timeoutMs`
// bounds the whole command: the re-sent command carries only what is left of
// it, and once none is, the page is asked for one last answer with a 1 ms
// budget -- a read answers `timed_out` with every record the checkpoint holds
// instead of the records being dropped. Only the top frame is continued -- a
// child frame's id is reassigned when it navigates, and no extraction is
// defined in one -- and a closed tab ends the command with the refusal it met.
//
// The listener takes only a message carrying this command's token from this
// tab's addressed frame, and is removed when the command ends. What it holds
// lives in this call alone.

import type { BrowserActionCommand, BrowserActionResult } from "../shared/protocol";
import { EXTRACTION_CHECKPOINT_MESSAGE, PAGE_MOVE_MARK_MESSAGE, readExtractionCheckpoint, readPageMoveMark } from "../shared/extraction-continuation";
import { tabIsOpen, waitForTabReady } from "./automation-tab";

/** How the worker reaches a frame: the runner's own `sendToTab` and `ensureContentScript`, handed in. */
export type FrameMessaging = {
  send<TResponse>(tabId: number, message: unknown, frameId: number): Promise<TResponse>;
  makeReady(tabId: number, frameId: number): Promise<void>;
};

/** The id the browser always gives a tab's main frame. */
const TOP_FRAME_ID = 0;

/** Documents in a row that may go away before the page checkpoints in them. */
const STALLED_DOCUMENTS_ALLOWED = 3;

/** The budget of the last answer asked for once the command's time has run out. */
const LAST_READ_BUDGET_MS = 1;

/** What a page hands the worker before it presses: the message type, the member that carries it, and its reader. */
type Handover<T> = { type: string; member: string; read(value: unknown): T | undefined };

const READ_CHECKPOINTS = { type: EXTRACTION_CHECKPOINT_MESSAGE, member: "checkpoint", read: readExtractionCheckpoint } satisfies Handover<unknown>;
const MOVE_MARKS = { type: PAGE_MOVE_MARK_MESSAGE, member: "mark", read: readPageMoveMark } satisfies Handover<unknown>;

/**
 * Sends a paginated list read to `frameId` of `tabId` and carries it into every
 * document its pagination loads; see the header. `message` is the
 * `executeAction` message the runner built, which this sends with a
 * continuation beside the action.
 */
export async function sendExtractListAcrossDocuments(
  action: BrowserActionCommand,
  tabId: number,
  message: Record<string, unknown>,
  frameId: number,
  frames: FrameMessaging
): Promise<BrowserActionResult> {
  return await sendAcrossDocuments(action, tabId, message, frameId, frames, READ_CHECKPOINTS);
}

/**
 * Sends a `web.dom.next_page` step to `frameId` of `tabId` and, when its press
 * loads a new document, asks that document whether the list arrived; see the
 * header.
 */
export async function sendNextPageAcrossDocuments(
  action: BrowserActionCommand,
  tabId: number,
  message: Record<string, unknown>,
  frameId: number,
  frames: FrameMessaging
): Promise<BrowserActionResult> {
  return await sendAcrossDocuments(action, tabId, message, frameId, frames, MOVE_MARKS);
}

async function sendAcrossDocuments<T>(
  action: BrowserActionCommand,
  tabId: number,
  message: Record<string, unknown>,
  frameId: number,
  frames: FrameMessaging,
  handover: Handover<T>
): Promise<BrowserActionResult> {
  const token = crypto.randomUUID();
  const startedAt = Date.now();
  const deadline = typeof action.timeoutMs === "number" && Number.isFinite(action.timeoutMs) && action.timeoutMs > 0 ? startedAt + action.timeoutMs : undefined;
  let handed: T | undefined;
  let progressed = false;
  const listener = (received: unknown, sender: chrome.runtime.MessageSender, sendResponse: (response?: unknown) => void): boolean => {
    const body = received as Record<string, unknown> | undefined;
    if (body?.["type"] !== handover.type || body["token"] !== token) return false;
    if (sender.tab?.id !== tabId || (sender.frameId ?? TOP_FRAME_ID) !== frameId) return false;
    const taken = handover.read(body[handover.member]);
    if (taken !== undefined) {
      handed = taken;
      progressed = true;
    }
    sendResponse({ ok: taken !== undefined });
    return false;
  };
  chrome.runtime.onMessage.addListener(listener);
  try {
    for (let stalled = 0; ; ) {
      progressed = false;
      const continuation = { token, ...(handed !== undefined ? { resume: handed } : {}) };
      try {
        const result = await frames.send<BrowserActionResult>(tabId, { ...message, action: withBudget(action, deadline), extraction: continuation }, frameId);
        if (handed !== undefined && typeof result.startedAt === "number") result.startedAt = Math.min(result.startedAt, startedAt);
        return result;
      } catch (error) {
        stalled = progressed ? 0 : stalled + 1;
        if (frameId !== TOP_FRAME_ID || stalled > STALLED_DOCUMENTS_ALLOWED || !await tabIsOpen(tabId)) throw error;
        await waitForTabReady(tabId);
        await frames.makeReady(tabId, frameId);
      }
    }
  } finally {
    chrome.runtime.onMessage.removeListener(listener);
  }
}

/** The action with the time the command has left as its `timeoutMs`, or unchanged when nothing bounds it. */
function withBudget(action: BrowserActionCommand, deadline: number | undefined): BrowserActionCommand {
  if (deadline === undefined) return action;
  return { ...action, timeoutMs: Math.max(LAST_READ_BUDGET_MS, deadline - Date.now()) };
}
