import { escapeHtml } from "../../../html.js";
import type { RenderContext } from "../../../types.js";
import { defaultFulfilment, formatMoney, PRODUCTS, SITE_ROOT, speedOf, storeById, variantTitle } from "../catalog/index.js";
import { productScript, type ProductVariantView } from "../client/index.js";
import type { BigboxState, Fulfilment, Product, Variant } from "../types.js";
import { priceMarkup } from "../listing/index.js";
import { IMAGE_PLACEHOLDER } from "../listing/index.js";
import { ratingMarkup } from "../listing/index.js";
import { renderShell } from "../shell/index.js";
import type { BigboxClasses } from "../theme/index.js";
import { listingMarkup, tileDefaultsFor } from "../listing/index.js";

const METHODS: readonly Fulfilment[] = ["pickup", "delivery", "shipping"];
const sellerSlug = (seller: string) => seller.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/-$/u, "");

function optionText(variant: Variant, storeId: string, method: Fulfilment): string {
  const speed = speedOf(variant, storeId, method);
  if (speed === "none") return "Not available";
  if (speed === "ships") return `Arrives ${variant.shipping}`;
  return speed === "today" ? "Today" : "Tomorrow";
}

/** What the page script needs to redraw the buy box for each size without asking the server. */
function variantViews(product: Product, storeId: string, c: BigboxClasses): ProductVariantView[] {
  return product.variants.map((variant) => ({
    sku: variant.sku,
    label: variant.label,
    title: variantTitle(product, variant),
    priceHtml: priceMarkup(variant, c),
    price: formatMoney(variant.priceCents),
    options: METHODS.map((method) => ({ method, text: optionText(variant, storeId, method), available: speedOf(variant, storeId, method) !== "none" })),
    preferred: defaultFulfilment(variant, storeId) ?? "shipping",
  }));
}

/**
 * A product page. The size swatches, the fulfilment choices and the quantity
 * stepper are all plain elements with click handlers, not form controls. The
 * buy box answers "checking availability" for a moment after load before the
 * choices appear. Add to cart lives in a bar pinned to the bottom of the
 * window -- under the support widget's card once that opens -- except in the
 * redesign, where it moved up into the buy box and Buy now took the bar.
 */
export function renderProductPage(state: BigboxState, context: RenderContext, product: Product, variant: Variant): string {
  const store = storeById(state.storeId);
  const similar = PRODUCTS.filter((candidate) => candidate.department === product.department && candidate.id !== product.id).slice(0, 5);
  const redesigned = state.mode === "redesigned-buy-box";
  const title = variantTitle(product, variant);
  return renderShell({
    state, context, kind: "product", title,
    tileDefaults: tileDefaultsFor(similar, state.storeId),
    main: (c) => {
      const views = variantViews(product, state.storeId, c);
      const view = views.find((candidate) => candidate.sku === variant.sku)!;
      const swatches = product.variants.length < 2 ? "" : `<div class="${c.variantLabel}">Size: <b>${escapeHtml(variant.label)}</b></div><div class="${c.swatches}">${product.variants.map((option) => `<div class="${c.swatch}${option.sku === variant.sku ? ` ${c.swatchOn}` : ""}" tabindex="0">${escapeHtml(option.label)}<span class="${c.swatchPrice}">${formatMoney(option.priceCents)}</span></div>`).join("")}</div>`;
      const options = view.options.map((option) => `<div class="${c.fulfilOption}${option.available ? (option.method === view.preferred ? ` ${c.fulfilOptionOn}` : "") : ` ${c.fulfilOptionOff}`}" tabindex="0"><strong>${option.method === "pickup" ? "Pickup" : option.method === "delivery" ? "Delivery" : "Shipping"}</strong><div>${escapeHtml(option.text)}</div></div>`).join("");
      const addHere = redesigned ? `<button type="button" class="${c.btn} ${c.btnSecondary}">Add to cart</button>` : "";
      const bar = redesigned
        ? `<div class="${c.atcBar}"><span class="${c.atcBarTitle}">${escapeHtml(title)} · ${view.price}</span><button type="button" class="${c.buyNowButton}">Buy now</button></div>`
        : `<div class="${c.atcBar}"><span class="${c.atcBarTitle}">${escapeHtml(title)} · ${view.price}</span><button type="button" class="${c.atcButton}" data-testid="atc">Add to cart</button></div>`;
      const badges = `${product.badge ? `<span class="${c.badge}">${product.badge}</span>` : ""}${variant.wasCents === undefined ? "" : `<span class="${c.badgeRollback}">Rollback</span>`}`;
      return `<nav class="${c.breadcrumb}" aria-label="Breadcrumb">Household Essentials / Paper &amp; Plastic / ${escapeHtml(product.department)}</nav>
<div class="${c.pdpLayout}"><div class="${c.gallery}"><img class="${c.img}" src="${IMAGE_PLACEHOLDER}" data-src="${SITE_ROOT}img/${product.id}.svg" alt="${escapeHtml(product.name)}" width="320" height="320"></div>
<div class="${c.buyBox}">${badges}<a href="#">Visit the ${escapeHtml(product.brand)} Store</a><h1 class="${c.pdpTitle}">${escapeHtml(title)}</h1>${ratingMarkup(product, c)}
<div class="${c.pdpPrice}">${view.priceHtml}</div><small>Price when purchased online</small>
<p class="${c.sellerLine}">Sold and shipped by <a href="${SITE_ROOT}seller/${sellerSlug(product.seller)}" target="_blank" rel="noopener">${escapeHtml(product.seller)}</a></p>
${swatches}<div class="${c.skeleton}">Checking availability at ${escapeHtml(store.name)}&hellip;</div>
<div class="${c.buyBoxLive}" hidden><p>How you'll get this item:</p><div class="${c.fulfilOptions}">${options}</div>
<p class="${c.storeLine}">Pickup at <b>${escapeHtml(store.name)}</b> · <a href="#" class="${c.btnLink}">Change store</a></p>
<div class="${c.qtyStepper}"><span class="${c.qtyControl}">&minus;</span><span class="${c.qtyValue}">1</span><span class="${c.qtyControl}">+</span></div>${addHere}
<p class="${c.listLinks}"><a href="#">Add to list</a> · <a href="#">Add to registry</a></p></div></div></div>
<section class="${c.about}"><h2>About this item</h2><ul>${product.about.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
<table class="${c.specs}"><tbody><tr><th scope="row">Brand</th><td>${escapeHtml(product.brand)}</td></tr><tr><th scope="row">Seller</th><td>${escapeHtml(product.seller)}</td></tr><tr><th scope="row">Item number</th><td>${product.id}</td></tr></tbody></table></section>
<section class="${c.reviews}"><h2>Customer reviews</h2><div></div><button type="button" class="${c.btn} ${c.btnQuiet} ${c.moreReviews}">See more reviews</button></section>
<section class="${c.rail}"><div class="${c.railHead}"><h2>Similar items you might like</h2></div><ul class="${c.railList}">${similar.map((item) => listingMarkup(item, state.storeId, c, "rail")).join("")}</ul></section>
${bar}`;
    },
    script: (c) => productScript({ classes: c, productId: product.id, views: variantViews(product, state.storeId, c), selectedSku: variant.sku, redesigned }),
  });
}
