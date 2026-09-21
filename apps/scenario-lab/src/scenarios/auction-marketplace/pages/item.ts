import { escapeHtml } from "../../../html.js";
import type { RenderContext } from "../../../types.js";
import { approxText, bidCount, currentPrice, endStampText, moneyText, postageApproxText, sellerById, timeLeftText } from "../catalog/index.js";
import { itemClientScript } from "../client/index.js";
import { MARKET_ROOT } from "../paths.js";
import type { AuctionState, Listing } from "../types.js";
import { bidsText } from "./card.js";
import { bidDrawerMarkup, buyDrawerMarkup } from "./drawers.js";
import { renderShell } from "./shell.js";
import { auctionClasses, type AuctionClasses } from "./styles.js";
import { followButton, watchButton } from "./watch-controls.js";

function postageLine(listing: Listing): string {
  const { postage, currency } = listing;
  if (postage.kind === "free") return "Free Standard Delivery";
  if (postage.kind === "collection") return `Collection in person from ${postage.place}. This item does not post.`;
  const approx = postageApproxText(currency, postage);
  return `${moneyText(currency, postage.amount)}${approx === "" ? "" : ` (${approx})`} ${currency === "GBP" ? "Royal Mail Tracked 48" : "International Standard"}`;
}

function priceBox(css: AuctionClasses, listing: Listing, state: AuctionState): string {
  const { currency } = listing;
  const price = currentPrice(listing, state.bids);
  const approx = approxText(currency, price);
  const approxLine = approx === "" ? "" : `<div class="${css.priceMeta}">${approx}</div>`;
  if (listing.format === "auction" || listing.format === "auction-bin") {
    const bin = listing.format === "auction-bin" && listing.binPrice !== undefined && price === listing.price
      ? `<div class="${css.priceMeta}">or Buy it now ${moneyText(currency, listing.binPrice)}</div>` : "";
    return `<div class="${css.priceBox}"><div>Current bid:</div><div class="${css.priceBig}">${moneyText(currency, price)}</div>${approxLine}
<div class="${css.priceMeta}"><a class="${css.link}" href="${MARKET_ROOT}bfl/viewbids/${listing.id}" target="_blank" rel="noopener">${bidsText(bidCount(listing, state.bids))}</a> · Ends in ${timeLeftText(listing.endsIn ?? 0).replace(" left", "")}</div>
<div class="${css.priceMeta}">Ends ${endStampText(listing.endsIn ?? 0)}</div>${bin}</div>`;
  }
  if (listing.variations) {
    const options = listing.variations.map((option) => `<div class="${css.variantOption}" role="option" aria-selected="false" title="${moneyText(currency, option.price)}">${escapeHtml(option.label)}</div>`).join("");
    return `<div class="${css.priceBox}"><div>Price:</div><div class="${css.priceBig}">${moneyText(currency, listing.price)} to ${moneyText(currency, listing.priceTo ?? listing.price)}</div>
<div class="${css.field}"><span class="${css.fieldLabel}">Colour</span><div class="${css.variantPicker}" role="button" aria-haspopup="listbox" aria-expanded="false">- Select -</div><div role="listbox" hidden>${options}</div></div></div>`;
  }
  return `<div class="${css.priceBox}"><div>Price:</div><div class="${css.priceBig}">${moneyText(currency, price)}</div>${approxLine}${listing.format === "fixed-offer" ? `<div class="${css.priceMeta}">or Best Offer</div>` : ""}</div>`;
}

function actions(css: AuctionClasses, listing: Listing, state: AuctionState): string {
  const redesign = state.mode === "watch-redesign";
  const auction = listing.format === "auction" || listing.format === "auction-bin";
  const binOpen = listing.format !== "auction" && (listing.format !== "auction-bin" || currentPrice(listing, state.bids) === listing.price);
  const bid = auction ? `<button class="${css.button} ${css.buttonPrimary}" type="button">Place bid</button>` : "";
  const buy = binOpen ? `<button class="${css.button}${auction ? "" : ` ${css.buttonPrimary}`}" type="button"${listing.variations ? " disabled" : ""}>Buy it now</button>` : "";
  const basket = auction ? "" : `<button class="${css.button}" type="button">Add to basket</button>`;
  const offer = listing.format === "fixed-offer" ? `<button class="${css.button}" type="button">Make offer</button>` : "";
  const watch = redesign ? followButton(css, listing.seller, state, "Save this seller") : watchButton(css, listing, state, "cta");
  return `<div class="${css.ctaColumn}">${bid}${buy}${basket}${offer}${watch}</div>`;
}

function specs(css: AuctionClasses, listing: Listing): string {
  const rows: Array<[string, string]> = [
    ["Condition", listing.condition], ["Brand", listing.brand], ["Model", listing.model], ["Type", listing.type],
    ["Film format", "35mm"], ["Country of origin", "Japan"], ["Seller notes", listing.subtitle === "" ? "See description" : listing.subtitle],
  ];
  return `<table class="${css.specs}"><tbody>${rows.map(([name, value]) => `<tr class="${css.specRow}"><td>${name}</td><td>${escapeHtml(value)}</td></tr>`).join("")}</tbody></table>`;
}

/**
 * A listing's own page: the gallery, the title, the price box, the actions,
 * postage and returns, the seller, the item specifics and the seller's
 * description, which is served from another origin in a frame, as real
 * marketplaces serve seller-written HTML. The seller's shop and the bid
 * history open in new tabs; similar sponsored items load when scrolled to.
 */
export function renderItem(state: AuctionState, context: RenderContext, listing: Listing): string {
  const css = auctionClasses(context.seed);
  const seller = sellerById(listing.seller);
  const redesign = state.mode === "watch-redesign";
  const thumbs = [1, 2, 3, 4].map((index) => `<img class="${css.thumb}" src="${MARKET_ROOT}img/${listing.id}/${index}.svg" alt="" loading="lazy" width="64" height="64">`).join("");
  const frameSource = `${context.alternateOrigin ?? ""}${MARKET_ROOT}desc/${listing.id}`;
  const returns = listing.condition === "For parts or not working" ? "No returns accepted" : "30 days returns. Buyer pays for return postage.";
  const main = `<p class="${css.crumbs}">Hammerline › Cameras &amp; Photography › Film Photography › Film Cameras</p>
<div class="${css.item}">
<div class="${css.gallery}">${redesign ? watchButton(css, listing, state, "heart") : ""}<img class="${css.galleryMain}" src="${MARKET_ROOT}img/${listing.id}/1.svg" alt="${escapeHtml(listing.title)}"><div class="${css.galleryThumbs}">${thumbs}</div></div>
<div class="${css.summary}">
<h1 class="${css.itemTitle}">${escapeHtml(listing.title)}</h1>
<p class="${css.itemSubtitle}">${escapeHtml(listing.subtitle)}</p>
<p><a class="${css.link}" href="${MARKET_ROOT}str/${encodeURIComponent(listing.seller)}" target="_blank" rel="noopener">${escapeHtml(listing.seller)}</a> (${seller.feedback.toLocaleString("en-GB")}) · ${seller.positive} positive · ${listing.watchers} watching</p>
<p>Condition: <strong>${listing.condition}</strong></p>
${priceBox(css, listing, state)}
${actions(css, listing, state)}
<p>Postage: ${escapeHtml(postageLine(listing))}</p>
<p>Located in: ${escapeHtml(seller.location)}</p>
<p>Returns: ${returns}</p>
<div class="${css.sellerCard}"><p><strong>${escapeHtml(listing.seller)}</strong> · member since ${seller.since}</p><p>${seller.positive} positive feedback</p>${redesign ? "" : followButton(css, listing.seller, state, "Save seller")}</div>
</div>
</div>
<section aria-label="About this item"><h2>About this item <span class="${css.itemNumber}">Item number: ${listing.id}</span></h2>
${specs(css, listing)}
<iframe class="${css.descFrame}" title="Item description from the seller" src="${escapeHtml(frameSource)}" loading="lazy"></iframe>
</section>
<section class="${css.similar}" aria-label="Similar sponsored items"><h2>Similar sponsored items</h2></section>`;
  const auction = listing.format === "auction" || listing.format === "auction-bin";
  const overlays = `${auction ? bidDrawerMarkup(css, listing, state) : ""}${listing.format !== "auction" ? buyDrawerMarkup(css, listing) : ""}`;
  const boot = { itemId: listing.id, currency: listing.currency, variations: (listing.variations ?? []).map((option) => ({ label: option.label, price: moneyText(listing.currency, option.price) })), price: moneyText(listing.currency, currentPrice(listing, state.bids)), buyPrice: moneyText(listing.currency, listing.format === "auction-bin" ? listing.binPrice ?? listing.price : listing.price) };
  return renderShell({ css, state, context, kind: "item", title: listing.title, main, overlays, pageScript: itemClientScript(boot) });
}
