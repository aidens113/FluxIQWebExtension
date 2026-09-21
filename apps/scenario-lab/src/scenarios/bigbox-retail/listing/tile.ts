import { escapeHtml } from "../../../html.js";
import { defaultFulfilment, formatMoney, fulfilmentLines, SITE_ROOT, variantTitle } from "../catalog/index.js";
import type { Product, TileDefault } from "../types.js";
import { priceMarkup } from "./price-markup.js";
import { IMAGE_PLACEHOLDER, productHref } from "./product-href.js";
import { ratingMarkup } from "./rating-markup.js";
import type { BigboxClasses } from "../theme/index.js";

export type TileKind = "grid" | "row" | "rail";

/**
 * One product listing, in the grid of a results page, as a row of the list
 * experiment, or in a rail of recommendations. Every one of them carries the
 * same "+ Add" or "Options" control as every other, and an ad is the same
 * listing with a small grey label: "Sponsored" in the grid, an "Ad" pill in a
 * row. The whole grid tile is a link; the image and title are not, on their own.
 */
export function listingMarkup(product: Product, storeId: string, c: BigboxClasses, kind: TileKind, sponsored = false): string {
  const variant = product.variants[0]!;
  const title = escapeHtml(variantTitle(product, variant));
  const href = productHref(product);
  const image = `<img class="${c.img}" src="${IMAGE_PLACEHOLDER}" data-src="${SITE_ROOT}img/${product.id}.svg" alt="${title}" width="160" height="160">`;
  const lines = fulfilmentLines(variant, storeId);
  const action = product.variants.length > 1 ? `<a class="${c.optionsButton}" href="${href}">Options</a>` : `<button type="button" class="${c.addButton}">+ Add</button>`;
  const badges = `${product.badge ? `<span class="${c.badge}">${product.badge}</span>` : ""}${variant.wasCents === undefined ? "" : `<span class="${c.badgeRollback}">Rollback</span>`}`;
  if (kind === "row") {
    const was = variant.wasCents === undefined ? "" : `<div class="${c.priceWas}">was <s>${formatMoney(variant.wasCents)}</s></div>`;
    const unit = variant.unit === "" ? "" : `<div class="${c.unitPrice}">${escapeHtml(variant.unit)}</div>`;
    const price = `<div class="${c.rowPrice}">${formatMoney(variant.priceCents)}</div>${was}${unit}`;
    return `<li class="${c.row}" data-item-id="${product.id}"><a class="${c.rowMedia}" href="${href}">${image}</a><div class="${c.rowMain}"><a class="${c.rowTitle}" href="${href}">${title}</a>${badges}${ratingMarkup(product, c)}<div class="${c.rowFulfil}">${escapeHtml(lines.join(" · "))}</div></div><div class="${c.rowBuy}">${sponsored ? `<span class="${c.adPill}">Ad</span>` : ""}${price}${action}</div></li>`;
  }
  const fulfil = `<div class="${c.fulfil}">${(kind === "rail" ? lines.slice(0, 1) : lines).map((line) => `<div class="${c.fulfilLine}">${escapeHtml(line)}</div>`).join("")}</div>`;
  const body = `<a class="${c.tileLink}" href="${href}"><span class="${c.srOnly}">${title}</span></a><div class="${c.tileImage}">${image}</div>${priceMarkup(variant, c)}<span class="${c.tileTitle}">${title}</span>${ratingMarkup(product, c)}${fulfil}${action}`;
  if (kind === "rail") return `<li class="${c.railItem}">${body}</li>`;
  return `<div class="${c.tile}" data-item-id="${product.id}">${sponsored ? `<div class="${c.sponsoredTag}">Sponsored</div>` : ""}${badges}${body}</div>`;
}

/** What each single-size listing's quick-add adds at the shopper's store; a product in several sizes has Options instead. */
export function tileDefaultsFor(products: readonly Product[], storeId: string): Record<string, TileDefault> {
  return Object.fromEntries(products.flatMap((product) => {
    const variant = product.variants[0]!;
    const fulfilment = defaultFulfilment(variant, storeId);
    return product.variants.length === 1 && fulfilment ? [[product.id, { sku: variant.sku, fulfilment }]] : [];
  }));
}
