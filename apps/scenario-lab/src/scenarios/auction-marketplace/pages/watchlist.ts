import { escapeHtml } from "../../../html.js";
import type { RenderContext } from "../../../types.js";
import { approxText, bidCount, currentPrice, endLabelText, moneyText, timeLeftText } from "../catalog/index.js";
import { watchlistClientScript } from "../client/index.js";
import { itemPath, MARKET_ROOT } from "../paths.js";
import type { AuctionState } from "../types.js";
import { bidsText } from "./card.js";
import { watchedListings } from "./flyouts.js";
import { renderShell } from "./shell.js";
import { auctionClasses } from "./styles.js";

/**
 * The person's watchlist, ending soonest first, with each listing's price, its
 * bids and time left, and its item number. Remove is a div.
 */
export function renderWatchlist(state: AuctionState, context: RenderContext): string {
  const css = auctionClasses(context.seed);
  const listings = watchedListings(state);
  const rows = listings.map((listing) => {
    const price = currentPrice(listing, state.bids);
    const auction = listing.format === "auction" || listing.format === "auction-bin";
    const timing = auction ? `${timeLeftText(listing.endsIn ?? 0)} ${endLabelText(listing.endsIn ?? 0)}` : "Good 'Til Cancelled";
    return `<li class="${css.watchRow}" data-itemid="${listing.id}">
<img class="${css.cardImage}" src="${MARKET_ROOT}img/${listing.id}/1.svg" alt="" loading="lazy" width="96" height="96">
<div class="${css.watchInfo}">
<a class="${css.watchTitle}" href="${itemPath(listing.id)}">${escapeHtml(listing.title)}</a>
<div><span class="${css.watchPrice}">${moneyText(listing.currency, price)}</span> <span class="${css.watchMeta}">${approxText(listing.currency, price)}</span></div>
<div class="${css.watchMeta}"><span>${auction ? bidsText(bidCount(listing, state.bids)) : "Buy it now"}</span> · <span>${escapeHtml(timing)}</span></div>
<div class="${css.watchMeta}">Item number: ${listing.id}</div>
</div>
<div class="${css.divButton}">Remove</div>
</li>`;
  }).join("\n");
  const main = `<p class="${css.crumbs}">My Hammerline › Watchlist</p>
<h1>Watchlist</h1>
<p>${listings.length} ${listings.length === 1 ? "item" : "items"} · Sort: Ending soonest</p>
<ol class="${css.watchlist}" aria-label="Watchlist items">${rows}</ol>
${listings.length === 0 ? "<p>You are not watching anything yet.</p>" : ""}`;
  return renderShell({ css, state, context, kind: "watchlist", title: "Watchlist", main, pageScript: watchlistClientScript() });
}
