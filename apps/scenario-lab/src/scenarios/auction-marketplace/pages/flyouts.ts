import { escapeHtml } from "../../../html.js";
import { currentPrice, LISTINGS, listingById, moneyText } from "../catalog/index.js";
import { itemPath } from "../paths.js";
import type { AuctionState, Listing } from "../types.js";
import type { AuctionClasses } from "./styles.js";

/**
 * The account's own lists, as the header's flyouts show them on every page:
 * what the person is watching, the bids they have placed, what they have
 * bought and the sellers they have saved. These are the fixture's oracle. They
 * are rendered from the session on every page load and replaced from the
 * server after every change the page makes, so they are never stale -- unlike
 * the watch count beside the Watchlist link, which a real header only fills in
 * when the page loads.
 *
 * Each list's text is its items' text run together, which is what
 * `textContent` reads, and the manifest's final-state facts compare it
 * exactly: a list with one item too many, one missing, or one priced wrongly
 * is a different string.
 */
export function watchedListings(state: AuctionState): Listing[] {
  const rank = (listing: Listing) => LISTINGS.indexOf(listing);
  return state.watched.map((id) => listingById(id)).filter((listing): listing is Listing => listing !== undefined)
    .sort((left, right) => (left.endsIn ?? Number.MAX_SAFE_INTEGER) - (right.endsIn ?? Number.MAX_SAFE_INTEGER) || rank(left) - rank(right));
}

function watchEntry(listing: Listing, state: AuctionState): string {
  return `${listing.title} · ${moneyText(listing.currency, currentPrice(listing, state.bids))}`;
}

function bidEntry(state: AuctionState, itemId: string): string {
  const listing = listingById(itemId)!;
  const mine = state.bids.filter((candidate) => candidate.itemId === itemId);
  const bid = mine[mine.length - 1]!;
  const standing = bid.winning ? "Highest bidder" : "Outbid";
  return `${listing.title} · Your max bid ${moneyText(listing.currency, bid.maxBid)} · ${standing} at ${moneyText(listing.currency, bid.current)}`;
}

function bidItems(state: AuctionState): string[] {
  return [...new Set(state.bids.map((bid) => bid.itemId))];
}

/** The four lists' text, as the final-state facts spell it. */
export function flyoutTexts(state: AuctionState): { watch: string; bids: string; purchases: string; followed: string } {
  return {
    watch: watchedListings(state).map((listing) => watchEntry(listing, state)).join(""),
    bids: bidItems(state).map((itemId) => bidEntry(state, itemId)).join(""),
    purchases: state.purchases.map((id) => listingById(id)!).map((listing) => `${listing.title} · ${moneyText(listing.currency, listing.price)}`).join(""),
    followed: state.followed.join(""),
  };
}

/** The four lists' markup, keyed as the flyouts and the header fragment place them. */
export function flyoutListsMarkup(css: AuctionClasses, state: AuctionState): { watch: string; bids: string; purchases: string; followed: string } {
  const linked = (listing: Listing, rest: string) => `<li><a class="${css.topLink}" href="${itemPath(listing.id)}">${escapeHtml(listing.title)}</a>${escapeHtml(rest)}</li>`;
  const watch = watchedListings(state).map((listing) => linked(listing, ` · ${moneyText(listing.currency, currentPrice(listing, state.bids))}`)).join("");
  const bids = bidItems(state).map((itemId) => {
    const listing = listingById(itemId)!;
    return linked(listing, bidEntry(state, itemId).slice(listing.title.length));
  }).join("");
  const purchases = state.purchases.map((id) => listingById(id)!).map((listing) => linked(listing, ` · ${moneyText(listing.currency, listing.price)}`)).join("");
  const followed = state.followed.map((seller) => `<li>${escapeHtml(seller)}</li>`).join("");
  return {
    watch: `<ul class="${css.flyoutList}" data-testid="watch-flyout">${watch}</ul>`,
    bids: `<ul class="${css.flyoutList}" data-testid="bids-flyout">${bids}</ul>`,
    purchases: `<ul class="${css.flyoutList}" data-testid="purchases-flyout">${purchases}</ul>`,
    followed: `<ul class="${css.flyoutList}" data-testid="followed-sellers">${followed}</ul>`,
  };
}
