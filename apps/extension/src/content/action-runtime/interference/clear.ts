// Clearing what stands over the page, so the action that was blocked can be
// run again.
//
// **Why this exists.** An interstitial dialog -- a cookie banner, a promo
// popup, a deal wheel, a newsletter modal, a consent sheet -- is the single
// most common obstacle on a real web page, and until now meeting one ended the
// step: the page reported `web.action.blocked_by_dialog`, the effect was never
// applied, and getting past it was left to the model, which costs a paid
// round trip and only happens if a model remembers. The standing rule is that
// the runtime carries the defence, for every node, with no opt-in. So a refusal
// that a layer over the page caused is answered here, in the page, by pressing
// that layer's own way out and running the verb again.
//
// **Four guards keep a dismissal from becoming an act.** They are independent,
// and each alone would stop the obvious failure; together they are what lets a
// runtime press a control nobody authored.
//
//  1. **A challenge is never touched.** Every candidate overlay is read for a
//     robot check, a credential or code prompt, or a payment confirmation
//     (`challenge-evidence.ts`), and one that holds any of them is left exactly
//     as it is -- including its "Cancel". Those dialogs are the person's, which
//     is the line `blocking-dialog.ts` draws and the one thing this must never
//     get wrong.
//  2. **The label must be a dismissal, by a closed anchored allow-list.**
//     Nothing that reads "Delete", "Buy now", "Place your order", "Pay" or
//     "Confirm purchase" can match, because the match is anchored at the start
//     of the label and none of those phrases begins one (`vocabulary.ts`).
//  3. **What follows a dismissal phrase is read for a consequential word.** So
//     "Close account" and "Skip and delete my draft" are refused although they
//     begin with a dismissal.
//  4. **The press is confined to the overlay's own subtree**, and the overlay is
//     a layer the page is painting over itself. A mis-press therefore lands
//     inside a promotion, never on the page's own Delete.
//
// A fifth, narrower guard sits in `way-out.ts`: a "Not now" that is a link to
// somewhere else is not pressed, because leaving the page is worse than the
// dialog. A sixth sits beside it (t401, `press-guard/`): a control whose
// press acts -- it submits, toggles, retries, confirms, accepts or goes on -- is
// never pressed, whatever the label that admitted it says.
//
// **A layer the step works in is never cleared** (t401, `clearing-target.ts`):
// the step's resolved target, its selector and the names it was recorded by
// each mark the layer that holds it as the step's own.
//
// **It reports a count here, and words from closed sets beside it.** What the
// dialog said stays on the page: the account this feeds (`recovery/account.ts`)
// carries counts, and the result's record of each press
// (`press-ways-out.ts`) carries the layer's kind and the dismissal's
// allow-list word, so either can travel on any result without redaction.

import type { ClearingTarget } from "./clearing-target";
import { pressWaysOut } from "./press-ways-out";

/**
 * Presses the way out of whatever is standing over the page, and answers how
 * many layers were dismissed.
 *
 * Zero is an ordinary answer: the obstacle may be a consent banner that offers
 * no way to decline optional cookies -- accepting is never pressed -- or a
 * challenge, which is the person's. The caller waits and retries either way -- an
 * overlay that clears itself is common enough to be worth the retry, and the
 * refusal the page finally reports is the page's own.
 *
 * It never throws. This runs inside the defence that exists so a step does not
 * die on something recoverable, and a defence that can itself end the step is
 * not one.
 *
 * `spare` is the action's own target -- the element it resolved to, or what the
 * step says of it (`clearing-target.ts`): a layer that holds it -- the form
 * drawer or the consent wall the step is working in, the prompt whose "Not now"
 * it presses -- is never cleared, only the layers in its way (`overlays.ts`).
 */
export function clearInterference(spare?: Element | ClearingTarget): number {
  return pressWaysOut(spare).length;
}
