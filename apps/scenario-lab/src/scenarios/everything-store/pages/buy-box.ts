import { escapeHtml } from "../../../html.js";
import { CATALOG, DELIVERY_DATES, HOUSEHOLD, formatMoney, type Product } from "../catalog/index.js";
import { ACCOUNT } from "../state/index.js";
import type { PageKit } from "./page-kit.js";

/** How many a shopper may pick: what is left when stock is low, otherwise the store's cap. */
function quantityCap(product: Product): number {
  const low = /Only (\d+) left/u.exec(product.stock);
  return low ? Number(low[1]) : 10;
}

/**
 * The buy box. Its controls are ordinary buttons that the page's script
 * attaches to a little after load; clicked before then, they do nothing at
 * all. A protection plan is offered, unticked. Other sellers of the same
 * listing, all cheaper, are one link away.
 */
export function buyBoxMarkup(kit: PageKit, product: Product): string {
  const { css, ids } = kit;
  const offers = CATALOG.offersFor(product.sku);
  const cheapest = offers.reduce<number | null>((low, offer) => low === null || offer.priceCents < low ? offer.priceCents : low, null);
  const otherSellers = offers.length === 0 ? "" : `<div class="${css.otherSellers}"><span class="${css.linkish}" data-action="other-sellers">Other sellers on Brightaisle</span><br>New &amp; Used (${offers.length}) from ${formatMoney(cheapest ?? 0)} &amp; FREE Shipping</div>`;
  if (!product.available) {
    return `<div class="${css.buyBox}"><p class="${css.stockLow}">Currently unavailable.</p><p>We don't know when or if this item will be back in stock.</p>${otherSellers}</div>`;
  }
  const quantities = Array.from({ length: quantityCap(product) }, (_, index) => `<option value="${index + 1}">${index + 1}</option>`).join("");
  const stockClass = product.stock.startsWith("Only") ? css.stockLow : css.stock;
  const delivery = product.plus
    ? `<p><i class="${css.plusBadge}" role="img" aria-label="Brightaisle Plus"></i> FREE delivery <b>${DELIVERY_DATES.standard.long}</b>. Order within <b>5 hrs 12 mins</b>.</p><p>Or fastest delivery <b>Tomorrow, ${DELIVERY_DATES.oneDay.long.split(", ")[1]}</b></p>`
    : `<p>${formatMoney(649)} delivery <b>${DELIVERY_DATES.economy.long}</b></p>`;
  const protection = product.kind === "kettle"
    ? `<div class="${css.protection}"><p><strong>Add a Protection Plan:</strong></p><input type="checkbox" id="${ids.protection}"> <label for="${ids.protection}">2-Year Protection Plan for <b>${formatMoney(HOUSEHOLD.protectionPlan.priceCents)}</b></label></div>`
    : "";
  return `<div class="${css.buyBox}" data-buy-box data-sku="${product.sku}">
<p class="${css.buyPrice}">${formatMoney(product.priceCents)}</p>
${delivery}
<p><span class="${css.linkish}" data-action="deliver-to">Deliver to ${escapeHtml(ACCOUNT.firstName)} - ${escapeHtml(ACCOUNT.deliverTo)}</span></p>
<p class="${stockClass}">${escapeHtml(product.stock)}</p>
<label for="${ids.qty}">Quantity:</label> <select id="${ids.qty}" name="quantity">${quantities}</select>
${protection}
<button type="button" class="${css.addButton}">Add to Cart</button>
<button type="button" class="${css.buyNowButton}">Buy Now</button>
<p class="${css.soldBy}">Ships from <b>Brightaisle</b><br>Sold by <b>${escapeHtml(product.seller)}</b><br>Returns: Returnable until Jan 31, 2027</p>
<button type="button" class="${css.button}" data-action="add-to-list">Add to List</button>
${otherSellers}
</div>`;
}
