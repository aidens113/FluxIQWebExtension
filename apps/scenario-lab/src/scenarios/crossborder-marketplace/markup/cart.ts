import { escapeHtml } from "../../../html.js";
import type { RenderContext } from "../../../types.js";
import { listingById, skuText, storeById } from "../catalog/index.js";
import { cartScript } from "../client/index.js";
import { formatMoney } from "../locale/index.js";
import { linesByStore, lineUnitCents, type MarketState } from "../state/index.js";
import type { MarketClasses } from "../styles/index.js";
import { itemHref, MARKET_ROOT } from "./links.js";
import { marketDocument } from "./shell.js";

/**
 * The cart: lines grouped by store, each with a round tick, its options, its
 * price and a quantity stepper, and a summary that checks out the ticked
 * lines. Every line starts ticked.
 */
export function renderCartPage(state: MarketState, context: RenderContext, c: MarketClasses): string {
  const groups = linesByStore(state.cart);
  const subtotal = state.cart.reduce((sum, line) => sum + lineUnitCents(line) * line.quantity, 0);
  const lines = groups.map((group) => `<div class="${c.cartStore}"><b>${escapeHtml(storeById(group.storeId).name)}</b>${group.lines.map((line) => {
    const listing = listingById(line.listingId)!;
    return `<div class="${c.cartLine}"><div class="${c.cartCheck}" style="background:#e62e04;border-color:#e62e04"></div><img src="${MARKET_ROOT}img/${listing.id}.svg" alt="" width="80" height="80"><div><a href="${itemHref(listing.id)}">${escapeHtml(listing.title)}</a><div class="${c.stockNote}">${escapeHtml(skuText(line.choice))}</div></div><div><b>${escapeHtml(formatMoney(lineUnitCents(line), state.region))}</b></div><div class="${c.qtyRow}"><div class="${c.qtyButton}">−</div><span>${line.quantity}</span><div class="${c.qtyButton}">+</div><span title="Remove" style="cursor:pointer;margin-left:8px">🗑</span></div></div>`;
  }).join("")}</div>`).join("");
  const body = state.cart.length === 0
    ? `<div class="${c.panel}" style="text-align:center;padding:48px"><div class="${c.panelTitle}">Your cart is empty</div><p>Browse today's deals and add something you like.</p><a class="${c.btn} ${c.btnPrimary}" href="${MARKET_ROOT}">Start shopping</a></div>`
    : `<div class="${c.cartLayout}"><div><div class="${c.panelTitle}">Cart (${state.cart.reduce((sum, line) => sum + line.quantity, 0)})</div>${lines}</div><div class="${c.cartSummary}"><div class="${c.panelTitle}">Summary</div><div class="${c.summaryRow}"><span>Subtotal</span><span>${escapeHtml(formatMoney(subtotal, state.region))}</span></div><div class="${c.stockNote}">Store coupons and shipping are applied at checkout.</div><div class="${c.placeOrder}">Checkout (${state.cart.length})</div></div></div>`;
  const pageData = { lines: state.cart.map((line) => ({ id: line.id, quantity: line.quantity })) };
  return marketDocument({ state, context, c, kind: "cart", title: "Shopping Cart - Farbazaar", body, pageScript: `const pageData = ${JSON.stringify(pageData)};\n${cartScript()}` });
}
