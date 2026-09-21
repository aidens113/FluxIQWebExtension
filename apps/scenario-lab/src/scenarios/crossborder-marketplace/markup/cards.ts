import { escapeHtml } from "../../../html.js";
import { storeById, type Listing, type ResultSlot } from "../catalog/index.js";
import { formatMoney, priceParts, type RegionCode } from "../locale/index.js";
import type { MarketClasses } from "../styles/index.js";
import { itemHref, MARKET_ROOT } from "./links.js";

/** A one-pixel placeholder a lazy image shows until it scrolls into view. */
const BLANK_IMAGE = "data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAACAkQBADs=";

/**
 * One result card, as the live grid draws it: the title and image each a link
 * that opens the item in a new tab, the price in three styled pieces, the
 * stars as a filled bar with the number beside it, and the store's name at the
 * foot. A paid placement is the same card with a small "Ad" in its corner and
 * a tracking parameter on its links -- nothing else tells it apart.
 *
 * `layout: "list"` is the same data in the list layout's arrangement: price
 * and store in a column of their own beside the details.
 */
export function resultCard(slot: ResultSlot, c: MarketClasses, region: RegionCode, layout: "grid" | "list" = "grid"): string {
  const { listing, sponsored } = slot;
  const href = `${itemHref(listing.id)}${sponsored ? "?src=ad" : ""}`;
  const title = escapeHtml(listing.title);
  const image = `<a class="${c.cardLink}" href="${href}" target="_blank" rel="noopener"><img class="${c.cardImage}" src="${BLANK_IMAGE}" data-src="${MARKET_ROOT}img/${listing.id}.svg" alt=""></a>`;
  const heading = `<a class="${c.cardLink}" href="${href}" target="_blank" rel="noopener"><div class="${c.cardTitle}" title="${title}">${title}</div></a>`;
  const price = priceMarkup(listing, c, region);
  const store = `<div class="${c.storeName}">${escapeHtml(storeById(listing.storeId).name)}</div>`;
  const ad = sponsored ? `<span class="${c.adTag}">Ad</span>` : "";
  if (layout === "list") {
    return `<div class="${c.card}">${image}<div class="${c.cardBody}">${heading}${ratingRow(listing, c)}${shippingNote(listing, c, region)}${badges(listing, c)}</div><div class="${c.listAside}">${price}${store}</div>${ad}</div>`;
  }
  return `<div class="${c.card}">${image}<div class="${c.cardBody}">${heading}${price}${ratingRow(listing, c)}${shippingNote(listing, c, region)}${badges(listing, c)}${store}</div>${ad}</div>`;
}

function priceMarkup(listing: Listing, c: MarketClasses, region: RegionCode): string {
  const { lead, whole, fraction, trail } = priceParts(listing.priceCents, region);
  const off = Math.round((1 - listing.priceCents / listing.originalCents) * 100);
  return `<div class="${c.price}"><span>${escapeHtml(lead)}</span><span>${whole}</span><span>${fraction}</span><span>${escapeHtml(trail)}</span></div>`
    + `<div class="${c.metaRow}"><span class="${c.priceOriginal}">${escapeHtml(formatMoney(listing.originalCents, region))}</span><span class="${c.discount}">-${off}%</span></div>`;
}

function ratingRow(listing: Listing, c: MarketClasses): string {
  const stars = listing.rating === null ? "" : `<span class="${c.stars}"><span class="${c.starsFill}" style="width:${listing.rating * 2}%"></span></span><span class="${c.ratingValue}">${(listing.rating / 10).toFixed(1)}</span>`;
  const sold = listing.sold === "" ? "" : `<span class="${c.soldCount}">${escapeHtml(listing.sold)}</span>`;
  return `<div class="${c.metaRow}">${stars}${sold}</div>`;
}

function shippingNote(listing: Listing, c: MarketClasses, region: RegionCode): string {
  const shipping = listing.shipping;
  const text = shipping.kind === "free" ? "Free shipping"
    : shipping.kind === "paid" ? `+${formatMoney(shipping.cents, region)} shipping`
      : `Free shipping over ${formatMoney(shipping.cents, region)}`;
  return `<div class="${c.shippingNote}">${escapeHtml(text)}</div>`;
}

function badges(listing: Listing, c: MarketClasses): string {
  const local = listing.origins.find((origin) => origin !== "China");
  const parts = [listing.choice ? `<span class="${c.choiceBadge}">Choice</span>` : "", local ? `<span class="${c.badge}">Ships from ${escapeHtml(local)}</span>` : ""].join("");
  return parts === "" ? "" : `<div class="${c.badges}">${parts}</div>`;
}
