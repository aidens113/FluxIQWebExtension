import { ACCOUNT } from "./account.js";
import type { CheckoutSession } from "./types.js";

export type OrderTotals = { itemCount: number; itemsCents: number; deliveryCents: number; giftCents: number; taxCents: number; totalCents: number };

/**
 * What an order costs. One-Day delivery is charged unless the Plus trial is
 * ticked; the gift card, when applied, takes what it holds off the total;
 * Oregon charges no sales tax.
 */
export function orderTotals(session: Pick<CheckoutSession, "lines" | "delivery" | "plusTrial" | "giftCard">): OrderTotals {
  const itemCount = session.lines.reduce((sum, line) => sum + line.quantity, 0);
  const itemsCents = session.lines.reduce((sum, line) => sum + line.unitCents * line.quantity, 0);
  const deliveryCents = session.delivery === "one-day" && !session.plusTrial ? ACCOUNT.delivery["one-day"].costCents : 0;
  const giftCents = session.giftCard ? Math.min(ACCOUNT.giftCardCents, itemsCents + deliveryCents) : 0;
  return { itemCount, itemsCents, deliveryCents, giftCents, taxCents: 0, totalCents: itemsCents + deliveryCents - giftCents };
}
