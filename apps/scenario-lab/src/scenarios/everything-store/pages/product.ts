import { escapeHtml } from "../../../html.js";
import { CATALOG, HOUSEHOLD, KETTLE_ADS, STORE_PATHS, formatMoney, type Product } from "../catalog/index.js";
import { productScript } from "../client/index.js";
import { buyBoxMarkup } from "./buy-box.js";
import type { PageKit } from "./page-kit.js";
import { resultCard } from "./results/index.js";
import { storePage } from "./shell.js";

const BULLETS: Readonly<Record<string, readonly string[]>> = {
  kettle: [
    "FAST BOIL: 1500 W element boils a full kettle in about four minutes.",
    "SAFE BY DESIGN: auto shut-off and boil-dry protection; the lid opens with one touch.",
    "CORDLESS: lifts off its 360-degree base; cord storage underneath.",
    "WHAT YOU GET: kettle, power base, removable limescale filter, and a 2-year manufacturer warranty.",
  ],
  earbuds: [
    "CLEAR SOUND: 13 mm drivers tuned for deep bass and clear vocals.",
    "ALL-DAY BATTERY: up to 8 hours per charge, the rest in the case.",
    "COMFORTABLE FIT: three sizes of silicone tips in the box.",
  ],
};

/**
 * The variant pickers. Finishes are swatches: `div`s with a picture and a
 * `title`, no role, no name, not focusable. Sizes are tiles, the same. Each
 * leads to its own child listing's page; a combination that is out of stock is
 * drawn crossed out and still leads to a page that says so.
 */
function variations(kit: PageKit, product: Product): string {
  if (product.family === null || product.variant === null) return "";
  const { css } = kit;
  const family = CATALOG.family(product.family);
  const current = product.variant;
  const colours = [...new Set(family.map((child) => child.variant?.colour ?? ""))];
  const capacities = [...new Set(family.map((child) => child.variant?.capacity ?? ""))];
  const childFor = (colour: string, capacity: string) => family.find((child) => child.variant?.colour === colour && child.variant.capacity === capacity);
  const swatches = colours.map((colour) => {
    const target = childFor(colour, current.capacity);
    if (!target) return "";
    const classes = [css.swatch, colour === current.colour ? css.swatchOn : "", target.available ? "" : css.swatchOff].filter(Boolean).join(" ");
    return `<li><div class="${classes}" title="${escapeHtml(target.available ? `Click to select ${colour}` : `${colour} - Currently unavailable`)}" data-href="${STORE_PATHS.product(target)}"><img src="${STORE_PATHS.image(target.sku)}" alt="" width="42" height="42"></div></li>`;
  }).join("");
  const tiles = capacities.map((capacity) => {
    const target = childFor(current.colour, capacity);
    if (!target) return "";
    const classes = [css.tile, capacity === current.capacity ? css.tileOn : ""].filter(Boolean).join(" ");
    return `<li><div class="${classes}" data-href="${STORE_PATHS.product(target)}"><span>${escapeHtml(capacity)}</span><span class="${css.tilePrice}">${target.available ? formatMoney(target.priceCents) : "Unavailable"}</span></div></li>`;
  }).join("");
  return `<div class="${css.variations}"><p class="${css.variationLabel}">Colour: <b>${escapeHtml(current.colour)}</b></p><ul class="${css.swatchList}">${swatches}</ul>
<p class="${css.variationLabel}">Capacity: <b>${escapeHtml(current.capacity)}</b></p><ul class="${css.tileList}">${tiles}</ul></div>`;
}

/** Every marketplace offer for the listing, in a side panel the buy box's link opens. */
function offersPanel(kit: PageKit, product: Product): string {
  const { css, ids } = kit;
  const offers = CATALOG.offersFor(product.sku);
  if (offers.length === 0) return "";
  const rows = offers.map((offer) => `<div class="${css.offerRow}"><div><p><b>${formatMoney(offer.priceCents)}</b> ${escapeHtml(offer.condition)}</p><p class="${css.soldBy}">Ships from and sold by ${escapeHtml(offer.seller)}</p></div><button type="button" class="${css.buttonSmall}" data-offer="${offer.offerId}">Add to Cart</button></div>`).join("");
  return `<div class="${css.sidePanel}" id="${ids.offers}" role="dialog" aria-label="All buying options" hidden><p><strong>Other sellers on Brightaisle</strong> <span class="${css.linkish}" data-action="close-offers">Close</span></p>${rows}</div>`;
}

/** "Frequently bought together": the kettle, a descaler and a tea sampler, with one button that adds all three. */
function boughtTogether(kit: PageKit, product: Product): string {
  if (product.kind !== "kettle" || product.family === null) return "";
  const { css } = kit;
  const bundle = [product, HOUSEHOLD.descaler, HOUSEHOLD.teaSampler];
  const total = bundle.reduce((sum, item) => sum + item.priceCents, 0);
  return `<section class="${css.fbt}" aria-labelledby="fbt-heading"><h2 id="fbt-heading">Frequently bought together</h2><div class="${css.fbtRow}">${bundle.map((item) => `<span>${escapeHtml(item.title.split(",")[0] ?? item.title)} (${formatMoney(item.priceCents)})</span>`).join(" + ")}</div>
<p>Total price: <b>${formatMoney(total)}</b></p><button type="button" class="${css.button}" data-bundle="${bundle.map((item) => item.sku).join(",")}">Add all three to Cart</button></section>`;
}

/**
 * A product page: gallery, title and rating, price, pickers, bullets, the
 * buy box, and everything a real listing stacks under it -- bundles, other
 * brands' sponsored products, the specifications, and reviews that stop after
 * three and ask the shopper to sign in again to read more.
 */
export function renderProductPage(kit: PageKit, product: Product): string {
  const { css } = kit;
  const savings = product.listPriceCents === null ? "" : `<span class="${css.savings}">-${Math.round((1 - product.priceCents / product.listPriceCents) * 100)}%</span>`;
  const listPrice = product.listPriceCents === null ? "" : `<p>List Price: <span class="${css.strike}">${formatMoney(product.listPriceCents)}</span></p>`;
  const related = product.kind === "kettle"
    ? `<section class="${css.related}" aria-label="Products related to this item"><h2>Products related to this item <span class="${css.adLabel}">Sponsored</span></h2><ul class="${css.carouselTrack}">${KETTLE_ADS.map((ad) => resultCard(css, ad.product, { kind: "carousel", ad })).join("")}</ul></section>`
    : "";
  const body = `<nav aria-label="Breadcrumb"><a href="${STORE_PATHS.home}">${product.kind === "kettle" ? "Home &amp; Kitchen" : "Electronics"}</a> &rsaquo; <a href="${STORE_PATHS.home}">${product.kind === "kettle" ? "Small Appliances" : "Headphones"}</a></nav>
<div class="${css.productLayout}" data-product="${product.sku}">
<div class="${css.gallery}"><img class="${css.galleryMain}" src="${STORE_PATHS.image(product.sku)}" alt="${escapeHtml(product.title)}"><div class="${css.thumbs}">${[1, 2, 3].map(() => `<img src="${STORE_PATHS.image(product.sku)}" alt="" width="48" height="48">`).join("")}</div></div>
<div class="${css.center}">
<a class="${css.byline}" href="${STORE_PATHS.home}#brand">Visit the ${escapeHtml(product.brand)} Store</a>
<h1 class="${css.productTitle}"><span>${escapeHtml(product.title)}</span></h1>
<p>${product.rating.toFixed(1)} out of 5 stars · <a href="#customer-reviews">${product.ratingCount.toLocaleString("en-US")} ratings</a>${product.kind === "kettle" ? ` <span class="${css.pick}">Brightaisle's Pick</span>` : ""}</p>
${product.bought === null ? "" : `<p class="${css.social}">${escapeHtml(product.bought)}</p>`}
<div class="${css.priceBlock}">${savings}<span class="${css.buyPrice}">${formatMoney(product.priceCents)}</span>${listPrice}<p>FREE Returns</p></div>
${variations(kit, product)}
<h2>About this item</h2><ul class="${css.bullets}">${(BULLETS[product.kind] ?? []).map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>
</div>
${buyBoxMarkup(kit, product)}
</div>
${boughtTogether(kit, product)}
${related}
<section class="${css.specs}"><h2>Product information</h2><table><tr><th>Brand</th><td>${escapeHtml(product.brand)}</td></tr><tr><th>Item number</th><td>${product.sku}</td></tr><tr><th>Date First Available</th><td>March 3, 2025</td></tr></table></section>
<section class="${css.reviewsBlock}" id="customer-reviews"><h2>Customer reviews</h2><p>${product.rating.toFixed(1)} out of 5 · ${product.ratingCount.toLocaleString("en-US")} global ratings</p>
<p><b>Does exactly what it should.</b> Boils fast, easy to pour, and the finish still looks new after months of daily use.</p>
<p><b>Good value.</b> Arrived a day early. Would buy again.</p>
<p><b>Solid.</b> A little loud when it reaches the boil but otherwise great.</p>
<div class="${css.loginWall}"><p>Sign in to read all ${product.ratingCount.toLocaleString("en-US")} reviews.</p><a class="${css.button}" href="${STORE_PATHS.home}#signin">Sign in</a></div></section>
${offersPanel(kit, product)}`;
  return storePage(kit, {
    title: `Brightaisle.com: ${product.title}`,
    body,
    script: productScript(kit.css, kit.ids, product.sku),
    autoOpenChat: true,
  });
}
