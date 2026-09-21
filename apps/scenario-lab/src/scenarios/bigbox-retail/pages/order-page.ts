import { escapeHtml } from "../../../html.js";
import type { RenderContext } from "../../../types.js";
import { formatMoney, storeById } from "../catalog/index.js";
import { describeLine, pickupSlots, slotText } from "../cart/index.js";
import type { BigboxState, PlacedOrder } from "../types.js";
import { productHref } from "../listing/index.js";
import { renderShell } from "../shell/index.js";

/**
 * An order's confirmation: its number, where and when to collect it, what was
 * in it, and what it cost. The quantity is printed apart from its label, and
 * the pickup window apart from its, so each can be read on its own.
 */
export function renderOrderPage(state: BigboxState, context: RenderContext, order: PlacedOrder): string {
  const store = storeById(order.storeId);
  const slot = pickupSlots(order.storeId).find((candidate) => candidate.id === order.slotId);
  const total = order.subtotalCents + order.taxCents;
  return renderShell({
    state, context, kind: "order", title: `Order ${order.number}`,
    main: (c) => {
      const items = order.lines.map(describeLine).filter((view) => view !== undefined).map((view) => `<li class="${c.orderItem}"><a href="${productHref(view.product, view.variant.sku)}">${escapeHtml(view.title)}</a><span><span>Qty</span> <span>${view.line.qty}</span></span><span>${formatMoney(view.totalCents)}</span></li>`).join("");
      const pickup = slot === undefined ? "" : `<div class="${c.pickupBox}"><h2>Pickup</h2><p>${escapeHtml(store.name)}</p><p>${escapeHtml(store.address)}</p><p>Pickup window: <span>${escapeHtml(slotText(slot))}</span></p><p>Bring a photo ID. We'll text you when it's ready.</p></div>`;
      const paid = order.payment === "pickup" ? `You'll pay ${formatMoney(total)} when you pick up your order.` : "Your card will be charged when your order is ready.";
      return `<section class="${c.confirm}"><h1 class="${c.confirmHead}">Thanks for your order, ${escapeHtml(order.firstName)}!</h1><p>Order# <span class="${c.orderNumber}">${order.number}</span></p>${pickup}<ul class="${c.orderItems}">${items}</ul><dl class="${c.totals}"><dt>Subtotal</dt><dd>${formatMoney(order.subtotalCents)}</dd><dt>Estimated tax</dt><dd>${formatMoney(order.taxCents)}</dd><dt>Total</dt><dd>${formatMoney(total)}</dd></dl><p>${escapeHtml(paid)}</p></section>`;
    },
  });
}
