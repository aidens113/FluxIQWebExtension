// The page's word to the worker that an action is about to act on it (t968).
//
// A press whose page unloads before the content script answers loses its reply,
// and the worker judged such a press by where its tab then landed
// (`runtime/click-landing.ts`). Delivery alone was taken for the press: a click
// still looking for its target on a page that navigated by itself -- a robot
// check that lets the visitor on after five seconds, a timed redirect -- read as
// a click that navigated (`run-mwohvt8n-a57cad8a`, auction-marketplace's
// "Checking your browser"). So the worker sends a token beside a press's command
// (`executeAction`'s `actMark`), and the content script sends it back, once,
// just before the action first acts on the page (`content/action-runtime/act-mark/`).
// A lost reply with no mark is an act that was never made.

/** The message a content script sends, once per action, just before it first acts on the page. */
export const ACT_MARK_MESSAGE = "fluxiq.act.mark";

/** The mark itself: the token the worker sent beside the command. Nothing read off a page is in it. */
export type ActMarkMessage = { type: typeof ACT_MARK_MESSAGE; token: string };
