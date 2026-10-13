// A Next-page press can destroy the content script before its reply arrives.
// The page acknowledges a movement mark before pressing. A replacement
// document receives that mark and checks the landing without pressing again.
// This transport carries no extracted rows or read checkpoints.

import type { BrowserActionCommand, BrowserActionResult } from "../shared/protocol";
import { PAGE_MOVE_MARK_MESSAGE, readPageMoveMark, type PageMoveMark } from "../shared/extraction-continuation";
import { tabIsOpen, waitForTabReady } from "./automation-tab";

type FrameMessaging = {
  send<TResponse>(tabId: number, message: unknown, frameId: number): Promise<TResponse>;
  makeReady(tabId: number, frameId: number): Promise<void>;
};

const TOP_FRAME_ID = 0;
const STALLED_DOCUMENTS_ALLOWED = 3;
const LAST_LANDING_BUDGET_MS = 1;

/** Continue one marked movement in the document it loads, bounded by the original action's deadline. */
export async function sendNextPageAcrossDocuments(
  action: BrowserActionCommand,
  tabId: number,
  message: Record<string, unknown>,
  frameId: number,
  frames: FrameMessaging
): Promise<BrowserActionResult> {
  const token = crypto.randomUUID();
  const startedAt = Date.now();
  const deadline = typeof action.timeoutMs === "number" && Number.isFinite(action.timeoutMs) && action.timeoutMs > 0 ? startedAt + action.timeoutMs : undefined;
  let handed: PageMoveMark | undefined;
  let progressed = false;
  const listener = (received: unknown, sender: chrome.runtime.MessageSender, sendResponse: (response?: unknown) => void): boolean => {
    const body = received as Record<string, unknown> | undefined;
    if (body?.["type"] !== PAGE_MOVE_MARK_MESSAGE || body["token"] !== token) return false;
    if (sender.tab?.id !== tabId || (sender.frameId ?? TOP_FRAME_ID) !== frameId) return false;
    const taken = readPageMoveMark(body["mark"]);
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

function withBudget(action: BrowserActionCommand, deadline: number | undefined): BrowserActionCommand {
  if (deadline === undefined) return action;
  return { ...action, timeoutMs: Math.max(LAST_LANDING_BUDGET_MS, deadline - Date.now()) };
}
