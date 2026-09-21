// The worker's half of a paginated `web.dom.extract_list` read that outlives
// the document it began in (`shared/extraction-continuation.ts` says why).
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
// What makes re-sending safe is what the page promises: it never follows a
// control before its checkpoint was taken. A reply lost before the first
// checkpoint therefore lost nothing but reading -- nothing was pressed -- and
// the command goes out again from the start; one lost after it goes on from
// the pages that checkpoint holds. Either way no control is followed twice.
//
// How long this may go on. A document that goes away without the read having
// checkpointed since it arrived -- a check page that reloads itself, a
// redirect -- is allowed `STALLED_DOCUMENTS_ALLOWED` in a row; a checkpoint
// resets the count, because it is progress. The command's own `timeoutMs`
// bounds the whole read: the re-sent command carries only what is left of it,
// and once none is, the page is asked for one last read with a 1 ms budget,
// which answers `timed_out` with every record the checkpoint holds instead of
// the records being dropped. Only the top frame is continued -- a child frame's
// id is reassigned when it navigates, and no extraction is defined in one --
// and a closed tab ends the read with the refusal it met.
//
// The checkpoint listener takes only a message carrying this command's token
// from this tab's addressed frame, and is removed when the command ends. The
// records it holds live in this call alone.

import type { BrowserActionCommand, BrowserActionResult } from "../shared/protocol";
import { EXTRACTION_CHECKPOINT_MESSAGE, readExtractionCheckpoint, type ExtractionCheckpoint, type ExtractionContinuation } from "../shared/extraction-continuation";
import { tabIsOpen, waitForTabReady } from "./automation-tab";

/** How the worker reaches a frame: the runner's own `sendToTab` and `ensureContentScript`, handed in. */
export type FrameMessaging = {
  send<TResponse>(tabId: number, message: unknown, frameId: number): Promise<TResponse>;
  makeReady(tabId: number, frameId: number): Promise<void>;
};

/** The id the browser always gives a tab's main frame. */
const TOP_FRAME_ID = 0;

/** Documents in a row that may go away before the read checkpoints in them. */
const STALLED_DOCUMENTS_ALLOWED = 3;

/** The budget of the last read asked for once the command's time has run out. */
const LAST_READ_BUDGET_MS = 1;

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
  const token = crypto.randomUUID();
  const startedAt = Date.now();
  const deadline = typeof action.timeoutMs === "number" && Number.isFinite(action.timeoutMs) && action.timeoutMs > 0 ? startedAt + action.timeoutMs : undefined;
  let checkpoint: ExtractionCheckpoint | undefined;
  let checkpointed = false;
  const listener = (received: unknown, sender: chrome.runtime.MessageSender, sendResponse: (response?: unknown) => void): boolean => {
    const body = received as { type?: unknown; token?: unknown; checkpoint?: unknown } | undefined;
    if (body?.type !== EXTRACTION_CHECKPOINT_MESSAGE || body.token !== token) return false;
    if (sender.tab?.id !== tabId || (sender.frameId ?? TOP_FRAME_ID) !== frameId) return false;
    const taken = readExtractionCheckpoint(body.checkpoint);
    if (taken !== undefined) {
      checkpoint = taken;
      checkpointed = true;
    }
    sendResponse({ ok: taken !== undefined });
    return false;
  };
  chrome.runtime.onMessage.addListener(listener);
  try {
    for (let stalled = 0; ; ) {
      checkpointed = false;
      const continuation: ExtractionContinuation = { token, ...(checkpoint !== undefined ? { resume: checkpoint } : {}) };
      try {
        const result = await frames.send<BrowserActionResult>(tabId, { ...message, action: withBudget(action, deadline), extraction: continuation }, frameId);
        if (checkpoint !== undefined && typeof result.startedAt === "number") result.startedAt = Math.min(result.startedAt, startedAt);
        return result;
      } catch (error) {
        stalled = checkpointed ? 0 : stalled + 1;
        if (frameId !== TOP_FRAME_ID || stalled > STALLED_DOCUMENTS_ALLOWED || !await tabIsOpen(tabId)) throw error;
        await waitForTabReady(tabId);
        await frames.makeReady(tabId, frameId);
      }
    }
  } finally {
    chrome.runtime.onMessage.removeListener(listener);
  }
}

/** The action with the time the read has left as its `timeoutMs`, or unchanged when nothing bounds it. */
function withBudget(action: BrowserActionCommand, deadline: number | undefined): BrowserActionCommand {
  if (deadline === undefined) return action;
  return { ...action, timeoutMs: Math.max(LAST_READ_BUDGET_MS, deadline - Date.now()) };
}
