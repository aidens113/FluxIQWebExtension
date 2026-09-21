import { escapeHtml } from "../../../../html.js";
import { CATALOG, STORE_PATHS, formatMoney } from "../../catalog/index.js";
import { linePrice, type CartLine } from "../../state/index.js";
import type { PageKit } from "../page-kit.js";
import { cartSubtotalText } from "./subtotal.js";

const TRASH = `<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 4h10M5 4V2h4v2M3 4l1 9h6l1-9" fill="none" stroke="#111" stroke-width="1.3"/></svg>`;

function sellerOf(line: CartLine): string {
  return line.offerId === null ? CATALOG.bySku(line.sku)?.seller ?? "Brightaisle" : CATALOG.offer(line.offerId)?.seller ?? "";
}

/**
 * One cart line. The quantity stepper's buttons are `span`s with a label and
 * no role; at a quantity of one, the minus becomes a bin that deletes the
 * line. Delete, Save for later, Compare and Share are `span`s too.
 */
function row(kit: PageKit, line: CartLine): string {
  const { css } = kit;
  const product = CATALOG.bySku(line.sku);
  if (!product) return "";
  const unit = linePrice(line.sku, line.offerId) ?? product.priceCents;
  const title = escapeHtml(product.title);
  const variant = product.variant === null ? "" : `<ul class="${css.variationLine}"><li><span>Colour:</span> <span>${escapeHtml(product.variant.colour)}</span></li><li><span>Capacity:</span> <span>${escapeHtml(product.variant.capacity)}</span></li></ul>`;
  const offer = line.offerId === null ? undefined : CATALOG.offer(line.offerId);
  const decrease = line.quantity === 1
    ? `<span class="${css.qtyButton}" data-act="dec" aria-label="Delete">${TRASH}</span>`
    : `<span class="${css.qtyButton}" data-act="dec" aria-label="Decrease quantity by one">&minus;</span>`;
  return `<div class="${css.cartRow}" data-line="${line.lineId}" data-sku="${line.sku}">
<input class="${css.cartCheck}" type="checkbox"${line.selected ? " checked" : ""} aria-label="Select ${title}">
<img src="${STORE_PATHS.image(line.sku)}" alt="" width="110" height="110">
<div><a class="${css.cartTitle}" href="${STORE_PATHS.product(product)}"><span>${title}</span></a>
<p class="${product.stock.startsWith("Only") ? css.stockLow : css.stock}">${escapeHtml(product.stock)}</p>
${product.plus && offer === undefined ? `<p><i class="${css.plusBadge}" role="img" aria-label="Brightaisle Plus"></i> FREE Returns</p>` : ""}
${offer ? `<p class="${css.soldBy}">${escapeHtml(offer.condition)}</p>` : ""}${variant}<p class="${css.soldBy}">Sold by ${escapeHtml(sellerOf(line))}</p>
<div class="${css.cartActions}"><span class="${css.qtyControl}">${decrease}<span class="${css.qtyValue}" aria-live="polite">${line.quantity}</span><span class="${css.qtyButton}" data-act="inc" aria-label="Increase quantity by one">+</span></span>
<span class="${css.linkish}" data-action="delete" tabindex="0">Delete</span> | <span class="${css.linkish}" data-action="save-for-later" tabindex="0">Save for later</span> | <span class="${css.linkish}" data-action="compare" tabindex="0">Compare with similar items</span> | <span class="${css.linkish}" data-action="share" tabindex="0">Share</span></div></div>
<p class="${css.rowPrice}"><span>${formatMoney(unit)}</span></p>
</div>`;
}

/**
 * The cart's active lines, its subtotal, and Saved for later -- the part of
 * the page its script re-renders after every change, served on its own as
 * `cart?part=main`. The saved items carry the same line attributes as the
 * active ones; only the section they sit in says which is which.
 */
export function cartMainMarkup(kit: PageKit): string {
  const { css, state } = kit;
  const allSelected = state.cart.length > 0 && state.cart.every((line) => line.selected);
  const saved = state.saved.map((line) => {
    const product = CATALOG.bySku(line.sku);
    if (!product) return "";
    return `<div class="${css.savedItem}" data-line="${line.lineId}" data-sku="${line.sku}"><a href="${STORE_PATHS.product(product)}"><img src="${STORE_PATHS.image(line.sku)}" alt="" width="90" height="90"><span>${escapeHtml(product.title)}</span></a><p>${formatMoney(product.priceCents)}</p><span class="${css.linkish}" data-action="move-to-cart" tabindex="0">Move to cart</span> <span class="${css.linkish}" data-action="delete" tabindex="0">Delete</span></div>`;
  }).join("");
  const active = state.cart.length === 0
    ? `<p>Your Brightaisle Cart is empty.</p>`
    : state.cart.map((line) => row(kit, line)).join("");
  return `<div class="${css.cartMain}" data-name="Active Items">
<h1>Shopping Cart</h1>
${state.cart.length === 0 ? "" : `<span class="${css.linkish}" data-action="${allSelected ? "deselect-all" : "select-all"}" tabindex="0">${allSelected ? "Deselect all items" : "Select all items"}</span>`}
<p style="text-align:right">Price</p>
${active}
<p class="${css.subtotal}" data-testid="cart-subtotal">${cartSubtotalText(state)}</p>
</div>
<section class="${css.cartMain}" data-name="Saved Cart Items" aria-labelledby="saved-heading"><h2 id="saved-heading">Saved for later (${state.saved.length} ${state.saved.length === 1 ? "item" : "items"})</h2><div class="${css.savedGrid}">${saved}</div></section>`;
}
