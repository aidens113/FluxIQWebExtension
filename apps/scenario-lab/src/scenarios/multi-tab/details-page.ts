import { escapeHtml, page } from "../../html.js";
import type { PurchaseOrder } from "./purchase-orders.js";

/**
 * The document a details tab shows for one order: every field the workflow
 * extracts, as a labelled description list inside `order-details`. It has no
 * script; the route records the visit through its `mutation`.
 */
export function detailsPage(order: PurchaseOrder): string {
  const number = escapeHtml(order.order);
  const field = (label: string, key: keyof PurchaseOrder) =>
    `<div><dt>${label}</dt><dd data-testid="detail-${key}">${escapeHtml(order[key])}</dd></div>`;
  const body = `<main>
    <nav aria-label="Breadcrumb"><a href="/scenarios/multi-tab/">Purchase orders</a> / <span aria-current="page">${number}</span></nav>
    <h1 data-testid="details-heading">Purchase order ${number}</h1>
    <section aria-labelledby="order-summary-heading" data-testid="order-details" data-entity-id="${number}">
      <h2 id="order-summary-heading">Order summary</h2>
      <dl>
        ${field("Order number", "order")}
        ${field("Supplier", "supplier")}
        ${field("Status", "status")}
        ${field("Buyer", "buyer")}
        ${field("Requested delivery", "delivery")}
        ${field("Order total", "total")}
      </dl>
    </section>
    <p>This order opened in its own tab; the order list is still open in the tab you came from.</p>
  </main>`;
  return page(`Purchase order ${order.order}`, body, "");
}
