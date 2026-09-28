// Which words on a control mean "this closes what it sits on", and which mean
// "pressing this does something to the world".
//
// A runtime that presses a control on the page's own initiative -- not because
// a Flow authored the step, but because something stood in the way -- has to be
// able to say, in advance, that the press cannot delete, buy or pay. That is
// what this file is: a closed allow-list of dismissal phrases, and a closed
// deny-list applied to whatever the label says after one.
//
// **The allow-list is anchored, which is the first and strongest guard.** A
// label qualifies only when it *begins* with one of a dozen phrases that mean
// "go away" -- close, dismiss, not now, no thanks, maybe later, skip -- or is a
// close glyph on its own. No destructive verb can reach the match: "Delete",
// "Buy now", "Place your order", "Confirm purchase" and "Pay" do not begin with
// any of them, so they are refused before anything else is asked.
//
// **The deny-list catches the overlap the allow-list cannot.** A dismissal
// phrase can be the start of a consequential sentence: "Close account", "Skip
// and delete my draft", "Not now, cancel my subscription". So what follows the
// matched phrase is read for a destructive verb or for one of the things a
// person owns, and any hit refuses the label outright.
//
// **The deny-list is a word list, not a substring scan, and that matters.** The
// spin-to-win promotion on the everything-store fixture declines with "No
// thanks, I would rather pay full price" -- a dismissal whose tail contains the
// letters of a payment. Scanning for substrings would refuse the one control on
// that dialog that closes it and leave the runtime with no way out of the very
// obstacle this work exists for. So `pay` is not a denied verb; `purchase`,
// `buy`, `checkout` and `payment` are, and each is matched on word boundaries.
//
// **Accepting or rejecting cookies is deliberately not a dismissal.** It is a
// choice about the person's data, and the product does not make it on their
// behalf. A consent banner whose only controls are Accept and Reject therefore
// has no way out here, and an action refused under one stays refused -- which
// is the behaviour `blocking-dialog.ts` has drawn since it was written. A
// banner that *also* carries a close glyph is closed by that glyph, because
// closing is not answering.

/**
 * Longer text than this is prose that happens to start with a dismissal word,
 * not a control's label.
 */
export const DISMISS_LABEL_MAX = 48;

/**
 * A control's own label that closes or declines what it sits on, anchored at
 * the start and followed by nothing or by a separator.
 */
const DISMISS_LABEL = /^(?:close|dismiss|hide|not now|no,? thanks?|no thank you|maybe later|remind me later|later|skip|not interested|continue without)(?:$|[\s,.!:;-])/iu;

/** A close glyph used as a whole label. */
const CLOSE_GLYPH = /^[×✕✖╳xX]$/u;

/**
 * A verb whose press acts on the world in a way looking away does not undo, or
 * a thing a person owns that such a verb would act on. Matched on word
 * boundaries anywhere in the label, so a dismissal phrase cannot smuggle one in
 * behind it.
 *
 * `pay` is absent on purpose and the file comment says why; `payment`,
 * `purchase`, `buy` and `checkout` carry the same meaning where it is a press
 * rather than a turn of phrase.
 */
const CONSEQUENTIAL_WORD = /\b(?:delete|deletes|deleting|remove|removes|removing|erase|erases|discard|discards|destroy|destroys|wipe|wipes|deactivate|deactivates|deactivating|unsubscribe|unsubscribes|cancel|cancels|cancelling|canceling|buy|buys|buying|purchase|purchases|purchasing|checkout|check-out|pay(?:ment|ments)|subscribe|subscribes|subscribing|upgrade|upgrades|downgrade|downgrades|withdraw|withdraws|transfer|transfers|donate|donates|publish|publishes|account|accounts|subscription|subscriptions|membership|memberships)\b/iu;

/**
 * Whether this label may be pressed to clear what it sits on.
 *
 * Both guards, in one answer, so no caller can apply the allow-list and forget
 * the deny-list. The label is expected already trimmed and collapsed to single
 * spaces; it is measured before either pattern runs, because a paragraph is not
 * a control's label however it begins.
 */
export function isDismissalLabel(label: string): boolean {
  if (label.length === 0 || label.length > DISMISS_LABEL_MAX) return false;
  if (CLOSE_GLYPH.test(label)) return true;
  if (!DISMISS_LABEL.test(label)) return false;
  return !CONSEQUENTIAL_WORD.test(label);
}
