import { escapeHtml } from "../../html.js";
import { formatMoney, formatPlaced, lineTotalPence, ORDER_OPERATIONS_ROOT, orderTotalPence, refundedText } from "./format.js";
import { isDispatchable, isRefundable } from "./ledger.js";
import type { OrderClasses } from "./styles.js";
import type { CustomerOrder } from "./types.js";

/**
 * One order's own page.
 *
 * It holds what the book does not: the lines that make the total up, the
 * delivery address, and the refund control. Nothing here is reachable from the
 * list, so a run that needs a line's value has to open the order; and the
 * refund control is disabled until an amount above zero and a reason are
 * given, so pressing it without composing a refund presses a control that
 * cannot fire.
 */

/** Why a refund was given, as the reason control lists them. */
export const REFUND_REASONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "goodwill", label: "Goodwill" },
  { value: "damaged-on-arrival", label: "Damaged on arrival" },
  { value: "late-delivery", label: "Late delivery" },
  { value: "duplicate-charge", label: "Duplicate charge" },
];

/** The whole order page, inside the desk's application shell. */
export function orderDetailContent(css: OrderClasses, order: CustomerOrder, refundedPence: number): string {
  return `<p class="${css.crumbs}"><a href="${ORDER_OPERATIONS_ROOT}">Orders</a> / ${order.reference}</p>
<div class="${css.pageHead}">
<div>
<h1 class="${css.pageTitle}">${order.reference}</h1>
<p class="${css.statLine}">Placed ${formatPlaced(order.placed)} by ${escapeHtml(order.customer)}</p>
</div>
<div class="${css.pageActions}">
<button class="${css.button}" type="button" data-testid="mark-dispatched"${isDispatchable(order) ? "" : " disabled"}>Mark dispatched</button>
<button class="${css.button} ${css.buttonDanger}" type="button" data-testid="cancel-order">Cancel order</button>
</div>
</div>
<div class="${css.columns}" data-testid="order-detail">
<section class="${css.panel}" aria-labelledby="items-heading">
<div class="${css.panelBody}">
<h2 id="items-heading">Items</h2>
${lineItemsMarkup(css, order)}
</div>
</section>
<div>
${orderSummaryPanel(css, order, refundedPence)}
${addressPanel(css, order)}
${refundPanel(css, order)}
</div>
</div>`;
}

function lineItemsMarkup(css: OrderClasses, order: CustomerOrder): string {
  const rows = order.lines.map((line) => `<tr data-sku="${line.sku}">
<td class="${css.cell}">${escapeHtml(line.item)}</td>
<td class="${css.cell}">${line.sku}</td>
<td class="${css.cell} ${css.numberCell}">${line.quantity}</td>
<td class="${css.cell} ${css.numberCell}">${formatMoney(line.unitPence)}</td>
<td class="${css.cell} ${css.numberCell}">${formatMoney(lineTotalPence(line))}</td>
</tr>`).join("");
  return `<table class="${css.table}">
<thead><tr>
<th class="${css.headCell}" scope="col">Item</th>
<th class="${css.headCell}" scope="col">SKU</th>
<th class="${css.headCell} ${css.numberCell}" scope="col">Quantity</th>
<th class="${css.headCell} ${css.numberCell}" scope="col">Unit price</th>
<th class="${css.headCell} ${css.numberCell}" scope="col">Line total</th>
</tr></thead>
<tbody data-testid="line-items">${rows}</tbody>
</table>`;
}

/**
 * The summary list. Three fields carry a test id, because a scenario fact has
 * to be able to read what a run left the order at; every other field is
 * reachable only the way a person reads it, by the label beside it.
 */
export function orderSummaryPanel(css: OrderClasses, order: CustomerOrder, refundedPence: number): string {
  return `<section class="${css.panel}" data-testid="order-summary" aria-labelledby="summary-heading">
<div class="${css.panelBody}">
<h2 id="summary-heading">Order summary</h2>
<dl class="${css.definitions}">
<dt>Reference</dt><dd data-field="reference">${order.reference}</dd>
<dt>Customer</dt><dd data-field="customer">${escapeHtml(`${order.customer} (${order.customerEmail})`)}</dd>
<dt>Placed</dt><dd data-field="placed">${formatPlaced(order.placed)}</dd>
<dt>Order total</dt><dd data-field="total" data-testid="order-total">${formatMoney(orderTotalPence(order))}</dd>
<dt>Payment</dt><dd data-field="payment" data-testid="payment-state">${order.payment}</dd>
<dt>Fulfilment</dt><dd data-field="fulfilment" data-testid="fulfilment-state">${order.fulfilment}</dd>
<dt>Refunded</dt><dd data-field="refunded" data-testid="refunded-total">${refundedText(refundedPence)}</dd>
</dl>
</div>
</section>`;
}

function addressPanel(css: OrderClasses, order: CustomerOrder): string {
  const { line1, town, postcode } = order.address;
  return `<section class="${css.panel}" aria-labelledby="address-heading">
<div class="${css.panelBody}">
<h2 id="address-heading">Delivery address</h2>
<address class="${css.address}" data-testid="delivery-address">${escapeHtml(order.customer)}<br>${escapeHtml(line1)}<br>${escapeHtml(town)}<br>${postcode}</address>
</div>
</section>`;
}

function refundPanel(css: OrderClasses, order: CustomerOrder): string {
  const reasons = REFUND_REASONS.map((reason) => `<option value="${reason.value}">${escapeHtml(reason.label)}</option>`).join("");
  const refundable = isRefundable(order);
  return `<section class="${css.panel}" aria-labelledby="refund-heading">
<div class="${css.panelBody}">
<h2 id="refund-heading">Refund</h2>
${refundable ? "" : `<p class="${css.hint}" data-testid="refund-blocked">Nothing can be refunded against an order in this state.</p>`}
<form data-testid="refund-form">
<div class="${css.formRow}"><label class="${css.fieldLabel}" for="refund-amount">Refund amount</label>
<input class="${css.input}" id="refund-amount" data-testid="refund-amount" name="amount" autocomplete="off" placeholder="0.00"${refundable ? "" : " disabled"}></div>
<div class="${css.formRow}"><label class="${css.fieldLabel}" for="refund-reason">Reason</label>
<select class="${css.select}" id="refund-reason" data-testid="refund-reason" name="reason"${refundable ? "" : " disabled"}><option value="">Choose a reason</option>${reasons}</select></div>
<p class="${css.hint}">Issue refund stays off until an amount above zero and a reason have been given.</p>
<p><button class="${css.button} ${css.buttonPrimary}" type="submit" data-testid="issue-refund" disabled>Issue refund</button></p>
</form>
</div>
</section>`;
}
