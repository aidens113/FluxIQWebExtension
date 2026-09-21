import { escapeHtml } from "../../../../html.js";
import type { ResultsPage, SearchOutcome } from "../../catalog/index.js";
import type { StoreClasses, StoreIds } from "../../style/index.js";
import { resultCard } from "./result-card.js";

/**
 * The results list's markup for one page, in the two parts the page delivers
 * it in.
 *
 * `eager` is what arrives with the page (inside a template, rendered by the
 * page's script after a moment): two adverts, four results, the house-brand
 * carousel, four more, another advert, four more, and then a sentinel that
 * loads the rest when it scrolls into view. `lazy` is what the sentinel
 * fetches: the remaining results and the last advert. A page with nothing
 * left to load puts the last advert at the end of `eager` instead.
 */
export function resultsMarkup(css: StoreClasses, ids: StoreIds, outcome: SearchOutcome, page: ResultsPage, part: "eager" | "lazy", moreHref: string): string {
  const organic = (offset: number, count: number) => page.eager.slice(offset, offset + count)
    .map((product, position) => resultCard(css, product, { kind: "organic", index: offset + position + 1 })).join("\n");
  const bottom = page.bottom ? resultCard(css, page.bottom.product, { kind: "sponsored", index: 0, ad: page.bottom }) : "";
  if (part === "lazy") {
    const rest = page.lazy.map((product, position) => resultCard(css, product, { kind: "organic", index: page.eager.length + position + 1 })).join("\n");
    return `${rest}\n${bottom}`;
  }
  const top = page.top.map((ad) => resultCard(css, ad.product, { kind: "sponsored", index: 0, ad })).join("\n");
  const carousel = outcome.featured.length === 0 ? "" : `<div class="${css.carousel}" role="region" aria-label="Featured from our brands">
<p class="${css.carouselHead}">Featured from our brands <span class="${css.adLabel}">Sponsored</span></p>
<ul class="${css.carouselTrack}">${outcome.featured.map((product, position) => resultCard(css, product, { kind: "carousel", ad: { adId: `sb-HB${position + 1}`, product } })).join("")}</ul>
</div>`;
  const mid = page.mid ? resultCard(css, page.mid.product, { kind: "sponsored", index: 0, ad: page.mid }) : "";
  const tail = page.lazy.length > 0
    ? `<div class="${css.sentinel}" id="${ids.sentinel}" data-more="${escapeHtml(moreHref)}">Loading more results&hellip;</div>`
    : bottom;
  return [top, organic(0, 4), carousel, organic(4, 4), mid, organic(8, 4), tail].filter(Boolean).join("\n");
}
