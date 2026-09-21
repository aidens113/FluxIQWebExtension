import { escapeHtml } from "../../../html.js";
import type { RenderContext } from "../../../types.js";
import { listingByHandle, pageWindow, PAGE_SIZES, searchListings, searchQueryString, SORTS, statedTotal, type SearchParams } from "../catalog/index.js";
import { resultsClientScript } from "../client/index.js";
import { resultsPath } from "../paths.js";
import type { AuctionState, Listing } from "../types.js";
import { cardSlots, gridCardMarkup, listCardMarkup } from "./card.js";
import { railMarkup } from "./rail.js";
import { promoMarkup, surveyMarkup } from "./overlays.js";
import { renderShell, rotatingId } from "./shell.js";
import type { AuctionClasses } from "./styles.js";

/**
 * The advertisements each page of results carries, whatever was searched for
 * and however it was filtered: that is what paid placement is. Page one
 * advertises a genuine Kestrel 35 auction that the organic results list as
 * well, and a camera nobody searched for; later pages advertise a 35S, the
 * half case, a fixed-price Kestrel 35 and another genuine auction.
 */
const ADVERTS: readonly (readonly string[])[] = [["m4", "n2"], ["l1", "a2"], ["x5", "m9"]];
/** Where on a page the two advertisements are placed, counted in organic cards before them. */
const AD_SLOTS = [2, 9] as const;

function adsFor(page: number): Listing[] {
  return (ADVERTS[Math.min(page, ADVERTS.length) - 1] ?? []).map((handle) => listingByHandle(handle));
}

function tabsMarkup(css: AuctionClasses, params: SearchParams): string {
  const tab = (format: SearchParams["format"], label: string) => {
    const active = params.format === format;
    const href = resultsPath(searchQueryString({ ...params, format, page: 1 }));
    return `<a class="${css.tab}${active ? ` ${css.tabActive}` : ""}" href="${escapeHtml(href)}"${active ? ` aria-current="page"` : ""}>${label}</a>`;
  };
  return `<nav class="${css.tabs}" aria-label="Buying format">${tab("all", "All listings")}${tab("auction", "Auction")}${tab("bin", "Buy it now")}</nav>`;
}

/** The sort control: a button that opens a menu of links. The button has a bug; see the client script. */
function sortMarkup(css: AuctionClasses, params: SearchParams): string {
  const current = SORTS.find((option) => option.code === params.sort) ?? SORTS[0];
  const items = SORTS.map((option) => `<a class="${css.sortItem}" role="menuitem" href="${escapeHtml(resultsPath(searchQueryString({ ...params, sort: option.code, page: 1 })))}">${option.label}</a>`).join("");
  return `<div class="${css.tools}"><div class="${css.sortWrap}"><button class="${css.sortButton}" type="button" aria-haspopup="menu" aria-expanded="false">Sort: ${current.label}</button><div class="${css.sortMenu}" role="menu" hidden>${items}</div></div></div>`;
}

/**
 * Page links, previous and next arrows, and the page size. The next arrow is
 * broken from page two on: it is built from the page that was requested
 * rather than the one after it, so following it from page two reloads page
 * two for ever. The numbered links are right.
 */
function paginationMarkup(css: AuctionClasses, params: SearchParams, page: number, pages: number): string {
  const href = (target: number) => escapeHtml(resultsPath(searchQueryString({ ...params, page: target })));
  const numbers = Array.from({ length: pages }, (_, index) => index + 1).map((target) => target === page
    ? `<a class="${css.pageLink} ${css.pageCurrent}" href="${href(target)}" aria-current="page">${target}</a>`
    : `<a class="${css.pageLink}" href="${href(target)}">${target}</a>`).join("");
  const previous = page > 1 ? `<a class="${css.pageArrow}" href="${href(page - 1)}" aria-label="Go to previous search page">&#8249;</a>` : `<span class="${css.pageArrow}" aria-disabled="true">&#8249;</span>`;
  const nextTarget = page === 1 ? 2 : page;
  const next = page < pages ? `<a class="${css.pageArrow}" href="${href(nextTarget)}" aria-label="Go to next search page">&#8250;</a>` : `<span class="${css.pageArrow}" aria-disabled="true">&#8250;</span>`;
  const sizeOptions = PAGE_SIZES.map((size) => `<option value="${escapeHtml(resultsPath(searchQueryString({ ...params, perPage: size, page: 1 })))}"${size === params.perPage ? " selected" : ""}>${size}</option>`).join("");
  return `<nav class="${css.pagination}" aria-label="Results pagination">${previous}${numbers}${next}<label class="${css.perPage}">Items per page <select aria-label="Items per page">${sizeOptions}</select></label></nav>`;
}

/**
 * A page of search results: the filter rail, the buying-format tabs, the sort
 * control, one page of cards with two advertisements mixed in, and the page
 * links. The cards arrive as skeletons and the page fills them in from the
 * data it was served with, a little after it loads. The results list says it
 * is busy until then.
 */
export function renderResults(state: AuctionState, context: RenderContext, css: AuctionClasses, params: SearchParams): string {
  const found = searchListings(params, state.bids);
  const window = pageWindow(found.length, params.page, params.perPage);
  const organic = found.slice(window.start, window.end);
  const ads = adsFor(window.page);
  const grid = state.mode === "grid-view";
  const card = grid ? gridCardMarkup : listCardMarkup;
  const cards: string[] = [];
  const hydration: Record<string, string[]> = {};
  organic.forEach((listing, index) => {
    const slot = AD_SLOTS.indexOf(index as (typeof AD_SLOTS)[number]);
    const advert = slot >= 0 ? ads[slot] : undefined;
    if (advert) { cards.push(card(css, advert, state, context, true, cards.length + 1)); hydration[advert.id] = cardSlots(advert, state); }
    cards.push(card(css, listing, state, context, false, cards.length + 1));
    hydration[listing.id] = cardSlots(listing, state);
  });
  for (const advert of ads.slice(organic.length > AD_SLOTS[1] ? 2 : organic.length > AD_SLOTS[0] ? 1 : 0)) {
    cards.push(card(css, advert, state, context, true, cards.length + 1));
    hydration[advert.id] = cardSlots(advert, state);
  }
  const total = statedTotal(params, state.bids);
  const query = params.query === "" ? "all items" : params.query;
  const main = `<p class="${css.crumbs}">Hammerline › Cameras &amp; Photography › Film Photography</p>
<div class="${css.results}">
${railMarkup(css, params, state)}
<div class="${css.content}">
<div class="${css.resultsHead}"><h1 class="${css.resultsCount}">${total} results for <span>${escapeHtml(query)}</span></h1><button class="${css.button} ${css.buttonGhost}" type="button">Save this search</button></div>
${tabsMarkup(css, params)}
${sortMarkup(css, params)}
<ul class="${grid ? css.grid : css.list}" aria-busy="true">${cards.join("\n")}</ul>
<script type="application/json" id="${rotatingId(context, state, "hydration")}">${JSON.stringify(hydration).replaceAll("<", "\\u003c")}</script>
${found.length === 0 ? `<p>No exact matches found. Try fewer words or check your spelling.</p>` : paginationMarkup(css, params, window.page, window.pages)}
<div class="${css.related}">Related searches: <a class="${css.link}" href="${escapeHtml(resultsPath("_nkw=kestrel+35s"))}">kestrel 35s</a> · <a class="${css.link}" href="${escapeHtml(resultsPath("_nkw=kestrel+rangefinder"))}">kestrel rangefinder</a> · <a class="${css.link}" href="${escapeHtml(resultsPath("_nkw=kestrel+35+case"))}">kestrel 35 case</a></div>
</div>
</div>`;
  const surveyDue = state.mode === "feedback-survey" && !state.surveyDismissed && state.resultsViews >= 1;
  const overlays = `${state.promoDismissed ? "" : promoMarkup(css)}${surveyDue ? surveyMarkup(css) : ""}`;
  return renderShell({ css, state, context, kind: "results", title: `${params.query || "Search"} for sale`, main, overlays, pageScript: resultsClientScript(), query: params.query });
}
