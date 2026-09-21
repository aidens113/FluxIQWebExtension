import { FULFILMENT_LABEL, formatMoney, storeById } from "../catalog/index.js";
import { cartTotals } from "./cart-totals.js";
import { describeLine } from "./describe-line.js";
import type { BigboxState, CartLine } from "../types.js";

export type MiniCartText = {
  store: string;
  lines: Array<{ testId: string; text: string }>;
  summary: string;
  saved: string;
};

const items = (count: number) => `${count} ${count === 1 ? "item" : "items"}`;

/** The test id of the mini cart's entry for one line: its size and how it is fulfilled, which is what makes a line distinct. */
export function miniCartLineTestId(line: Pick<CartLine, "sku" | "fulfilment">): string {
  return `mini-cart-line-${line.sku}-${line.fulfilment}`;
}

/**
 * Every string the header's mini cart prints, derived from state alone. The
 * mini cart is rendered on every page and rewritten from each response the
 * page gets back, so it is the one place the cart's true contents always
 * show -- unlike the header's count badge, which only a page load refreshes.
 */
export function miniCartText(state: Pick<BigboxState, "cart" | "saved" | "storeId">): MiniCartText {
  const totals = cartTotals(state.cart, state.storeId);
  return {
    store: `Pickup store: ${storeById(state.storeId).name}`,
    lines: state.cart.flatMap((line) => {
      const view = describeLine(line);
      return view ? [{ testId: miniCartLineTestId(line), text: `${line.qty} × ${view.title} · ${FULFILMENT_LABEL[line.fulfilment]}` }] : [];
    }),
    summary: `${items(totals.itemCount)} · Subtotal ${formatMoney(totals.subtotalCents)}`,
    saved: `Saved for later: ${items(state.saved.reduce((sum, line) => sum + line.qty, 0))}`,
  };
}
