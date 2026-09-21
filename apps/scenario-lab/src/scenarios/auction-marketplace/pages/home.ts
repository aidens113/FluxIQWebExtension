import { escapeHtml } from "../../../html.js";
import type { RenderContext } from "../../../types.js";
import { bidCount, currentPrice, endLabelText, listingByHandle, moneyText, timeLeftText } from "../catalog/index.js";
import { itemPath, MARKET_ROOT, resultsPath } from "../paths.js";
import type { AuctionState, Listing } from "../types.js";
import { bidsText } from "./card.js";
import { promoMarkup } from "./overlays.js";
import { renderShell } from "./shell.js";
import { auctionClasses, type AuctionClasses } from "./styles.js";
import { followButton, watchButton } from "./watch-controls.js";

function stripCard(css: AuctionClasses, listing: Listing, state: AuctionState): string {
  return `<a class="${css.stripCard}" href="${itemPath(listing.id)}"><img class="${css.cardImage}" src="${MARKET_ROOT}img/${listing.id}/1.svg" alt="${escapeHtml(listing.title)}" loading="lazy" width="180" height="180"><span>${escapeHtml(listing.title)}</span><br><strong>${moneyText(listing.currency, currentPrice(listing, state.bids))}</strong></a>`;
}

/**
 * "Pick up where you left off": the listing the person last looked at, with
 * its own Place bid and watch controls. It is a Kestrel 35S from the same
 * seller as the Kestrel 35 the bid task is about, so a run that bids on the
 * first auction it is shown bids on the wrong camera.
 */
function heroMarkup(css: AuctionClasses, state: AuctionState): string {
  const listing = listingByHandle("l1");
  const redesign = state.mode === "watch-redesign";
  const heart = redesign ? watchButton(css, listing, state, "heart") : "";
  const watch = redesign ? followButton(css, listing.seller, state, "Save this seller") : watchButton(css, listing, state, "cta");
  return `<section class="${css.hero}" aria-label="Pick up where you left off">
<div class="${css.heroMedia} ${css.gallery}">${heart}<img class="${css.cardImage}" src="${MARKET_ROOT}img/${listing.id}/1.svg" alt="${escapeHtml(listing.title)}" width="200" height="200"></div>
<div class="${css.heroInfo}">
<p>Pick up where you left off</p>
<h2><a class="${css.cardTitle}" href="${itemPath(listing.id)}">${escapeHtml(listing.title)}</a></h2>
<p>Seller: ${escapeHtml(listing.seller)}</p>
<p class="${css.heroPrice}">${moneyText(listing.currency, currentPrice(listing, state.bids))}</p>
<p>${bidsText(bidCount(listing, state.bids))} · ${timeLeftText(listing.endsIn ?? 0)} ${endLabelText(listing.endsIn ?? 0)}</p>
<div class="${css.heroActions}"><a class="${css.button} ${css.buttonPrimary}" href="${itemPath(listing.id)}">Place bid</a>${watch}</div>
</div>
</section>`;
}

/** The home page: the hero, the person's saved search, categories, deals and recently viewed listings. */
export function renderHome(state: AuctionState, context: RenderContext): string {
  const css = auctionClasses(context.seed);
  const deals = ["n2", "n3", "n4", "o3"].map((handle) => stripCard(css, listingByHandle(handle), state)).join("");
  const recent = ["l1", "m6", "x7", "n1"].map((handle) => stripCard(css, listingByHandle(handle), state)).join("");
  const tiles = [["Film cameras", "film camera"], ["Rangefinders", "rangefinder"], ["Lenses", "lens"], ["Kestrel", "kestrel"]]
    .map(([label, query]) => `<a class="${css.tile}" href="${escapeHtml(resultsPath(`_nkw=${encodeURIComponent(query!)}`))}">${label}</a>`).join("");
  const main = `<div class="${css.home}">
${heroMarkup(css, state)}
<section aria-label="Your saved searches"><h2>Your saved searches</h2><p><a class="${css.link}" href="${escapeHtml(resultsPath("_nkw=kestrel+35"))}">kestrel 35</a> · 4 new listings since your last visit</p></section>
<section aria-label="Shop by category"><h2>Shop by category</h2><div class="${css.tiles}">${tiles}</div></section>
<section aria-label="Deals for you"><h2>Deals for you</h2><div class="${css.strip}">${deals}</div></section>
<section aria-label="Your recently viewed items"><h2>Your recently viewed items</h2><div class="${css.strip}">${recent}</div></section>
</div>`;
  return renderShell({ css, state, context, kind: "home", title: "Buy and sell cameras, collectibles and more", main, overlays: state.promoDismissed ? "" : promoMarkup(css) });
}
