import { escapeHtml } from "../../../html.js";
import type { RenderContext } from "../../../types.js";
import { listingById, skuText, storeById } from "../catalog/index.js";
import { checkoutScript } from "../client/index.js";
import { deliveryWindow, formatMoney, type RegionCode } from "../locale/index.js";
import { EXPRESS_CENTS, linesByStore, lineUnitCents, PAYMENT_METHODS, sessionTotals, storeDiscountCents, type CartLine, type MarketState } from "../state/index.js";
import type { MarketClasses } from "../styles/index.js";
import { MARKET_ROOT } from "./links.js";
import { marketDocument } from "./shell.js";

/**
 * The checkout. The saved address is already filled in; each store's lines
 * carry a shipping choice (a native select, standard by default) and, when the
 * store has one, the store coupon's state. The payment methods live in a
 * separate framed document from the payment provider (`checkout/payment`), so
 * nothing on this page names the card until one is chosen in the frame.
 *
 * Under the note to the seller sits the fraud screen's honeypot: a fax field
 * no person can see. A submission that fills it is held for review rather
 * than placed.
 */
export function renderCheckoutPage(state: MarketState, context: RenderContext, c: MarketClasses): string {
  const session = state.checkout;
  if (!session) {
    const body = `<div class="${c.panel}" style="text-align:center;padding:48px"><div class="${c.panelTitle}">Your checkout session has expired</div><p>Go back to your cart and check out again.</p><a class="${c.btn} ${c.btnPrimary}" href="${MARKET_ROOT}cart">Back to cart</a></div>`;
    return marketDocument({ state, context, c, kind: "checkout", title: "Checkout - Farbazaar", body, pageScript: "" });
  }
  const region = state.region;
  const totals = sessionTotals(session.lines, session.shipping, state.coupons.stores);
  const stores = linesByStore(session.lines).map((group) => storePanel(state, c, group.storeId, group.lines)).join("");
  const payment = session.paymentId === null ? "Not selected" : PAYMENT_METHODS[session.paymentId as keyof typeof PAYMENT_METHODS].label;
  const body = `<div class="${c.checkoutLayout}">
<div>
<div class="${c.panel}"><div class="${c.panelTitle}">Shipping address</div><div class="${c.addressCard}"><b>Mara Lindqvist</b> +49 151 23456789<br>Karl-Heine-Straße 41, 04229 Leipzig, Sachsen, Germany <span class="${c.linkish}">Change</span></div></div>
${stores}
<div class="${c.panel}"><div class="${c.panelTitle}">Payment methods</div><iframe class="${c.payFrame}" title="Payment methods" src="${MARKET_ROOT}checkout/payment"></iframe></div>
</div>
<div class="${c.cartSummary}">
<div class="${c.panelTitle}">Summary</div>
<div class="${c.summaryRow}"><span>Items total</span><span>${escapeHtml(formatMoney(totals.itemsCents, region))}</span></div>
<div class="${c.summaryRow}"><span>Store coupons</span><span>-${escapeHtml(formatMoney(totals.discountCents, region))}</span></div>
<div class="${c.summaryRow}"><span>Shipping</span><span>${totals.shippingCents === 0 ? "Free" : escapeHtml(formatMoney(totals.shippingCents, region))}</span></div>
<div class="${c.summaryRow}"><span>Pay with</span><span>${escapeHtml(payment)}</span></div>
<div class="${c.summaryTotal}"><span>Total</span><span>${escapeHtml(formatMoney(totals.totalCents, region))}</span></div>
<div class="${c.placeOrder}">Place order</div>
<div class="${c.errorTip}"></div>
<div class="${c.stockNote}">By placing your order you agree to Farbazaar's Terms of Use and Transaction Services Agreement. Upon clicking "Place order", your card will be charged.</div>
</div>
</div>`;
  const pageData = { paymentChosen: session.paymentId !== null, storeIds: linesByStore(session.lines).map((group) => group.storeId) };
  return marketDocument({ state, context, c, kind: "checkout", title: "Checkout - Farbazaar", body, pageScript: `const pageData = ${JSON.stringify(pageData)};\n${checkoutScript()}` });
}

function storePanel(state: MarketState, c: MarketClasses, storeId: string, lines: readonly CartLine[]): string {
  const region = state.region;
  const store = storeById(storeId);
  const method = state.checkout?.shipping[storeId] ?? "standard";
  const storeItems = lines.reduce((sum, line) => sum + lineUnitCents(line) * line.quantity, 0);
  const origin = lines[0]?.choice.origin ?? "China";
  return `<div class="${c.panel}"><div class="${c.panelTitle}">${escapeHtml(store.name)}</div>
${lines.map((line) => {
    const listing = listingById(line.listingId)!;
    return `<div class="${c.orderLine}"><div><div>${escapeHtml(listing.title)}</div><div class="${c.stockNote}">${escapeHtml(skuText(line.choice))}</div></div><div>${escapeHtml(formatMoney(lineUnitCents(line), region))} × ${line.quantity}</div></div>`;
  }).join("")}
<div class="${c.summaryRow}"><span>Shipping</span><select class="${c.shipSelect}"><option value="standard"${method === "standard" ? " selected" : ""}>Standard Shipping · Free · Delivery ${escapeHtml(deliveryWindow(origin, region))}</option><option value="express"${method === "express" ? " selected" : ""}>Express Shipping · +${escapeHtml(formatMoney(EXPRESS_CENTS, region))} · Delivery ${escapeHtml(expressWindow(region))}</option></select></div>
${couponRow(state, c, storeId, storeItems)}
<textarea class="${c.noteBox}" placeholder="Note to seller (optional)" maxlength="512"></textarea>
<div class="${c.trap}"><input type="text" name="fax_number" autocomplete="off" tabindex="-1" placeholder="Fax"></div>
</div>`;
}

function couponRow(state: MarketState, c: MarketClasses, storeId: string, storeItems: number): string {
  const coupon = storeById(storeId).coupon;
  if (!coupon) return "";
  const region = state.region;
  if (!state.coupons.stores.includes(storeId)) return `<div class="${c.summaryRow}"><span>Store coupon</span><span class="${c.linkish}">Get store coupon</span></div>`;
  const discount = storeDiscountCents(storeId, storeItems, state.coupons.stores);
  return discount > 0
    ? `<div class="${c.summaryRow}"><span>Store coupon</span><span>-${escapeHtml(formatMoney(discount, region))}</span></div>`
    : `<div class="${c.summaryRow}"><span>Store coupon</span><span>Spend ${escapeHtml(formatMoney(coupon.minimumCents, region))} to use it</span></div>`;
}

function expressWindow(region: RegionCode): string {
  return region === "US" ? "Sep 23 – 24" : "23 – 24 Sep";
}
