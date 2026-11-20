// The content script's half of the act mark (t968, `shared/act-mark-message.ts`
// says why): the token the worker sent beside a press's command, sent back once,
// just before the action first acts on the page (`../acted-at/`).
//
// It is sent and not awaited. The act is a synchronous dispatch made right after
// it, and a document cannot unload in the middle of one, so the message has left
// before anything the act does can take the page away; the worker reads it only
// once it has judged where its tab landed, long after. A worker that does not
// take it -- the content harness, a test page -- changes nothing: the act goes on.

import { ACT_MARK_MESSAGE, type ActMarkMessage } from "../../../shared/act-mark-message";

/** How a mark leaves the page: `chrome.runtime.sendMessage` by default; tests pass their own. */
export type ActMarkPost = (message: ActMarkMessage) => Promise<unknown> | void;

/**
 * The action's first-act hook for `token`, or `undefined` when the command
 * carried no token (a read, a command sent by something other than the worker).
 */
export function actMarkSender(token: unknown, post: ActMarkPost = sendToWorker): (() => void) | undefined {
  if (typeof token !== "string" || token === "") return undefined;
  return () => {
    try {
      const sent = post({ type: ACT_MARK_MESSAGE, token });
      if (sent && typeof (sent as Promise<unknown>).catch === "function") (sent as Promise<unknown>).catch(/* best-effort: a page no worker listens to still acts */ () => undefined);
    } catch {
      /* best-effort: no receiver, or no extension API in this frame, and the act goes on without a mark */
    }
  };
}

function sendToWorker(message: ActMarkMessage): Promise<unknown> | void {
  return chrome.runtime.sendMessage(message);
}
