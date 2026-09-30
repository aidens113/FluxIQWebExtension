// Whether a press the page was watched after is pressed once more.
//
// The rule is one-sided on purpose. Pressing a control twice when the first
// press did something is the worst thing a click can do -- two items in the
// cart, two orders, two messages sent -- so any sign at all that the first
// press was answered forbids a second one, and a request above all: a request
// is the press reaching the server, whatever the page shows. Only a press after
// which nothing whatever was seen is pressed again, and only once per command.
//
// Why a press can be ignored at all: bigbox-retail's `vr.wake()` swallows the
// first add-to-cart press after every page load and does nothing -- no
// request, no change to the page -- and a build that reloaded the product page
// and pressed once did so more than thirty times (`run-munvz5x0-84fa6177`,
// `run-munwmfrs-b81bbc65`). A person presses again when a button does nothing;
// so does the click verb, once.

/** A sign that a press was answered. Any one of them forbids a second press. */
export type PressSignal =
  /** A fetch, XMLHttpRequest or beacon the page began after the press. */
  | "request"
  /** Something changed inside the pressed control or the section around it. */
  | "change"
  /** The address moved, or the document began to leave. */
  | "navigation"
  /** Focus moved to something other than the pressed control. */
  | "focus";

/** The most extra presses one command makes. */
export const MAX_EXTRA_PRESSES = 1;

/**
 * Whether to press again: only when the first press was seen to do nothing at
 * all, and no extra press has been made for this command yet.
 */
export function pressAgain(seen: readonly PressSignal[], extraPressesMade: number): boolean {
  if (seen.length > 0) return false;
  return extraPressesMade < MAX_EXTRA_PRESSES;
}
