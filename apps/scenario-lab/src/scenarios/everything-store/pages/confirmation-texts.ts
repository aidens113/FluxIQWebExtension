import { CATALOG, formatMoney } from "../catalog/index.js";
import { ACCOUNT, type PlacedOrder } from "../state/index.js";

/**
 * Every sentence the confirmation page states about an order, each of which
 * is one of the page's facts. The manifest's goal is written from the same
 * sentences for the order the task asks for, so the page and the goal cannot
 * word the same order two ways.
 */
export type ConfirmationTexts = {
  status: string;
  shipTo: string;
  delivery: string;
  lines: readonly string[];
  payment: string;
  total: string;
  plusTrial: string | null;
};

export function confirmationTexts(order: Pick<PlacedOrder, "lines" | "addressId" | "paymentId" | "giftCard" | "delivery" | "plusTrial" | "totalCents">): ConfirmationTexts {
  const option = ACCOUNT.delivery[order.delivery];
  const lines = order.lines.map((line) => {
    const product = CATALOG.bySku(line.sku);
    const seller = line.offerId === null ? product?.seller ?? "" : CATALOG.offer(line.offerId)?.seller ?? "";
    return `${line.quantity} x ${product?.title ?? line.sku} | Sold by ${seller}`;
  });
  return {
    status: "Order placed, thanks!",
    shipTo: `Shipping to ${ACCOUNT.addresses[order.addressId].line}`,
    delivery: `${option.label}: ${option.date.long}`,
    lines,
    payment: `Paid with ${ACCOUNT.payments[order.paymentId]}${order.giftCard ? " and your gift card balance" : ""}`,
    total: `Order total: ${formatMoney(order.totalCents)}`,
    plusTrial: order.plusTrial ? `Your 30-day Brightaisle Plus free trial has started. After the trial you will be charged ${formatMoney(ACCOUNT.plusMonthlyCents)}/month.` : null,
  };
}
