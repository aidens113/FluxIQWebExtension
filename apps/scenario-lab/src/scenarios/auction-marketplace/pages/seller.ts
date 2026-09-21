import { escapeHtml } from "../../../html.js";
import type { RenderContext } from "../../../types.js";
import { bidCount, bidIncrement, currentPrice, LISTINGS, moneyText } from "../catalog/index.js";
import { itemPath } from "../paths.js";
import type { AuctionState, Listing, Seller } from "../types.js";
import { renderShell } from "./shell.js";
import { auctionClasses } from "./styles.js";
import { followButton } from "./watch-controls.js";

/** A seller's shop: who they are and everything they have live, which the listing page opens in a new tab. */
export function renderSeller(state: AuctionState, context: RenderContext, seller: Seller): string {
  const css = auctionClasses(context.seed);
  const live = LISTINGS.filter((listing) => listing.seller === seller.id && !listing.ended);
  const rows = live.map((listing) => `<li><a class="${css.link}" href="${itemPath(listing.id)}">${escapeHtml(listing.title)}</a> · ${moneyText(listing.currency, currentPrice(listing, state.bids))}</li>`).join("");
  const main = `<h1>${escapeHtml(seller.id)}</h1>
<p>${escapeHtml(seller.location)} · ${seller.feedback.toLocaleString("en-GB")} feedback · ${seller.positive} positive · member since ${seller.since}</p>
${followButton(css, seller.id, state, "Save seller")}
<h2>Items for sale (${live.length})</h2><ul>${rows}</ul>`;
  return renderShell({ css, state, context, kind: "other", title: `${seller.id} | Shop`, main });
}

/**
 * An auction's bid history, bidders masked as the site masks them. The
 * person's own bids are listed under their own name.
 */
export function renderBidHistory(state: AuctionState, context: RenderContext, listing: Listing): string {
  const css = auctionClasses(context.seed);
  const masked = ["h***n (212)", "1***k (38)", "r***e (1,044)", "o***9 (7)", "t***a (560)"];
  const own = state.bids.filter((bid) => bid.itemId === listing.id).map((bid) => `<tr><td>sam.okafor (you)</td><td>${moneyText(listing.currency, bid.maxBid)}</td></tr>`);
  const others: string[] = [];
  let amount = listing.price;
  for (let index = 0; index < listing.bids; index += 1) {
    others.push(`<tr><td>${masked[index % masked.length]}</td><td>${moneyText(listing.currency, amount)}</td></tr>`);
    amount = Math.max(0, amount - bidIncrement(amount));
  }
  const main = `<h1>Bid history</h1><p><a class="${css.link}" href="${itemPath(listing.id)}">${escapeHtml(listing.title)}</a></p>
<p>${bidCount(listing, state.bids)} bids · Current bid ${moneyText(listing.currency, currentPrice(listing, state.bids))}</p>
<table class="${css.specs}"><thead><tr><th>Bidder</th><th>Bid amount</th></tr></thead><tbody>${[...own, ...others].join("")}</tbody></table>`;
  return renderShell({ css, state, context, kind: "other", title: "Bid history", main });
}

/** The similar sponsored items a listing page loads when scrolled to. Each opens in a new tab. */
export function similarItemsMarkup(state: AuctionState, context: RenderContext, listing: Listing): string {
  const css = auctionClasses(context.seed);
  const similar = LISTINGS.filter((candidate) => candidate.id !== listing.id && !candidate.ended && candidate.brand === listing.brand).slice(0, 4);
  return `<h2>Similar sponsored items</h2><ul>${similar.map((candidate) => `<li><a class="${css.link}" href="${itemPath(candidate.id)}" target="_blank" rel="noopener">${escapeHtml(candidate.title)}</a> · ${moneyText(candidate.currency, currentPrice(candidate, state.bids))}</li>`).join("")}</ul>`;
}

