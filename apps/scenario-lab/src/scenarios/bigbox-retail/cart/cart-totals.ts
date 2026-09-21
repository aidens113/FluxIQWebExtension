import { storeById } from "../catalog/index.js";
import { describeLine } from "./describe-line.js";
import type { CartLine } from "../types.js";

export type CartTotals = { itemCount: number; subtotalCents: number; taxCents: number; totalCents: number };

/**
 * What a set of lines costs at a store: the item count is the quantities
 * summed, and tax is the store's rate on the subtotal, rounded half up to the
 * cent. Prices do not vary by store; tax does.
 */
export function cartTotals(lines: readonly CartLine[], storeId: string): CartTotals {
  const views = lines.map(describeLine).filter((view) => view !== undefined);
  const subtotalCents = views.reduce((sum, view) => sum + view.totalCents, 0);
  const taxCents = Math.floor((subtotalCents * storeById(storeId).taxBasisPoints + 5_000) / 10_000);
  return { itemCount: views.reduce((sum, view) => sum + view.line.qty, 0), subtotalCents, taxCents, totalCents: subtotalCents + taxCents };
}
