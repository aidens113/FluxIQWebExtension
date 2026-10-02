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
// "go away" -- close, dismiss, minimise, not now, no thanks, maybe later, skip
// -- or is a close glyph on its own. Minimising hides a widget and acts on
// nothing; until 2026-10-01 it was missing, and a support chat whose only way
// out is "Minimize chat" -- crossborder's pill over Add to cart, the everything
// store's chat over its buy box -- refused every press under it (lane A,
// `t174-w32`, `t174-w34`). No destructive verb can reach the match: "Delete",
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
// **Accepting cookies is never a way out; declining optional ones is, on a
// consent layer and nowhere else.** Until 2026-09-30 neither answer was, on the
// reasoning that either is a choice about the person's data. Live, that left a
// replayed Flow dead at its first step on a store whose consent dialog opens on
// every fresh session (lane t195, run `run-munoa86g-150fb0d9`: "Your privacy
// choices", four absorbed attempts, then `web.action.blocked_by_dialog`). The
// two answers are not symmetric. Declining optional cookies consents to
// nothing -- it is the state a site must assume while nobody has answered -- so
// pressing it gives nothing away on the person's behalf, and under the
// product's permission rule only moving money, deleting and sending or
// publishing are the person's to decide. Accepting shares their data, so a
// label that accepts, allows all or agrees is never pressed. The decline list
// (`isConsentDeclineLabel`) is separate from the dismissal list and is read
// only on a layer whose own text is about cookies or consent
// (`isConsentLayerText`), because "Decline" on any other dialog -- an
// invitation, a meeting -- is an answer somebody receives. A banner that also
// carries a close glyph is still closed by the glyph first.
//
// **A notice that the page refused a press for going too fast is closed by its
// acknowledgement, and its "Try again" is never pressed.** social-network-feed
// answers a fourth Confirm inside its window with "You're going too fast ... You
// can try again in 12 seconds" and a lone OK, which closes it and confirms
// nothing. OK on any other dialog may be the confirmation of whatever the dialog
// asked, so the acknowledgement list (`isRateLimitAcknowledgeLabel`) is separate
// from the dismissal list and is read only on a layer whose own text is a
// rate-limit notice (`isRateLimitLayerText`), exactly as the consent decline is.
// "Try again" is on no list: pressing it does the refused act on the page's
// initiative, and the node's own re-run, after the wait the notice named, is
// what does the act (`../rate-limit-notice.ts`).

/**
 * Longer text than this is prose that happens to start with a dismissal word,
 * not a control's label.
 */
export const DISMISS_LABEL_MAX = 48;

/**
 * A control's own label that closes or declines what it sits on, anchored at
 * the start and followed by nothing or by a separator.
 */
const DISMISS_LABEL = /^(?:close|dismiss|minimi[sz]e|hide|not now|no,? thanks?|no thank you|maybe later|remind me later|later|skip|not interested|continue without)(?:$|[\s,.!:;-])/iu;

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

/**
 * A consent control that declines optional cookies, anchored at the start:
 * reject, decline, refuse, "necessary/essential only", "only allow essential",
 * "continue without accepting". Nothing beginning with accept, allow all,
 * agree, save or manage can match.
 */
const CONSENT_DECLINE_LABEL = /^(?:(?:reject|decline|refuse|deny)(?: all| optional| non-essential| additional)?|(?:use |allow )?(?:only )?(?:strictly )?(?:necessary|essential|required)(?: cookies)? only|only (?:allow |use )?(?:strictly )?(?:necessary|essential|required)|continue without accepting)(?:$|[\s,.!:;-])/iu;

/** A word that accepts or shares, refused anywhere in a decline label: "Reject all or accept" is not a decline. */
const CONSENT_ACCEPT_WORD = /\b(?:accept|accepts|agree|agrees|consent to)\b|\ballow all\b/iu;

/** The words a consent layer's own text carries. A layer without one is not about cookies. */
const CONSENT_LAYER_WORD = /\b(?:cookie|cookies|consent|privacy|tracking|trackers)\b/iu;

/**
 * Whether this label declines optional cookies. The dismissal list's guards
 * apply too -- the length bound, and the deny-list over the whole label -- so
 * "Reject and delete my account" is refused.
 */
export function isConsentDeclineLabel(label: string): boolean {
  if (label.length === 0 || label.length > DISMISS_LABEL_MAX) return false;
  if (!CONSENT_DECLINE_LABEL.test(label)) return false;
  if (CONSENT_ACCEPT_WORD.test(label.replace(/^continue without accepting/iu, ""))) return false;
  return !CONSEQUENTIAL_WORD.test(label);
}

/** Whether a layer's own bounded text says it is a cookie or consent prompt. */
export function isConsentLayerText(text: string): boolean {
  return CONSENT_LAYER_WORD.test(text);
}

/**
 * The phrases a rate-limit notice states its refusal in. A closed list, each on
 * word boundaries: going too fast or too quickly, too many attempts, slow down,
 * temporarily blocked, rate limited, and a wait of seconds or minutes before
 * trying again. "Try again" alone is not one -- a failed payment says it too --
 * so the wait has to be named with it.
 */
const RATE_LIMIT_LAYER_PHRASE = /\b(?:(?:going|moving|posting|clicking|doing (?:this|that)) too (?:fast|quickly)|too many (?:requests|attempts|tries|actions)|slow down|temporarily (?:blocked|restricted|limited)|rate[- ]limit(?:ed)?|try again in \d+ ?(?:s|secs?|seconds?|mins?|minutes?)|wait \d+ ?(?:s|secs?|seconds?|mins?|minutes?) before)\b/iu;

/**
 * The phrases a page writes beside a press it could not carry out for now
 * because it, or the service behind it, was busy: "Network busy, please try
 * again", "Server busy", "Service temporarily unavailable". A closed list, each
 * on word boundaries. Neither "Try again" nor "Something went wrong" is on it:
 * a failed payment says both, and a press is only repeated on the page's word
 * when that word says the press never went through. "Temporarily unavailable"
 * alone is not on it either: a store says it of an item out of stock.
 */
const TRANSIENT_REFUSAL_PHRASE = /\b(?:(?:network|server|system|service) (?:is )?(?:busy|overloaded|(?:temporarily )?unavailable)|too busy|busy,? (?:please )?try again)\b/iu;

/** Whether text a press brought says the page was busy and did not carry the press out (`../rate-limit-notice.ts`). */
export function isTransientRefusalText(text: string): boolean {
  return TRANSIENT_REFUSAL_PHRASE.test(text);
}

/**
 * The phrases a page writes beside a press it will not carry out until it is
 * given something first: "Please select a Color.", "Please enter a quantity.",
 * "This field is required.", "You have reached the purchase limit for this
 * item." A closed list, each on word boundaries, and each a refusal rather than
 * information: no stock, price or availability words, which a press that worked
 * may bring as well ("Only 30 pieces available.", "sold out"). "Required" alone
 * is not on it -- it is a field's label -- and neither is "are required", which
 * is the legend a form carries whether or not anything was refused.
 */
const PAGE_REQUIREMENT_PHRASE = /\b(?:please (?:select|choose|pick|enter|fill in|fill out|provide|specify)|is required|purchase limit)\b/iu;

/** Whether a line a press brought says the page needs something first and did not carry the press out (`../rate-limit-notice.ts`). */
export function isPageRequirementText(text: string): boolean {
  return PAGE_REQUIREMENT_PHRASE.test(text);
}

/**
 * The acknowledgement a rate-limit notice offers, as the whole label: OK, Okay,
 * Got it, Understood, I understand. Anchored at both ends, so "OK, delete it" or
 * "OK to charge my card" cannot match; "Close" and a close glyph are already
 * dismissals everywhere.
 */
const RATE_LIMIT_ACKNOWLEDGE_LABEL = /^(?:ok|okay|got it|understood|i understand)[.!]?$/iu;

/** Whether a layer's own bounded text says the page refused an act for going too fast. */
export function isRateLimitLayerText(text: string): boolean {
  return RATE_LIMIT_LAYER_PHRASE.test(text);
}

/**
 * Whether this label acknowledges a rate-limit notice. Read only on a layer
 * `isRateLimitLayerText` accepts; the deny-list applies too, though nothing the
 * anchored list admits can carry a consequential word.
 */
export function isRateLimitAcknowledgeLabel(label: string): boolean {
  if (label.length === 0 || label.length > DISMISS_LABEL_MAX) return false;
  if (!RATE_LIMIT_ACKNOWLEDGE_LABEL.test(label)) return false;
  return !CONSEQUENTIAL_WORD.test(label);
}
