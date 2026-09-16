import { escapeHtml } from "../../html.js";

/** One line of the order the same-origin checkout frame lists. */
export type OrderLine = { item: string; quantity: string; amount: string };

/**
 * The order lines inside the same-origin frame. They are authored rather than
 * seeded, so the expected records hold under any lab seed, and each amount is
 * distinct so a record read from the wrong line cannot match by accident.
 */
export const orderLines: readonly OrderLine[] = [
  { item: "Ceramic pour-over set", quantity: "1", amount: "$34.00" },
  { item: "Enamel camp mug", quantity: "2", amount: "$24.00" },
  { item: "Bamboo cutting board", quantity: "1", amount: "$19.99" },
  { item: "Linen table runner", quantity: "3", amount: "$83.85" },
];

/**
 * The order lines as the frame lists them. Each field sits in its own element
 * inside the line, so extraction reads them by name rather than by splitting
 * one string.
 */
export function renderOrderLines(): string {
  const rows = orderLines.map((line) => `<li data-testid="order-line">
        <span data-testid="order-line-item">${escapeHtml(line.item)}</span>
        <span data-testid="order-line-quantity">${escapeHtml(line.quantity)}</span>
        <span data-testid="order-line-amount">${escapeHtml(line.amount)}</span>
      </li>`).join("");
  return `<section aria-label="Order lines"><h2>Order</h2><ul data-testid="order-lines">${rows}</ul></section>`;
}
