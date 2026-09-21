import { listingById, skuPriceCents, storeById } from "../catalog/index.js";
import type { CartLine, OrderTotals, ShippingMethod } from "./types.js";

/** What the express option adds per store, in euro cents. */
export const EXPRESS_CENTS = 699;

/** One piece of a line at its option set's price, or 0 for a line whose listing or option set no longer exists. */
export function lineUnitCents(line: CartLine): number {
  const listing = listingById(line.listingId);
  return listing ? skuPriceCents(listing, line.choice) ?? 0 : 0;
}

/** The standard shipping a line costs: nothing, a flat charge, or a flat charge below a free-shipping threshold. */
export function lineShippingCents(line: CartLine): number {
  const shipping = listingById(line.listingId)?.shipping;
  if (!shipping || shipping.kind === "free") return 0;
  if (shipping.kind === "paid") return shipping.cents;
  return lineUnitCents(line) * line.quantity >= shipping.cents ? 0 : shipping.cents;
}

/** The store coupon a store's lines earn, given the coupons the buyer holds: its value once the store's subtotal reaches the minimum. */
export function storeDiscountCents(storeId: string, storeItemsCents: number, heldCoupons: readonly string[]): number {
  const coupon = storeById(storeId).coupon;
  if (!coupon || !heldCoupons.includes(storeId)) return 0;
  return storeItemsCents >= coupon.minimumCents ? coupon.offCents : 0;
}

/** The lines grouped by the store that sells them, in the order each store first appears. */
export function linesByStore(lines: readonly CartLine[]): Array<{ storeId: string; lines: CartLine[] }> {
  const groups: Array<{ storeId: string; lines: CartLine[] }> = [];
  for (const line of lines) {
    const storeId = listingById(line.listingId)?.storeId ?? "";
    const group = groups.find((candidate) => candidate.storeId === storeId);
    if (group) group.lines.push(line);
    else groups.push({ storeId, lines: [line] });
  }
  return groups;
}

export function sessionTotals(lines: readonly CartLine[], shipping: Readonly<Record<string, ShippingMethod>>, heldCoupons: readonly string[]): OrderTotals {
  let itemsCents = 0;
  let discountCents = 0;
  let shippingCents = 0;
  for (const group of linesByStore(lines)) {
    const storeItems = group.lines.reduce((sum, line) => sum + lineUnitCents(line) * line.quantity, 0);
    itemsCents += storeItems;
    discountCents += storeDiscountCents(group.storeId, storeItems, heldCoupons);
    shippingCents += group.lines.reduce((sum, line) => sum + lineShippingCents(line), 0);
    if (shipping[group.storeId] === "express") shippingCents += EXPRESS_CENTS;
  }
  return { itemsCents, discountCents, shippingCents, totalCents: itemsCents - discountCents + shippingCents };
}

/**
 * A sixteen-digit order number, the same for a seed and a position every
 * time, so a reload never renumbers an order and a manifest can name the one
 * a run will be given.
 */
export function orderNumber(seed: number, index: number): string {
  let digits = "81";
  let value = 0x811c9dc5;
  for (let round = 0; digits.length < 16; round += 1) {
    for (const character of `${seed}:${index}:${round}`) {
      value ^= character.charCodeAt(0);
      value = Math.imul(value, 0x01000193) >>> 0;
    }
    digits += String(value % 10_000).padStart(4, "0");
  }
  return digits.slice(0, 16);
}
