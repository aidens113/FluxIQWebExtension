import { escapeHtml } from "../../../html.js";
import type { RenderContext } from "../../../types.js";
import { AD_ONLY_LISTINGS, ORGANIC_LISTINGS, type ResultSlot } from "../catalog/index.js";
import { homeScript } from "../client/index.js";
import type { MarketState } from "../state/index.js";
import type { MarketClasses } from "../styles/index.js";
import { resultCard } from "./cards.js";
import { searchHref } from "./links.js";
import { marketDocument } from "./shell.js";

/** Cards per "More to love" page, and how many pages the feed has before it ends. */
export const FEED_PAGE_SIZE = 10;
export const FEED_PAGES = 4;

const CATEGORIES = ["Home & Garden", "Hair Extensions & Wigs", "Men's Clothing", "Accessories", "Consumer Electronics", "Home Improvement & Lighting", "Home Appliances", "Automotive", "Luggage & Bags", "Shoes", "Special Occasion Costume", "Women's Clothing", "Computer & Office", "Phones & Telecommunications"];
const SLIDES = ["Autumn Mega Sale · up to 70% off", "Choice Day · free returns on every Choice item", "New user? 3,00 € off your first order"];

/** The feed's fixed order: every listing once, interleaved so paid placements sit among organic ones. */
function feedOrder(): ResultSlot[] {
  const organic = ORGANIC_LISTINGS.map((listing) => ({ listing, sponsored: false }));
  const ads = AD_ONLY_LISTINGS.map((listing) => ({ listing, sponsored: true }));
  const order: ResultSlot[] = [];
  for (let index = 0; index < organic.length; index += 1) {
    order.push(organic[(index * 17) % organic.length]!);
    const ad = ads[Math.floor(index / 9)];
    if (index % 9 === 2 && ad) order.push(ad);
  }
  return order.slice(0, FEED_PAGE_SIZE * FEED_PAGES);
}

export function feedPage(page: number): ResultSlot[] {
  return feedOrder().slice((page - 1) * FEED_PAGE_SIZE, page * FEED_PAGE_SIZE);
}

/**
 * The home page: a category menu, a rotating hero, a SuperDeals row, and the
 * "More to love" feed, which keeps loading as it is scrolled. The feed's
 * second request is rate limited, and the page handles that the way the live
 * one does -- the spinner stays, and a Retry link appears beside it once the
 * server's retry-after has passed.
 */
export function renderHomePage(state: MarketState, context: RenderContext, c: MarketClasses): string {
  const deals = [6, 23, 28, 0, 3, 38].map((index) => ({ listing: ORGANIC_LISTINGS[index]!, sponsored: false }));
  const body = `<div class="${c.homeGrid}">
<ul class="${c.catMenu}">${CATEGORIES.map((name) => `<li><a class="${c.catLink}" href="${searchHref({ q: name.toLowerCase() })}">${escapeHtml(name)}</a></li>`).join("")}</ul>
<div class="${c.hero}">${SLIDES.map((text, index) => `<div class="${c.heroSlide}"${index === 0 ? ' style="display:block"' : ""}>${escapeHtml(text)}</div>`).join("")}</div>
</div>
<div class="${c.sectionTitle}">SuperDeals <span class="${c.stockNote}">Ends in <b>05:42:17</b></span></div>
<div class="${c.dealsRow}">${deals.map((slot) => resultCard(slot, c, state.region)).join("")}</div>
<div class="${c.sectionTitle}">More to love</div>
<div class="${c.feed}">${feedPage(1).map((slot) => resultCard(slot, c, state.region)).join("")}</div>
<div class="${c.feedStatus}"></div>`;
  return marketDocument({ state, context, c, kind: "home", title: "Farbazaar - Online Shopping for Electronics, Fashion, Home & Garden, Toys & Sports", body, pageScript: `const pageData = ${JSON.stringify({ feedPages: FEED_PAGES })};\n${homeScript()}` });
}
