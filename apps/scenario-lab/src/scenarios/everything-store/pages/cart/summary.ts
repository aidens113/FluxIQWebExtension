import { formatMoney } from "../../catalog/index.js";
import { linePrice } from "../../state/index.js";
import type { PageKit } from "../page-kit.js";

/** The "Added to cart" sheet's summary line: the whole cart, as the side sheet fetches it. */
export function cartSummaryMarkup(kit: PageKit): string {
  const count = kit.state.cart.reduce((sum, line) => sum + line.quantity, 0);
  const cents = kit.state.cart.reduce((sum, line) => sum + (linePrice(line.sku, line.offerId) ?? 0) * line.quantity, 0);
  return `<p>Cart subtotal (${count} ${count === 1 ? "item" : "items"}): <b>${formatMoney(cents)}</b></p>`;
}
