import { escapeHtml } from "../../../html.js";
import { listingById, skuText, storeById } from "../catalog/index.js";
import { formatMoney } from "../locale/index.js";
import type { MarketState } from "../state/index.js";
import type { MarketClasses } from "../styles/index.js";

/**
 * The two header flyouts: the cart, and the account. They are rendered on
 * every page, hidden until hovered, and the page refreshes them in place after
 * anything that changes them -- so they are the one place a run's cart and
 * coupons can be read from whichever page it ends on. The cart icon's number
 * is not refreshed with them (`client/shell-script.ts`), which is the live
 * site's bug and not this markup's.
 *
 * Each cart line is one line of text with its parts separated by " · ", in
 * the order a buyer checks them: who sells it, what it is, which options,
 * how many.
 */
export function miniCartMarkup(state: MarketState, c: MarketClasses): string {
  const pieces = state.cart.reduce((sum, line) => sum + line.quantity, 0);
  const lines = state.cart.map((line) => `<li class="${c.flyoutLine}" data-testid="mini-cart-line">${escapeHtml(miniCartLineText(line.listingId, line.choice, line.quantity))}</li>`).join("");
  const body = state.cart.length === 0 ? `<p class="${c.flyoutEmpty}">Your cart is empty. Start shopping!</p>` : `<ul style="padding:0;margin:0">${lines}</ul>`;
  return `<div class="${c.flyout}"><p class="${c.flyoutTitle}" data-testid="mini-cart-count">Cart (${pieces})</p>${body}<p><a class="${c.linkish}" href="/scenarios/crossborder-marketplace/cart">View cart</a></p></div>`;
}

export function miniCartLineText(listingId: string, choice: Parameters<typeof skuText>[0], quantity: number): string {
  const listing = listingById(listingId);
  if (!listing) return "";
  return `${storeById(listing.storeId).name} · ${listing.title} · ${skuText(choice)} · × ${quantity}`;
}

/** What the account flyout says about store coupons: each held coupon, or that there are none. */
export function storeCouponsText(state: MarketState): string {
  if (state.coupons.stores.length === 0) return "Store coupons: none collected";
  const held = state.coupons.stores.map((storeId) => {
    const store = storeById(storeId);
    const coupon = store.coupon!;
    return `${store.name} ${formatMoney(coupon.offCents, state.region)} off orders over ${formatMoney(coupon.minimumCents, state.region)}`;
  });
  return `Store coupons: ${held.join("; ")}`;
}

/** Paid orders only: an order held for review has not been paid for and is not on its way. */
export function ordersSummaryText(state: MarketState): string {
  return `Orders to be shipped (${state.orders.filter((order) => order.status === "paid").length})`;
}

export function accountFlyoutMarkup(state: MarketState, c: MarketClasses): string {
  const platform = state.coupons.platform ? `Farbazaar coupons: ${formatMoney(300, state.region)} off over ${formatMoney(4000, state.region)}; ${formatMoney(500, state.region)} off over ${formatMoney(6000, state.region)}` : "Farbazaar coupons: none collected";
  return `<div class="${c.flyout}"><p class="${c.flyoutTitle}">Mara Lindqvist</p>`
    + `<p class="${c.flyoutLine}" data-testid="orders-summary">${escapeHtml(ordersSummaryText(state))}</p>`
    + `<p class="${c.flyoutLine}" data-testid="store-coupons">${escapeHtml(storeCouponsText(state))}</p>`
    + `<p class="${c.flyoutLine}">${escapeHtml(platform)}</p>`
    + `<p class="${c.flyoutLine}">Wish list (7) · Followed stores (3) · Feedback (2)</p></div>`;
}
