import { escapeHtml } from "../../../html.js";
import type { ScenarioRouteResponse } from "../../../types.js";
import { CATALOG, STORE_PATHS, formatMoney } from "../catalog/index.js";
import { ACCOUNT, orderTotals, type PlacedOrder, type StoreState } from "../state/index.js";

/**
 * The receipt is a print page: the store serves it with a policy that runs no
 * script, fetches nothing and loads only its own images, as print and invoice
 * pages on real stores often are. Its one inline script, which reveals a
 * Print button and retires the hint beside it, is written for browsers that
 * would run it and is left behind by the policy; the button stays hidden.
 */
const RECEIPT_POLICY = "default-src 'none'; script-src 'none'; connect-src 'none'; img-src 'self'";

const PRINT_SCRIPT = `<script>
document.documentElement.className = 'js';
document.querySelector('[data-print-hint]').hidden = true;
const printButton = document.querySelector('[data-print]');
printButton.hidden = false;
printButton.addEventListener('click', () => window.print());
</script>`;

function masthead(): string {
  return `<header><p><b>Brightaisle</b>.com</p>
<p data-print-hint>To keep a copy, print this page with your browser's Print command.</p>
<p><button type="button" data-print hidden>Print this page for your records</button></p></header>`;
}

function itemRows(order: PlacedOrder): string {
  return order.lines.map((line) => {
    const product = CATALOG.bySku(line.sku);
    const seller = line.offerId === null ? product?.seller ?? "" : CATALOG.offer(line.offerId)?.seller ?? "";
    return `<tr data-line><td><img src="${STORE_PATHS.image(line.sku)}" alt="" width="48" height="48"> ${escapeHtml(product?.title ?? line.sku)}<br><small>Sold by: ${escapeHtml(seller)}</small></td><td>${line.quantity}</td><td>${formatMoney(line.unitCents * line.quantity)}</td></tr>`;
  }).join("");
}

function orderDetails(order: PlacedOrder): string {
  const totals = orderTotals(order);
  const delivery = ACCOUNT.delivery[order.delivery];
  return `<h1>Final Details for Order #${escapeHtml(order.orderId)}</h1>
<p>Order total: ${formatMoney(order.totalCents)}</p>
<table><caption>Items ordered</caption><thead><tr><th>Item</th><th>Qty</th><th>Price</th></tr></thead><tbody>${itemRows(order)}</tbody></table>
<h2>Delivery</h2><p>${escapeHtml(delivery.label)}: ${escapeHtml(delivery.date.long)}</p>
<h2>Shipping address</h2><p>${escapeHtml(ACCOUNT.addresses[order.addressId].line)}</p>
<h2>Payment information</h2><p>${escapeHtml(ACCOUNT.payments[order.paymentId])}${order.giftCard ? " and gift card balance" : ""}</p>
<table><caption>Order summary</caption><tbody>
<tr><th>Item(s) subtotal:</th><td>${formatMoney(totals.itemsCents)}</td></tr>
<tr><th>Shipping &amp; handling:</th><td>${formatMoney(totals.deliveryCents)}</td></tr>
${totals.giftCents ? `<tr><th>Gift card:</th><td>-${formatMoney(totals.giftCents)}</td></tr>` : ""}
<tr><th>Estimated tax:</th><td>${formatMoney(totals.taxCents)}</td></tr>
<tr><th>Grand total:</th><td>${formatMoney(order.totalCents)}</td></tr>
</tbody></table>`;
}

/**
 * The printable receipt for one of the account's orders, or the store's
 * "not found" receipt for any other number. Either way it is a page of its
 * own, outside the store's shell: no header, no scripts that work, no
 * interruptions.
 */
export function receiptResponse(state: StoreState, orderId: string | null): ScenarioRouteResponse {
  const order = state.orders.find((candidate) => candidate.orderId === orderId);
  const title = order ? `Brightaisle.com - Order ${order.orderId}` : "Brightaisle.com - Order not found";
  const main = order ? orderDetails(order) : `<h1>We couldn't find that order.</h1><p>Check the order number in Your Orders and try again.</p>`;
  const body = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body>${masthead()}<main>${main}</main>
<footer><p>Conditions of Use | Privacy Notice &copy; 2026 Brightaisle, Inc. or its affiliates</p></footer>
${PRINT_SCRIPT}</body></html>`;
  return { status: order ? 200 : 404, headers: { "content-security-policy": RECEIPT_POLICY }, body };
}
