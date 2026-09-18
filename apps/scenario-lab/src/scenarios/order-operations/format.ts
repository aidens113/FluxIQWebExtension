import type { CustomerOrder, OrderLine } from "./types.js";

/** The order book's own page. Links are written root-relative, so their text is the same on every run's port. */
export const ORDER_OPERATIONS_ROOT = "/scenarios/order-operations/";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

/** `£1,249.00`. Everything on this desk is priced in pence and shown in pounds. */
export function formatMoney(pence: number): string {
  const whole = String(Math.floor(Math.abs(pence) / 100)).replace(/\B(?=(\d{3})+(?!\d))/gu, ",");
  return `${pence < 0 ? "-" : ""}£${whole}.${String(Math.abs(pence) % 100).padStart(2, "0")}`;
}

/** `2026-03-04` as the Placed column writes it: `4 March 2026`. */
export function formatPlaced(iso: string): string {
  const [year, month, day] = iso.split("-");
  const name = MONTHS[Number(month) - 1];
  if (year === undefined || day === undefined || name === undefined) throw new Error(`An order placed date must be an ISO day, not ${iso}`);
  return `${Number(day)} ${name} ${year}`;
}

/** The day `offset` days after `iso`, as an ISO day. Used only to lay the book out over a trading period. */
export function shiftDay(iso: string, offset: number): string {
  const day = new Date(`${iso}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + offset);
  return day.toISOString().slice(0, 10);
}

export function lineTotalPence(line: OrderLine): number {
  return line.quantity * line.unitPence;
}

/** What the order came to: the sum of its lines, which is what the Total column shows. */
export function orderTotalPence(order: CustomerOrder): number {
  return order.lines.reduce((total, line) => total + lineTotalPence(line), 0);
}

/** The path of one order's own page. */
export function orderPath(reference: string): string {
  return `${ORDER_OPERATIONS_ROOT}orders/${reference}`;
}

/** The refund line on an order's page: what has been given back, or that nothing has. */
export function refundedText(refundedPence: number): string {
  return refundedPence > 0 ? `${formatMoney(refundedPence)} refunded` : "Nothing refunded";
}
