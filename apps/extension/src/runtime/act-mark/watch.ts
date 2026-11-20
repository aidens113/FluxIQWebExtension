// The worker's half of the act mark (t968, `shared/act-mark-message.ts`): a
// token sent beside a press's command, and whether the page the command reached
// sent it back before it first acted.
//
// `../click-landing.ts` asks only when the press's reply was lost to its page
// unloading: a delivered command whose page then went is a press made only if
// the page marked it. The page sends the mark before it acts and the worker asks
// after it has judged the landing, so a mark that was sent has long arrived; the
// short wait in `settle` is for a message still in flight on another channel than
// the closed reply, never a wait for the page to act.

import { ACT_MARK_MESSAGE } from "../../shared/act-mark-message";

/** How long a lost reply waits for a mark not yet received. */
const MARK_IN_FLIGHT_MS = 150;

export type ActMarkWatch = {
  /** The token the command carries as `actMark`. */
  readonly token: string;
  /** Whether the page marked an act, waiting at most a mark's time in flight. */
  settle(waitMs?: number): Promise<boolean>;
  /** Stops listening; safe to call more than once. */
  stop(): void;
};

/** The listener surface the watch uses: `chrome.runtime.onMessage` by default; tests pass their own. */
export type ActMarkEvents = {
  addListener(listener: (message: unknown, sender: chrome.runtime.MessageSender) => boolean | void): void;
  removeListener(listener: (message: unknown, sender: chrome.runtime.MessageSender) => boolean | void): void;
};

/**
 * Starts listening for the mark of one command sent to `frameId` of `tabId`.
 * Undefined where there is no message channel to listen on, and the press is
 * then judged as it was before marks (`click-landing.ts`).
 */
export function watchActMark(tabId: number, frameId: number, events: ActMarkEvents | undefined = runtimeMessages(), token: string = crypto.randomUUID()): ActMarkWatch | undefined {
  if (events === undefined) return undefined;
  let acted = false;
  let wake: (() => void) | undefined;
  const listener = (message: unknown, sender: chrome.runtime.MessageSender): boolean => {
    const body = typeof message === "object" && message !== null ? message as Record<string, unknown> : undefined;
    if (body?.["type"] !== ACT_MARK_MESSAGE || body["token"] !== token) return false;
    if (sender.tab?.id !== tabId || (sender.frameId ?? 0) !== frameId) return false;
    acted = true;
    wake?.();
    return false;
  };
  events.addListener(listener);
  let stopped = false;
  return {
    token,
    settle(waitMs = MARK_IN_FLIGHT_MS) {
      if (acted || stopped || waitMs <= 0) return Promise.resolve(acted);
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          wake = undefined;
          resolve(acted);
        }, waitMs);
        wake = () => {
          clearTimeout(timer);
          wake = undefined;
          resolve(true);
        };
      });
    },
    stop() {
      if (stopped) return;
      stopped = true;
      events.removeListener(listener);
    }
  };
}

/** The worker's own message event, where the runtime has one. */
function runtimeMessages(): ActMarkEvents | undefined {
  const runtime = (globalThis as { chrome?: { runtime?: { onMessage?: ActMarkEvents } } }).chrome?.runtime;
  return runtime?.onMessage && typeof runtime.onMessage.addListener === "function" ? runtime.onMessage : undefined;
}
