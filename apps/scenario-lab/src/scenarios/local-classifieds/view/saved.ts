import { escapeHtml } from "../../../html.js";
import { listingById, placeById, type Listing } from "../catalog/index.js";
import { priceText } from "../format/index.js";
import { savedTotalText } from "../readouts.js";
import { PRIOR_SAVED_KEYS } from "../state.js";
import type { ClassifiedsState } from "../types.js";
import { listingPath } from "./card.js";
import type { ClassSheet, IdName } from "./classes.js";
import { photoFor } from "./photo.js";

/** When the account's two old saves were made, as the list words it. */
const PRIOR_SAVED_WHEN: Readonly<Record<(typeof PRIOR_SAVED_KEYS)[number], string>> = {
  "rattan-armchair": "Saved 3 weeks ago",
  "desk-lamp": "Saved 5 days ago",
};

/**
 * Saved items, most recently saved first, which is an order that depends on
 * the order things were saved in. The sort menu is a plain select and it
 * reorders the list where it stands. A sold listing stays in the list with
 * its status; a reduced one carries a "Price dropped" chip beside its prices.
 */
export function savedMarkup(sheet: ClassSheet, ids: Record<IdName, string>, state: ClassifiedsState): string {
  const c = sheet.names;
  const listings = [...state.saved].reverse().map((id) => listingById(id)).filter((listing): listing is Listing => listing !== undefined);
  const rows = listings.map((listing) => {
    const was = listing.was === undefined ? "" : `<span class="${c.cardWas}">${escapeHtml(priceText(listing.was))}</span><span class="${c.chip}">Price dropped</span>`;
    const when = (PRIOR_SAVED_WHEN as Record<string, string>)[listing.key] ?? "Saved just now";
    return `<li class="${c.savedRow}">
  <div class="${c.savedMedia}"><img alt="" src="${photoFor(listing.title, listing.category)}"></div>
  <div>
    <a class="${c.savedTitle}" href="${listingPath(listing)}">${escapeHtml(listing.title)}</a>
    <div><span class="${c.savedPrice}">${escapeHtml(priceText(listing.price))}</span>${was}</div>
    <div class="${c.savedMeta}"><span class="${c.savedStatus}">${listing.sold ? "Sold" : "Available"}</span> · <span>${escapeHtml(placeById(listing.place).name)}</span> · <span>${when}</span></div>
  </div>
  <div class="${c.chatControl}" role="button" tabindex="0" aria-label="${escapeHtml(`More options for ${listing.title}`)}">&middot;&middot;&middot;</div>
</li>`;
  }).join("\n");
  const empty = listings.length === 0 ? `<div class="${c.emptyState}">Nothing saved yet. Tap Save on a listing to keep it here.</div>` : "";
  return `<div class="${c.pageHead}">
  <h2 class="${c.pageTitle}">Saved items</h2>
  <span class="${c.savedTotal}" data-testid="marketplace_saved_total">${savedTotalText(listings.length)}</span>
  <label class="${c.srOnly}" for="${ids.savedSort}">Sort saved items</label>
  <select class="${c.select}" id="${ids.savedSort}">
    <option value="recent" selected>Recently saved</option>
    <option value="price_ascend">Price: lowest first</option>
    <option value="price_descend">Price: highest first</option>
  </select>
</div>
<ul class="${c.savedList}">${rows}</ul>${empty}`;
}
