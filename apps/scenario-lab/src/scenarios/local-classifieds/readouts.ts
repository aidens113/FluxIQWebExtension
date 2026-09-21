import { listingById, listingByKey, sellerById } from "./catalog/index.js";
import { priceText } from "./format/index.js";
import { PRIOR_CONVERSATION_KEYS } from "./state.js";
import type { ClassifiedsState, SentOffer } from "./types.js";

/**
 * What the page reads back to the person, derived from the session so the
 * page and the oracle can never disagree about it.
 */

/** Conversations under Buying: the two the account already had, and one for each other listing the session wrote to. */
export function buyingCount(state: ClassifiedsState): number {
  const prior = new Set<string>(PRIOR_CONVERSATION_KEYS.map((key) => listingByKey(key).id));
  const contacted = new Set([...state.offers, ...state.messages].map((entry) => entry.listingId).filter((id) => !prior.has(id)));
  return prior.size + contacted.size;
}

export function latestOffer(state: ClassifiedsState, listingId: string): SentOffer | undefined {
  return state.offers.filter((offer) => offer.listingId === listingId).at(-1);
}

/**
 * The receipt under Make offer once an offer went out: who it went to and for
 * how much, or that it was not delivered. A held offer says so only here; the
 * dialog that sent it looked the same as for any other offer.
 */
export function offerReceiptText(offer: SentOffer): string {
  const listing = listingById(offer.listingId);
  const seller = listing ? sellerById(listing.seller).name : "the seller";
  return offer.delivered ? `Offer of ${priceText(offer.amount)} sent to ${seller}` : `Offer of ${priceText(offer.amount)} not delivered`;
}

export function savedTotalText(count: number): string {
  return `${count} saved item${count === 1 ? "" : "s"}`;
}
