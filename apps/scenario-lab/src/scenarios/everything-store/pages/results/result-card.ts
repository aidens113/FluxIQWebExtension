import { escapeHtml } from "../../../../html.js";
import { DELIVERY_DATES, STORE_PATHS, formatMoney, type AdPlacement, type Product } from "../../catalog/index.js";
import type { StoreClasses } from "../../style/index.js";

/** A transparent pixel: what an image holds until the page's script swaps its real address in. */
const PLACEHOLDER = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

/** An organic card's `index` is its one-based position among the organic results of its own page. */
export type CardPlacement =
  | { kind: "organic"; index: number }
  | { kind: "sponsored"; index: number; ad: AdPlacement }
  | { kind: "carousel"; ad: AdPlacement }
  | { kind: "widget" };

/**
 * A price the way the store marks it up: the readable amount once, for
 * screen readers, in a visually hidden span; then the same amount again in
 * pieces for the eye -- symbol, whole dollars, a hidden decimal point, and
 * cents set small. The element's whole text therefore reads the price twice.
 */
function priceMarkup(css: StoreClasses, cents: number): string {
  const text = formatMoney(cents);
  const [whole = "0", fraction = "00"] = text.slice(1).split(".");
  return `<span class="${css.price}"><span class="${css.offscreen}">${text}</span><span aria-hidden="true"><span class="${css.priceSym}">$</span><span class="${css.priceWhole}">${whole}<span class="${css.priceDec}">.</span></span><span class="${css.priceFrac}">${fraction}</span></span></span>`;
}

/**
 * The rating: the number a person reads, then a star icon whose only text is
 * a visually hidden sentence. The icon is drawn to the nearest half star, so
 * a 3.8 shows four stars.
 */
function ratingMarkup(css: StoreClasses, product: Product, href: string): string {
  const rating = product.rating.toFixed(1);
  const count = product.ratingCount.toLocaleString("en-US");
  return `<div class="${css.reviews}"><span class="${css.stars}"><span class="${css.ratingNum}" aria-hidden="true">${rating}</span><i data-stars="${Math.round(product.rating * 2) / 2}"><span class="${css.offscreen}">${rating} out of 5 stars</span></i></span><a href="${href}#customer-reviews" aria-label="${count} ratings"><span class="${css.ratingCount}">(${count})</span></a></div>`;
}

/**
 * The delivery line. Plus eligibility is an icon with an accessible name and
 * nothing else; an ineligible listing says what delivery costs instead.
 */
function deliveryMarkup(css: StoreClasses, product: Product): string {
  if (product.plus) return `<div class="${css.delivery}"><i class="${css.plusBadge}" role="img" aria-label="Brightaisle Plus"></i> FREE delivery <b>${DELIVERY_DATES.standard.short}</b></div>`;
  return `<div class="${css.delivery}">${product.priceCents >= 3500 ? "FREE delivery" : `${formatMoney(649)} delivery`} <b>${DELIVERY_DATES.economy.short}</b></div>`;
}

function hrefFor(product: Product, placement: CardPlacement): string {
  return placement.kind === "sponsored" || placement.kind === "carousel" ? STORE_PATHS.sponsored(placement.ad) : STORE_PATHS.product(product);
}

/**
 * One product in a results list, sponsored or not, or in a carousel.
 *
 * An organic card and a sponsored one are the same component with the same
 * container attributes. The differences a person sees are the grey
 * "Sponsored" label above the image and nothing else; the differences in the
 * markup are the ad's id on the container and a link that goes through the ad
 * server's redirect in a new tab. Carousel tiles and the "frequently viewed"
 * widget are a different, smaller component that also carries the listing's
 * id.
 */
export function resultCard(css: StoreClasses, product: Product, placement: CardPlacement): string {
  const href = hrefFor(product, placement);
  const newTab = placement.kind === "sponsored" || placement.kind === "carousel" ? ` target="_blank" rel="noopener"` : "";
  const title = escapeHtml(product.title);
  const image = `<img class="${css.cardImg}" src="${PLACEHOLDER}" data-src="${STORE_PATHS.image(product.sku)}" alt="${title}" width="200" height="200">`;
  const price = `<div class="${css.priceRow}" itemprop="offers" itemscope itemtype="https://schema.org/Offer"><meta itemprop="price" content="${(product.priceCents / 100).toFixed(2)}"><meta itemprop="priceCurrency" content="USD"><a class="${css.priceLink}" href="${href}"${newTab}>${priceMarkup(css, product.priceCents)}</a>${product.listPriceCents === null ? "" : `<span class="${css.listPrice}">List: <span class="${css.strike}"><span class="${css.offscreen}">${formatMoney(product.listPriceCents)}</span><span aria-hidden="true">${formatMoney(product.listPriceCents)}</span></span></span>`}</div>`;
  if (placement.kind === "carousel" || placement.kind === "widget") {
    return `<li class="${css.carouselItem}" data-sku="${product.sku}"><a href="${href}"${newTab}>${image}<span class="${css.titleLink}">${title}</span></a>${ratingMarkup(css, product, href)}${price}</li>`;
  }
  const sponsored = placement.kind === "sponsored"
    ? `<div class="${css.adLabel}"><span>Sponsored</span> <span class="${css.adInfo}" role="button" tabindex="0" aria-label="Leave ad feedback">&#9432;</span></div>`
    : "";
  const adAttribute = placement.kind === "sponsored" ? ` data-ad-id="${placement.ad.adId}"` : "";
  const brandLine = product.kind === "earbuds" && product.brand.length <= 10 ? `<div class="${css.brandLine}">${escapeHtml(product.brand)}</div>` : "";
  const cta = product.family === null
    ? `<button type="button" class="${css.buttonSmall}" data-add-sku="${product.sku}">Add to cart</button>`
    : `<a class="${css.linkish}" href="${href}">See options</a> <span class="${css.social}">3 colors, 2 sizes</span>`;
  return `<div role="listitem" class="${css.card}" data-component="search-result" data-sku="${product.sku}" data-index="${placement.index}"${adAttribute}>
${sponsored}<a class="${css.cardImgLink}" href="${href}" tabindex="-1"${newTab}>${image}</a>
<div class="${css.cardBody}">${brandLine}<h2 class="${css.cardTitle}"><a class="${css.titleLink}" href="${href}"${newTab}><span>${title}</span></a></h2>
${ratingMarkup(css, product, href)}${product.bought === null ? "" : `<div class="${css.social}">${escapeHtml(product.bought)}</div>`}
${price}${product.coupon === null ? "" : `<div class="${css.coupon}"><span class="${css.couponBadge}">${escapeHtml(product.coupon)}</span> with coupon</div>`}
${deliveryMarkup(css, product)}<div>${cta}</div></div>
</div>`;
}
