// Whether a control's accessible name says it is only a way out of what it sits
// on -- a notice's "Not now", a chat's "Close chat", a close glyph -- so that
// while it is still shown, the press that would have closed it did not land
// (t430, `./landing.ts`).
//
// Narrower than the extension's interference allow-list
// (`apps/extension/src/content/action-runtime/interference/control-word.ts`) on
// purpose. That list admits a control only inside a layer the page put in the
// way, under further guards; this one is read of any pressed control, so it
// keeps only phrases whose press does nothing but close: no "Decline" (a friend
// request), no "Reject" or "OK" (a confirm dialog's answer), no "Hide" or "Not
// interested" (a feed's lasting choices), no "Skip". A label that also carries
// a consequential word -- "Close account" -- is never a way out, whatever it
// begins with; the word list is the extension's deny-list
// (`interference/consequential-word.ts`), read the same way, on word
// boundaries anywhere in the label.

/** Phrases a way out's name begins with, on a word boundary. */
const WAY_OUT_PHRASE = /^(?:close|dismiss|minimi[sz]e|not now|no,? thank(?:s| you)|maybe later|remind me later|got it)\b/iu;

/** A close glyph as the whole name. */
const CLOSE_GLYPH = /^[×✕✖╳xX]$/u;

/** A verb whose press acts on the world, or a thing a person owns that such a verb would act on. */
const CONSEQUENTIAL_WORD = /\b(?:delete|deletes|deleting|remove|removes|removing|erase|erases|discard|discards|destroy|destroys|wipe|wipes|deactivate|deactivates|deactivating|unsubscribe|unsubscribes|cancel|cancels|cancelling|canceling|buy|buys|buying|purchase|purchases|purchasing|checkout|check-out|pay(?:ment|ments)|subscribe|subscribes|subscribing|upgrade|upgrades|downgrade|downgrades|withdraw|withdraws|transfer|transfers|donate|donates|publish|publishes|account|accounts|subscription|subscriptions|membership|memberships)\b/iu;

/** Whether `name`, a pressed control's accessible name as the page reports it, names only a way out. */
export function webAutomationIsWayOutLabel(name: string | undefined): boolean {
  const label = (name ?? "").replace(/\s+/gu, " ").trim();
  if (!label) return false;
  if (CLOSE_GLYPH.test(label)) return true;
  return WAY_OUT_PHRASE.test(label) && !CONSEQUENTIAL_WORD.test(label);
}
