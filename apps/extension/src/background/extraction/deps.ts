// What the extraction control reaches the browser through.
//
// The four are declared rather than imported at each call site so a unit test
// can drive the whole session -- start, pick, preview, confirm, cancel -- with
// no `chrome` at all, and so the origin check can be proved to refuse *before*
// any of them is touched. The defaults are the real ones, and
// `background/index.ts` passes none.
//
// `attachTabForRecording` is `ensureContentScript` here, not the connection's
// own attachment: the extraction runs in the tab the user picked in, which a
// recording has already claimed, so the only thing still needed is that the
// frame is listening.

import { ensureContentScript, sendToTab } from "../tabs";
import { runBrowserActionCommand } from "../../runtime";
import { ExtractionSessions } from "./session-store";

export type ExtractionControlDeps = {
  /** The picker's sessions, which live in memory in this worker and nowhere else. */
  readonly sessions: ExtractionSessions;
  /** Sends a message into one frame of a tab. */
  readonly sendToTab: <TResponse = unknown>(tabId: number, message: unknown, frameId?: number) => Promise<TResponse>;
  /** Makes a tab's top frame ready to answer before anything is sent to it. */
  readonly ensureContentScript: (tabId: number, frameId?: number) => Promise<void>;
  /** Runs one browser action, the way the runtime command router runs a Flow's. */
  readonly runAction: typeof runBrowserActionCommand;
  /** A fresh session id, which is also the nonce a dataset id is made unique by. */
  readonly newId: () => string;
};

/**
 * The one set of sessions the background worker keeps. It is module state
 * because a service worker has no other place to put it: the panel is torn down
 * between messages, and `chrome.storage` is exactly where a preview must not go
 * (D3, D12).
 */
export const extractionControlDeps: ExtractionControlDeps = {
  sessions: new ExtractionSessions(),
  sendToTab,
  ensureContentScript,
  runAction: runBrowserActionCommand,
  newId: () => crypto.randomUUID()
};
