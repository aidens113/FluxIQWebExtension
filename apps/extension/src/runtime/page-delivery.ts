// Whether an action's command ever reached the page it was sent to, so a send
// the browser refused before delivery can say the act did not happen (t361).
//
// **Why it matters.** Core never presses a committing action again when its
// failure leaves the effect unknown (t359, Core
// `executor/defensive/lasting-act.ts`): the domain states `effect: "ambiguous"`
// on every failed press, click, Enter or dialog answer, unless the client
// stated `effect: "unacted"` (`domain/src/runtime/adapter.ts`). A send the
// browser refused because nothing in the frame was listening -- Chrome's and
// Firefox's "Could not establish connection. Receiving end does not exist.",
// the commonest failure straight after a navigation, when the new document has
// no content script yet -- stated nothing, so it became an uncertain press and
// was never made again, although the press never reached the page.
//
// **Only the action's own sends are counted.** The readiness pings, the
// landing reads and the frame lookups around it are separate messages and say
// nothing about whether the action itself arrived. The action is unacted only
// when every send of it was refused before delivery, or it was never sent at
// all; one send that may have arrived -- answered, refused by the page, or
// closed under it ("The message port closed before a response was received",
// which is the page unloading after it got the message) -- and it may have
// acted, so nothing is stated and Core decides as before.
//
// **What reads as "never delivered".** The browser's own words, matched here
// and nowhere else, for a send that found no receiver: no listener in the
// frame, no such frame, no such tab. Anything else is not read as undelivered:
// a miss costs the old answer (uncertain), never a second press.

/** How a message goes to one frame of a tab: `background/tabs.ts`'s `sendToTab`. */
export type TabMessageSend = <TResponse = unknown>(tabId: number, message: unknown, frameId?: number) => Promise<TResponse>;

/** One action's sends, counted as they go. */
export type ActionDelivery = {
  /** Sends as the wrapped sender does, and notes whether the browser refused the send before it reached the page. */
  readonly send: TabMessageSend;
  /** True once any send of the action may have reached the page. False when every send was refused before delivery, or none was made. */
  mayHaveReachedPage(): boolean;
};

/**
 * The browser's words for a message that never reached a receiver: the frame
 * has no listener, or the frame or tab it was addressed to does not exist.
 * Chrome writes all three; Firefox writes the first the same way.
 */
const NEVER_DELIVERED: readonly RegExp[] = [
  /Receiving end does not exist/iu,
  /No frame with id/iu,
  /No tab with id/iu
];

/** Counts one action's sends through `send`, so a failure can say whether the action ever reached the page. */
export function trackActionDelivery(send: TabMessageSend): ActionDelivery {
  let sends = 0;
  let undelivered = 0;
  return {
    send: async <TResponse = unknown>(tabId: number, message: unknown, frameId?: number): Promise<TResponse> => {
      sends += 1;
      try {
        return await send<TResponse>(tabId, message, frameId);
      } catch (error) {
        if (error instanceof Error && NEVER_DELIVERED.some((words) => words.test(error.message))) undelivered += 1;
        throw error;
      }
    },
    mayHaveReachedPage: () => sends > undelivered
  };
}
