import { escapeHtml } from "../../../html.js";
import type { RenderContext } from "../../../types.js";
import { listingById, skuText } from "../catalog/index.js";
import { deliveryWindow, formatMoney } from "../locale/index.js";
import type { MarketState, Order } from "../state/index.js";
import type { MarketClasses } from "../styles/index.js";
import { MARKET_ROOT } from "./links.js";
import { marketDocument } from "./shell.js";

/**
 * The confirmation page for a paid order: its number, each line with its
 * options and quantity, and the amounts, the total last. An order the fraud
 * screen held has no confirmation page.
 */
export function renderOrderPage(state: MarketState, context: RenderContext, c: MarketClasses, order: Order): string {
  const region = order.region;
  const lines = order.lines.map((line) => {
    const listing = listingById(line.listingId)!;
    return `<div class="${c.orderLine}"><div><div>${escapeHtml(listing.title)}</div><div class="${c.stockNote}">${escapeHtml(skuText(line.choice))}</div></div><div>Qty <b>${line.quantity}</b></div></div>`;
  }).join("");
  const origin = order.lines[0]?.choice.origin ?? "China";
  const body = `<div class="${c.orderCard}">
<div class="${c.panelTitle}">Payment successful! Thank you for your order.</div>
<div class="${c.orderMeta}">Order ID: <span>${order.number}</span></div>
<div class="${c.orderMeta}">Order date: ${region === "US" ? "Sep 21, 2026" : "21 Sep 2026"}</div>
<div class="${c.orderMeta}">Estimated delivery: ${escapeHtml(deliveryWindow(origin, region))}</div>
${lines}
<div class="${c.summaryRow}"><span>Items total</span><span>${escapeHtml(formatMoney(order.totals.itemsCents, region))}</span></div>
<div class="${c.summaryRow}"><span>Store coupons</span><span>-${escapeHtml(formatMoney(order.totals.discountCents, region))}</span></div>
<div class="${c.summaryRow}"><span>Shipping</span><span>${order.totals.shippingCents === 0 ? "Free" : escapeHtml(formatMoney(order.totals.shippingCents, region))}</span></div>
<div class="${c.summaryTotal}"><span>Total paid</span><span>${escapeHtml(formatMoney(order.totals.totalCents, region))}</span></div>
<p><a class="${c.btn}" href="${MARKET_ROOT}">Continue shopping</a> <span class="${c.linkish}">View order details</span></p>
</div>`;
  return marketDocument({ state, context, c, kind: "order", title: "Order placed - Farbazaar", body, pageScript: "" });
}
