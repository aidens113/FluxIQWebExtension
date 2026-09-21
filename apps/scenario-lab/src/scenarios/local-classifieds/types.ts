/**
 * The marketplace's vocabulary: the renderings the fixture can be armed into,
 * and what one browsing session leaves behind on the server.
 *
 * `baseline` is the site as it ships. Each armed rendering is one thing a real
 * marketplace does between the day a Flow was made and the day it runs:
 *
 * - `moved-save` -- the listing page was redesigned. Save left the action row
 *   for a heart on the photo, labelled "Add to saved items", and lost the
 *   test id the recording used; Hide now stands exactly where Save stood.
 *   Only a repair that re-points the click at the heart passes, and one that
 *   presses Hide hides the listing instead of saving it.
 * - `list-layout` -- an A/B test moved this browser into the list layout:
 *   results are rows, and the link wraps only the title rather than the whole
 *   card, so a read anchored on the card's link finds no price and no place.
 *   The listings, their order and every value are identical.
 * - `location-check` -- the site opens with "Are you still in Kelford?" in
 *   front of everything, once the cookie choice is made. Until it is answered
 *   nothing behind it can be pressed.
 */
export const classifiedsModes = ["baseline", "moved-save", "list-layout", "location-check"] as const;

export type ClassifiedsMode = (typeof classifiedsModes)[number];

/** An offer the buyer sent. `delivered` is false when the sender filled the honeypot the page hides from people. */
export type SentOffer = { listingId: string; amount: number; note: string; delivered: boolean };

/** A plain message to a seller, held the same way as an offer. */
export type SentMessage = { listingId: string; text: string; delivered: boolean };

/**
 * One browsing session, as the server sees it.
 *
 * - `saved` is listing ids in the order they were saved, oldest first; the two
 *   the account already had come first.
 * - `contactLog` and `feedLog` are wall-clock milliseconds, capped. They exist
 *   for the rate limit on contacting sellers and the "checking your browser"
 *   pause on the results feed, the two places the site reacts to speed.
 * - `refusedContacts` counts messages and offers the rate limit turned away.
 * - `failedBatches` names the result batches that have already failed once, so
 *   each fails exactly once per session and loads on the retry.
 */
export type ClassifiedsState = {
  mode: ClassifiedsMode;
  consent: "pending" | "all" | "essential";
  notificationPrompt: "pending" | "dismissed" | "enabled";
  locationCheck: "pending" | "answered";
  chat: "unopened" | "open" | "minimised" | "closed";
  saved: string[];
  hidden: string[];
  offers: SentOffer[];
  messages: SentMessage[];
  contactLog: number[];
  refusedContacts: number;
  feedLog: number[];
  failedBatches: string[];
  views: string[];
  activity: string[];
};
