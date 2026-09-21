import { buildClassNames } from "../../../build-classes.js";
import { escapeHtml } from "../../../html.js";
import type { RenderContext } from "../../../types.js";
import {
  approxText, bidCount, currentPrice, endLabelText, moneyText, postageApproxText, postageText, sellerById, timeLeftText,
} from "../catalog/index.js";
import { MARKET_ROOT, itemPath } from "../paths.js";
import type { AuctionState, Listing } from "../types.js";
import { rotatingId } from "./shell.js";
import type { AuctionClasses } from "./styles.js";

/** A listing counts as new for a day after it went up. */
const NEW_LISTING_MINUTES = 1_440;

export function bidsText(count: number): string {
  return count === 1 ? "1 bid" : `${count} bids`;
}

/**
 * The eight values a card fills in after it hydrates, in slot order: price and
 * its pound estimate; bids (or Buy it now) and the second format line; time
 * left and the end time; postage and its pound estimate. An empty string is a
 * slot the listing leaves empty.
 */
export function cardSlots(listing: Listing, state: AuctionState): string[] {
  const { currency } = listing;
  const price = currentPrice(listing, state.bids);
  const auction = listing.format === "auction" || listing.format === "auction-bin";
  const priceText = listing.priceTo === undefined ? moneyText(currency, price) : `${moneyText(currency, price)} to ${moneyText(currency, listing.priceTo)}`;
  const second = listing.format === "auction-bin" && listing.binPrice !== undefined ? `or Buy it now ${moneyText(currency, listing.binPrice)}`
    : listing.format === "fixed-offer" ? "or Best Offer" : "";
  return [
    priceText,
    approxText(currency, price),
    auction ? bidsText(bidCount(listing, state.bids)) : "Buy it now",
    second,
    auction ? timeLeftText(listing.endsIn ?? 0) : "",
    auction ? endLabelText(listing.endsIn ?? 0) : "",
    postageText(currency, listing.postage),
    postageApproxText(currency, listing.postage),
  ];
}

function country(listing: Listing): string {
  const location = sellerById(listing.seller).location;
  const last = location.slice(location.lastIndexOf(",") + 1).trim();
  return last === "United Kingdom" ? "" : `from ${last}`;
}

function skeletons(css: AuctionClasses): string {
  return `<span class="${css.skeleton}"></span><span class="${css.skeleton}"></span>`;
}

function titleHeading(css: AuctionClasses, listing: Listing): string {
  const fresh = listing.listedAgo < NEW_LISTING_MINUTES ? `<span class="${css.cardBadge}">New listing</span>` : "";
  return `<div role="heading" aria-level="3">${fresh}<span>${escapeHtml(listing.title)}</span></div>`;
}

function heart(css: AuctionClasses, listing: Listing, state: AuctionState): string {
  return `<hl-watch class="${css.heart}" data-item="${listing.id}" data-watched="${state.watched.includes(listing.id)}"></hl-watch>`;
}

/** Where a card links: the listing with tracking appended, or, for an advertisement, the ad server's click redirect. */
export function cardHref(listing: Listing, sponsored: boolean, position: number): string {
  if (sponsored) return `${MARKET_ROOT}sspa/click?mkevt=1&mkcid=1&id=${listing.id}&pos=${position}`;
  return itemPath(listing.id, `hash=item${Number(listing.id).toString(16)}&_trksid=p4429486.m570.l1313`);
}

/**
 * "Sponsored", the way ad labels are written to defeat ad blockers and
 * scrapers alike: every visible letter is its own span and between them sit
 * letters that are never displayed, so the text a script reads is noise while
 * the text a person sees says Sponsored. The noise changes with the seed.
 */
function sponsoredLabel(css: AuctionClasses, context: RenderContext, position: number): string {
  const noise = buildClassNames(`ad:${context.seed}:${position}`, ["n"]).n ?? "css-xxxxxxx";
  const letters = [..."Sponsored"].map((letter, index) => `<span>${letter}</span><span class="${css.adGhost}">${noise.charAt(4 + (index % 7)).toUpperCase()}</span>`).join("");
  return `<div class="${css.cardLine}"><span class="${css.adLabel}">${letters}</span></div>`;
}

/**
 * A results card in the list layout. Its structure is fixed -- every card
 * has the same eight lines in the same order, empty or not -- because that is
 * what the component renders, and it is the only thing a selector on this
 * page can rely on: the classes are hashes that change with the build, the
 * ids change on every page served, and the price, bids, time and postage
 * arrive as grey skeletons that the page fills in shortly after it loads.
 */
export function listCardMarkup(css: AuctionClasses, listing: Listing, state: AuctionState, context: RenderContext, sponsored: boolean, position: number): string {
  const href = cardHref(listing, sponsored, position);
  const identity = sponsored ? `data-adid="${listing.id}"` : `data-listingid="${listing.id}"`;
  const watchers = listing.watchers > 0 ? `${listing.watchers} watchers` : "";
  return `<li class="${css.card}" id="${rotatingId(context, state, `card-${position}`)}" ${identity}>
<div class="${css.cardMedia}"><a href="${href}" tabindex="-1"><img class="${css.cardImage}" src="${MARKET_ROOT}img/${listing.id}/1.svg" alt="" loading="lazy" width="180" height="180"></a>${heart(css, listing, state)}</div>
<div class="${css.cardInfo}">
<a class="${css.cardTitle}" href="${href}">${titleHeading(css, listing)}</a>
<div class="${css.cardSubtitle}">${escapeHtml(listing.subtitle)}</div>
<div class="${css.cardLine}"><span>${listing.condition}</span> · <span>${escapeHtml(listing.brand)}</span></div>
<div class="${css.cardLine}">${skeletons(css)}</div>
<div class="${css.cardLine}">${skeletons(css)}</div>
<div class="${css.cardLine}">${skeletons(css)}</div>
<div class="${css.cardLine}">${skeletons(css)}</div>
<div class="${css.cardLine}"><span>${country(listing)}</span><span>${watchers}</span></div>
${sponsored ? sponsoredLabel(css, context, position) : ""}
</div>
</li>`;
}

/**
 * The same card in the gallery layout an A/B test puts some visitors on. The
 * text is identical and the structure is not: the lines are written in
 * reverse and a column-reverse flexbox puts them back the right way up, so
 * what reads first on screen is last in the document.
 */
export function gridCardMarkup(css: AuctionClasses, listing: Listing, state: AuctionState, context: RenderContext, sponsored: boolean, position: number): string {
  const href = cardHref(listing, sponsored, position);
  const identity = sponsored ? `data-adid="${listing.id}"` : `data-listingid="${listing.id}"`;
  return `<li class="${css.gridCard}" id="${rotatingId(context, state, `tile-${position}`)}" ${identity}>
<a href="${href}" tabindex="-1"><img class="${css.cardImage}" src="${MARKET_ROOT}img/${listing.id}/1.svg" alt="" loading="lazy" width="180" height="180"></a>${heart(css, listing, state)}
<div class="${css.gridBody}">
${sponsored ? sponsoredLabel(css, context, position) : ""}
<p class="${css.cardLine}">${escapeHtml(country(listing))}</p>
<p class="${css.cardLine}">${skeletons(css)}</p>
<p class="${css.cardLine}">${skeletons(css)}</p>
<p class="${css.cardLine}">${skeletons(css)}</p>
<p class="${css.cardLine}">${skeletons(css)}</p>
<p class="${css.cardLine}">${listing.condition} · ${escapeHtml(listing.brand)}</p>
<h3 class="${css.cardLine}"><a class="${css.cardTitle}" href="${href}">${titleHeading(css, listing).replace('role="heading" aria-level="3"', "")}</a></h3>
</div>
</li>`;
}
