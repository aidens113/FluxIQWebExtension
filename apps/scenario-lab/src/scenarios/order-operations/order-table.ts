import { escapeHtml } from "../../html.js";
import { FULFILMENT_OPTIONS, PAYMENT_OPTIONS, type OrderOption } from "./filters.js";
import { formatMoney, formatPlaced, orderPath, orderTotalPence } from "./format.js";
import { itemCountText } from "./ledger.js";
import { ORDER_GLYPHS, orderIcon, type OrderClasses } from "./styles.js";
import type { CustomerOrder } from "./types.js";

/**
 * The book's filter toolbar. Its search field is labelled "Search", which is
 * also the accessible name of the top bar's own search input: two controls on
 * the page, one name, and nothing but their surroundings to tell them apart.
 * The two date boxes are plain text and say what shape they want, because that
 * is the only way a date filter reads the same in every browser.
 */
export function orderToolbarMarkup(css: OrderClasses): string {
  return `<div class="${css.toolbar}">
<label class="${css.srOnly}" for="order-search">Search</label>
<input class="${css.input}" id="order-search" data-testid="order-search" type="search" name="q" autocomplete="off" placeholder="Search orders">
<span class="${css.field}"><label class="${css.fieldLabel}" for="payment-filter">Payment</label>${select(css, "payment-filter", "payment", PAYMENT_OPTIONS)}</span>
<span class="${css.field}"><label class="${css.fieldLabel}" for="fulfilment-filter">Fulfilment</label>${select(css, "fulfilment-filter", "fulfilment", FULFILMENT_OPTIONS)}</span>
<span class="${css.field}"><label class="${css.fieldLabel}" for="placed-from">Placed from</label><input class="${css.dateInput}" id="placed-from" data-testid="placed-from" name="from" autocomplete="off" placeholder="YYYY-MM-DD"></span>
<span class="${css.field}"><label class="${css.fieldLabel}" for="placed-to">Placed to</label><input class="${css.dateInput}" id="placed-to" data-testid="placed-to" name="to" autocomplete="off" placeholder="YYYY-MM-DD"></span>
<button class="${css.iconButton}" type="button" title="Table settings" data-action="table-settings">${orderIcon(css.navIcon, ORDER_GLYPHS.sliders)}</button>
</div>`;
}

/**
 * The order table: one row per order, and one action button per row identical
 * to the other 279.
 *
 * The accessibility of the controls in here is deliberately uneven, because a
 * shipped back office is. Every row's checkbox carries the design system's
 * constant label, "Select order", and every row's overflow button carries
 * "More actions", so neither can be told from the other 279 by name; what
 * separates them is the row they sit in. The reference is a real link, because
 * that is how a person opens an order, and it is the only text in the row that
 * is unique to it.
 */
export function orderTableMarkup(css: OrderClasses, orders: readonly CustomerOrder[]): string {
  return `<table class="${css.table}">
<thead><tr>
<th class="${css.headCell} ${css.checkCell}" scope="col"><input type="checkbox" aria-label="Select every order in this list"></th>
<th class="${css.headCell}" scope="col">Order</th>
<th class="${css.headCell}" scope="col">Customer</th>
<th class="${css.headCell}" scope="col">Placed</th>
<th class="${css.headCell} ${css.numberCell}" scope="col">Total</th>
<th class="${css.headCell}" scope="col">Payment</th>
<th class="${css.headCell}" scope="col">Fulfilment</th>
<th class="${css.headCell} ${css.actionCell}" scope="col"><span class="${css.srOnly}">Actions</span></th>
</tr></thead>
<tbody data-testid="order-rows">${orders.map((order) => orderRow(css, order)).join("")}</tbody>
</table>`;
}

/** The row the table shows when the filters leave nothing. */
export function emptyOrderRowMarkup(css: OrderClasses): string {
  return `<tr><td class="${css.empty}" colspan="8">No orders match these filters.</td></tr>`;
}

/**
 * The dispatch note a bulk dispatch leaves behind: what went out, to whom, how
 * much was in the box and what it came to. It exists only once something has
 * actually been dispatched, which is what makes reading it proof that the run
 * changed something rather than merely looked at the book.
 */
export function dispatchNoteMarkup(css: OrderClasses, orders: readonly CustomerOrder[]): string {
  if (orders.length === 0) return "";
  const rows = orders.map((order) => `<tr data-order-ref="${order.reference}">
<td class="${css.cell}">${order.reference}</td>
<td class="${css.cell}">${escapeHtml(order.customer)}</td>
<td class="${css.cell}">${itemCountText(order)}</td>
<td class="${css.cell} ${css.numberCell}">${formatMoney(orderTotalPence(order))}</td>
</tr>`).join("");
  return `<div class="${css.panelBody}" data-testid="dispatch-note">
<h2>Dispatch note</h2>
<p class="${css.note}" data-testid="dispatch-note-summary">${orders.length === 1 ? "1 order" : `${orders.length} orders`} handed to the carrier.</p>
<table class="${css.table}">
<thead><tr>
<th class="${css.headCell}" scope="col">Order</th>
<th class="${css.headCell}" scope="col">Customer</th>
<th class="${css.headCell}" scope="col">Items</th>
<th class="${css.headCell} ${css.numberCell}" scope="col">Total</th>
</tr></thead>
<tbody data-testid="dispatch-rows">${rows}</tbody>
</table>
</div>`;
}

function orderRow(css: OrderClasses, order: CustomerOrder): string {
  return `<tr class="${css.row}" data-order-ref="${order.reference}" data-placed="${order.placed}">
<td class="${css.cell} ${css.checkCell}"><input type="checkbox" value="${order.reference}" aria-label="Select order"></td>
<td class="${css.cell}"><a href="${orderPath(order.reference)}">${order.reference}</a></td>
<td class="${css.cell}">${escapeHtml(order.customer)}</td>
<td class="${css.cell}">${formatPlaced(order.placed)}</td>
<td class="${css.cell} ${css.numberCell}">${formatMoney(orderTotalPence(order))}</td>
<td class="${css.cell}"><span class="${css.badge} ${paymentClass(css, order)}">${order.payment}</span></td>
<td class="${css.cell}"><span class="${css.badge} ${fulfilmentClass(css, order)}">${order.fulfilment}</span></td>
<td class="${css.cell} ${css.actionCell}"><button class="${css.iconButton}" type="button" aria-label="More actions" aria-haspopup="menu" aria-expanded="false">${orderIcon(css.navIcon, ORDER_GLYPHS.overflow)}</button></td>
</tr>`;
}

function paymentClass(css: OrderClasses, order: CustomerOrder): string {
  if (order.payment === "Paid") return css.badgePaid;
  if (order.payment === "Failed") return css.badgeFailed;
  return order.payment === "Authorised" ? css.badgeOpen : css.badgeOwed;
}

function fulfilmentClass(css: OrderClasses, order: CustomerOrder): string {
  if (order.fulfilment === "Delivered") return css.badgePaid;
  if (order.fulfilment === "Cancelled") return css.badgeFailed;
  return order.fulfilment === "Dispatched" ? css.badgeSent : css.badgeOpen;
}

/** A select the toolbar owns. Its `id` is what the label points at; its `name` is the stable thing about it. */
function select(css: OrderClasses, id: string, name: string, options: readonly OrderOption[]): string {
  const rendered = options.map((option) => `<option value="${option.value}">${escapeHtml(option.label)}</option>`).join("");
  return `<select class="${css.select}" id="${id}" data-testid="${id}" name="${name}">${rendered}</select>`;
}
