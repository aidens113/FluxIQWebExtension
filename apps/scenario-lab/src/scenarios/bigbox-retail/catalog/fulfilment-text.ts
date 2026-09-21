import type { Fulfilment, Speed, Variant } from "../types.js";

/**
 * The lines a tile prints under the price, in the order it prints them, one
 * per way the item can be had from `storeId`: "Pickup today", "Delivery
 * tomorrow", "Shipping, arrives Thu, Sep 24". A way it cannot be had prints
 * nothing at all rather than a "not available" line.
 */
export function fulfilmentLines(variant: Variant, storeId: string): string[] {
  const lines: string[] = [];
  const pickup = variant.pickup[storeId] ?? "none";
  if (pickup !== "none") lines.push(`Pickup ${pickup}`);
  if (variant.delivery !== "none") lines.push(`Delivery ${variant.delivery}`);
  if (variant.shipping !== "") lines.push(`Shipping, arrives ${variant.shipping}`);
  return lines;
}

/** How soon `variant` can be had from `storeId` by `method`, or "none". */
export function speedOf(variant: Variant, storeId: string, method: Fulfilment): Speed | "ships" {
  if (method === "pickup") return variant.pickup[storeId] ?? "none";
  if (method === "delivery") return variant.delivery;
  return variant.shipping === "" ? "none" : "ships";
}

/** The fastest way `storeId` offers `variant`, pickup first, as a product page and a quick-add preselect it. */
export function defaultFulfilment(variant: Variant, storeId: string): Fulfilment | undefined {
  return (["pickup", "delivery", "shipping"] as const).find((method) => speedOf(variant, storeId, method) !== "none");
}

/** The word a cart line and the mini cart use for a fulfilment method. */
export const FULFILMENT_LABEL: Readonly<Record<Fulfilment, string>> = { pickup: "Pickup", delivery: "Delivery", shipping: "Shipping" };
