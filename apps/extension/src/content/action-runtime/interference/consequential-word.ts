// The deny-list every way out is read against: a verb whose press acts on the
// world in a way looking away does not undo, or a thing a person owns that such
// a verb would act on (`vocabulary.ts` says why it is a word list and not a
// substring scan). Its own module because two readers ask it -- the allow-lists
// in `vocabulary.ts`, over a label, and `press-guard/acting-wording.ts`, over the rest of a
// control (t401).

/**
 * A verb whose press acts on the world in a way looking away does not undo, or
 * a thing a person owns that such a verb would act on. Matched on word
 * boundaries anywhere in the label, so a dismissal phrase cannot smuggle one in
 * behind it.
 *
 * `pay` is absent on purpose and `vocabulary.ts`'s file comment says why; `payment`,
 * `purchase`, `buy` and `checkout` carry the same meaning where it is a press
 * rather than a turn of phrase.
 */
const CONSEQUENTIAL_WORD = /\b(?:delete|deletes|deleting|remove|removes|removing|erase|erases|discard|discards|destroy|destroys|wipe|wipes|deactivate|deactivates|deactivating|unsubscribe|unsubscribes|cancel|cancels|cancelling|canceling|buy|buys|buying|purchase|purchases|purchasing|checkout|check-out|pay(?:ment|ments)|subscribe|subscribes|subscribing|upgrade|upgrades|downgrade|downgrades|withdraw|withdraws|transfer|transfers|donate|donates|publish|publishes|account|accounts|subscription|subscriptions|membership|memberships)\b/iu;

/** Whether the text carries a consequential word anywhere, on word boundaries. */
export function hasConsequentialWord(text: string): boolean {
  return CONSEQUENTIAL_WORD.test(text);
}
