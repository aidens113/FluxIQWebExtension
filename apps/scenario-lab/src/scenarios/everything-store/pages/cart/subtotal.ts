import { formatMoney } from "../../catalog/index.js";
import { linePrice, type StoreState } from "../../state/index.js";

/** The subtotal line: selected lines only, counted quantity by quantity, as the store words it. */
export function cartSubtotalText(state: StoreState): string {
  const selected = state.cart.filter((line) => line.selected);
  const count = selected.reduce((sum, line) => sum + line.quantity, 0);
  const cents = selected.reduce((sum, line) => sum + (linePrice(line.sku, line.offerId) ?? 0) * line.quantity, 0);
  return `Subtotal (${count} ${count === 1 ? "item" : "items"}): ${formatMoney(cents)}`;
}
