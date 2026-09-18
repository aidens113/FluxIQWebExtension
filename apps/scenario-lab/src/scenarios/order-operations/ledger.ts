import { orderTotalPence } from "./format.js";
import { customerOrders, quietWeekOrders } from "./orders.js";
import type { CustomerOrder, OrderOperationsMode, PaymentState } from "./types.js";

/** The book a rendering shows. Only `quiet-week` changes it, and only by how many orders it holds. */
export function ordersFor(mode: OrderOperationsMode): readonly CustomerOrder[] {
  return mode === "quiet-week" ? quietWeekOrders : customerOrders;
}

/**
 * The book after a run's own changes, so every count and every cell is what the
 * page would now show.
 *
 * A refund moves the payment state by itself: give back less than the order
 * came to and it reads "Part refunded", give back the lot and it reads
 * "Refunded". That is what makes a partial refund judgeable -- the state the
 * run left behind is arithmetic on what it actually refunded, not a flag it
 * was allowed to set.
 */
export function applyOrderChanges(
  orders: readonly CustomerOrder[],
  refunds: Readonly<Record<string, number>>,
  dispatched: readonly string[],
  cancelled: readonly string[],
): CustomerOrder[] {
  const sent = new Set(dispatched);
  const voided = new Set(cancelled);
  return orders.map((order) => {
    const payment = paymentAfterRefund(order, refunds[order.reference] ?? 0);
    const fulfilment = voided.has(order.reference) ? "Cancelled" : sent.has(order.reference) ? "Dispatched" : order.fulfilment;
    return payment === order.payment && fulfilment === order.fulfilment ? order : { ...order, payment, fulfilment };
  });
}

/** What an order's payment state becomes once `refundedPence` has been given back against it. */
export function paymentAfterRefund(order: CustomerOrder, refundedPence: number): PaymentState {
  if (refundedPence <= 0) return order.payment;
  return refundedPence >= orderTotalPence(order) ? "Refunded" : "Part refunded";
}

/** Whether an order can still be refunded: money has been taken and not all of it given back. */
export function isRefundable(order: CustomerOrder): boolean {
  return order.payment === "Paid" || order.payment === "Part refunded";
}

/** Whether an order can be dispatched: it has been paid for and nobody has sent it yet. */
export function isDispatchable(order: CustomerOrder): boolean {
  return isRefundable(order) && order.fulfilment === "Unfulfilled";
}

/** What the page header counts: the book, what is waiting to go out, and what has money owed back. */
export function bookCounts(orders: readonly CustomerOrder[]): { orderCount: number; awaitingDispatchCount: number; refundedCount: number } {
  return {
    orderCount: orders.length,
    awaitingDispatchCount: orders.filter((order) => order.fulfilment === "Unfulfilled").length,
    refundedCount: orders.filter((order) => order.payment === "Part refunded" || order.payment === "Refunded").length,
  };
}

/** The header stat line, which is also the oracle a final-state fact reads. */
export function bookSummaryText(orders: readonly CustomerOrder[]): string {
  const { orderCount, awaitingDispatchCount, refundedCount } = bookCounts(orders);
  return `${orderCount} orders · ${awaitingDispatchCount} awaiting dispatch · ${refundedCount} refunded`;
}

export function resultCountText(shown: number, total: number): string {
  return `Showing ${shown} of ${total} orders`;
}

/** The dispatch note's own line for an order: how many things are in the box. */
export function itemCountText(order: CustomerOrder): string {
  const items = order.lines.reduce((count, line) => count + line.quantity, 0);
  return items === 1 ? "1 item" : `${items} items`;
}
