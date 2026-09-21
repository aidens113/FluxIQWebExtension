import { escapeHtml } from "../../../html.js";
import { placeById, type FeedEntry, type Listing } from "../catalog/index.js";
import { conditionLabel, priceText } from "../format/index.js";
import type { ClassSheet } from "./classes.js";
import { photoFor } from "./photo.js";
import { CLASSIFIEDS_ROOT } from "../root.js";

export type CardLayout = "grid" | "list";

/** Where a listing lives. The address is the listing's id and nothing else, so it is the same on every seed and every run. */
export function listingPath(listing: Pick<Listing, "id">): string {
  return `${CLASSIFIEDS_ROOT}item/${listing.id}/`;
}

/**
 * One card of a results feed. A sponsored card is the same component as a
 * listing card -- the same classes, the same price, title and place rows --
 * with a small "Sponsored" line above the photo and a link that opens the
 * advertiser's shop in a new tab.
 *
 * The two layouts differ where a read anchored on the link would notice: in
 * the grid the link is the whole card, in the list layout it wraps only the
 * title and the price and place sit beside it.
 */
export function cardMarkup(entry: FeedEntry, sheet: ClassSheet, layout: CardLayout): string {
  const c = sheet.names;
  if (entry.kind === "advert") {
    const { advert } = entry;
    const href = `${CLASSIFIEDS_ROOT}ad/${advert.id}/?utm_source=kerbfind&amp;utm_medium=marketplace_feed`;
    const was = advert.was === undefined ? "" : `<span class="${c.cardWas}">${escapeHtml(priceText(advert.was))}</span>`;
    const sponsor = `<div class="${c.cardSponsor}"><span>Sponsored</span> · <span>${escapeHtml(advert.advertiser)}</span></div>`;
    const image = `<img class="${c.cardImage}" alt="${escapeHtml(advert.title)}" src="${photoFor(advert.title, "advert")}">`;
    if (layout === "list") {
      return `<div class="${c.rowCard}" role="article"><div class="${c.rowMedia}">${image}</div><div class="${c.rowBody}">${sponsor}<a class="${c.rowTitle}" href="${href}" target="_blank" rel="noopener">${escapeHtml(advert.title)}</a>
<div class="${c.cardPriceRow}"><span class="${c.cardPrice}">${escapeHtml(priceText(advert.price))}</span>${was}</div><div class="${c.rowMeta}"><span class="${c.cardPlace}">${escapeHtml(advert.town)}</span> · <span>New</span></div></div></div>`;
    }
    return `<div class="${c.cardWrap}"><a class="${c.card}" href="${href}" target="_blank" rel="noopener" tabindex="0">${sponsor}<div class="${c.cardMedia}">${image}</div>
<div class="${c.cardPriceRow}"><span class="${c.cardPrice}">${escapeHtml(priceText(advert.price))}</span>${was}</div><div><span class="${c.cardTitle}">${escapeHtml(advert.title)}</span></div><div><span class="${c.cardPlace}">${escapeHtml(advert.town)}</span></div></a></div>`;
  }
  const { listing } = entry;
  const place = placeById(listing.place).name;
  const was = listing.was === undefined ? "" : `<span class="${c.cardWas}">${escapeHtml(priceText(listing.was))}</span>`;
  const image = `<img class="${c.cardImage}" alt="${escapeHtml(`${listing.title} in ${place}`)}" src="${photoFor(listing.title, listing.category)}" loading="lazy">`;
  if (layout === "list") {
    return `<div class="${c.rowCard}" role="article"><div class="${c.rowMedia}">${image}</div><div class="${c.rowBody}"><a class="${c.rowTitle}" href="${listingPath(listing)}">${escapeHtml(listing.title)}</a>
<div class="${c.cardPriceRow}"><span class="${c.cardPrice}">${escapeHtml(priceText(listing.price))}</span>${was}</div><div class="${c.rowMeta}"><span class="${c.cardPlace}">${escapeHtml(place)}</span> · <span>${escapeHtml(conditionLabel(listing.condition))}</span></div></div></div>`;
  }
  return `<div class="${c.cardWrap}"><a class="${c.card}" href="${listingPath(listing)}" tabindex="0"><div class="${c.cardMedia}">${image}</div>
<div class="${c.cardPriceRow}"><span class="${c.cardPrice}">${escapeHtml(priceText(listing.price))}</span>${was}</div><div><span class="${c.cardTitle}">${escapeHtml(listing.title)}</span></div><div><span class="${c.cardPlace}">${escapeHtml(place)}</span></div></a></div>`;
}
