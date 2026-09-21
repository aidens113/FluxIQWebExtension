import { escapeHtml } from "../../../html.js";
import type { Advert, Place } from "../catalog/index.js";
import { priceText } from "../format/index.js";
import { CLASSIFIEDS_ROOT } from "../root.js";
import type { ClassSheet } from "./classes.js";
import { photoFor } from "./photo.js";

/** The advertiser's own shop page, which a sponsored card opens in a new tab. Its Buy now is a real purchase path, not a listing. */
export function advertShopMarkup(sheet: ClassSheet, advert: Advert): string {
  const c = sheet.names;
  const was = advert.was === undefined ? "" : ` <s>${escapeHtml(priceText(advert.was))}</s>`;
  return `<div class="${c.shopHead}">${escapeHtml(advert.advertiser)}</div>
<div class="${c.shopBody}">
  <img alt="${escapeHtml(advert.title)}" src="${photoFor(advert.title, "advert")}" width="240" height="240">
  <h1>${escapeHtml(advert.title)}</h1>
  <p><strong>${escapeHtml(priceText(advert.price))}</strong>${was} · Free delivery in 2 days</p>
  <p>${escapeHtml(advert.pitch)}</p>
  <div class="${c.buttonPrimary}" role="button" tabindex="0">Buy now</div>
  <p class="${c.sellerMeta}">Sold and shipped by ${escapeHtml(advert.advertiser)}. Not a Kerbfind Marketplace listing.</p>
</div>`;
}

/**
 * The map on a listing page. It is a document of its own, served from the
 * lab's second loopback origin, so it is a cross-origin frame like a real
 * embedded map; it shows the approximate area and nothing else.
 */
export function mapFrameBody(place: Place): string {
  const svg = `<svg width="100%" height="140" viewBox="0 0 300 140" role="img" aria-label="Map of ${escapeHtml(place.name)}"><rect width="300" height="140" fill="#e8eee4"/><path d="M0 90 C80 70 140 110 300 80" stroke="#b9c8e0" stroke-width="14" fill="none"/><path d="M60 0 L90 140 M200 0 L180 140" stroke="#fff" stroke-width="6"/><circle cx="150" cy="70" r="34" fill="rgba(8,102,255,.18)" stroke="#0866ff"/></svg>`;
  return `<main style="margin:0;padding:0">${svg}<p style="margin:4px 8px;font:13px sans-serif;color:#65676b">Approximate location: ${escapeHtml(place.name)}</p></main>`;
}

/** What the top bar's "Search Kerbfind" finds: people and groups, and a link across to Marketplace. */
export function peopleResultsMarkup(sheet: ClassSheet, text: string): string {
  const c = sheet.names;
  const query = new URLSearchParams({ query: text }).toString();
  return `<div class="${c.pageHead}"><h2 class="${c.pageTitle}">Search results for ${escapeHtml(`"${text}"`)}</h2></div>
<ul class="${c.threadList}">
  <li class="${c.thread}"><div class="${c.avatar}">KC</div><div><span class="${c.threadName}">Kelford Cycling Club</span><div class="${c.threadSnippet}">Group · 2.1K members</div></div></li>
  <li class="${c.thread}"><div class="${c.avatar}">KB</div><div><span class="${c.threadName}">Kelford Buy, Swap &amp; Sell</span><div class="${c.threadSnippet}">Group · 14K members</div></div></li>
  <li class="${c.thread}"><div class="${c.avatar}">${escapeHtml(text.slice(0, 1).toUpperCase() || "K")}</div><div><span class="${c.threadName}">${escapeHtml(text)} fans of Kelford</span><div class="${c.threadSnippet}">Page · 312 followers</div></div></li>
</ul>
<p><a class="${c.linkButton}" href="${CLASSIFIEDS_ROOT}search/?${query}">See results for ${escapeHtml(`"${text}"`)} in Marketplace</a></p>`;
}

export function placeholderMarkup(sheet: ClassSheet, heading: string, message: string): string {
  const c = sheet.names;
  return `<div class="${c.pageHead}"><h2 class="${c.pageTitle}">${escapeHtml(heading)}</h2></div><div class="${c.emptyState}">${escapeHtml(message)}</div>`;
}
