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
// dialog.
//
// **It reports a count and nothing else.** What the dialog said stays on the
// page: the account this feeds (`recovery/account.ts`) carries counts and words
// from closed sets so that it can travel on any result without redaction.

import { challengeIn } from "../challenge-evidence";
import { dispatchClickGesture } from "../click-gesture";
import { overlaysOverPage } from "./overlays";
import { dismissControlIn } from "./way-out";

/**
 * At most this many overlays are dismissed in one intervention.
 *
 * More than one because a page that opens a consent sheet also opens a
 * newsletter modal, and clearing one to be stopped by the next is not clearing
 * anything. Bounded because a page that keeps producing dialogs is a page this
 * defence cannot win on, and the loop's own ladder is the place that gives up.
 */
const MAX_DISMISSALS_PER_ATTEMPT = 3;

/**
 * Presses the way out of whatever is standing over the page, and answers how
 * many layers were dismissed.
 *
 * Zero is an ordinary answer: the obstacle may be a consent banner offering
 * only a choice about the person's data, which this does not make for them, or
 * a challenge, which is theirs. The caller waits and retries either way -- an
 * overlay that clears itself is common enough to be worth the retry, and the
 * refusal the page finally reports is the page's own.
 *
 * It never throws. This runs inside the defence that exists so a step does not
 * die on something recoverable, and a defence that can itself end the step is
 * not one.
 */
export function clearInterference(): number {
  try {
    return pressWaysOut();
  } catch {
    return 0;
  }
}

function pressWaysOut(): number {
  let dismissed = 0;
  for (const overlay of overlaysOverPage()) {
    if (dismissed >= MAX_DISMISSALS_PER_ATTEMPT) break;
    // Guard 1. A dialog that asks for what only a person can give is left
    // alone, way out or no way out.
    if (challengeIn(overlay, "dialog")) continue;
    const control = dismissControlIn(overlay);
    if (!control) continue;
    if (press(control)) dismissed += 1;
  }
  return dismissed;
}

/** Presses the control at the centre of its own box, as a person would. False when it has no box to aim at. */
function press(control: Element): boolean {
  const box = control.getBoundingClientRect();
  if (!(box.width > 0) || !(box.height > 0)) return false;
  dispatchClickGesture(control, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
  return true;
}
