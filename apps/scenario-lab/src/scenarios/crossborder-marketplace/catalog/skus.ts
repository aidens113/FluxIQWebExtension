import { VOLTBAY_OFFICIAL_ID } from "./listings.js";
import type { Listing, ShipOrigin, SkuChoice } from "./types.js";

/** The Specification group of a `hub` listing, in the order its chips appear. */
export const HUB_SPECS = ["4-in-1", "7-in-1", "10-in-1"] as const;

const ORIGIN_SURCHARGE: Record<ShipOrigin, number> = { China: 0, Spain: 300, Poland: 200, "Czech Republic": 200 };
const OFFICIAL_BASE: Record<string, number> = { "4-in-1": 1249, "7-in-1": 1999, "10-in-1": 2999 };
const LOOKALIKE_BASE: Record<string, number> = { "4-in-1": 1199, "7-in-1": 1899, "10-in-1": 2799 };

/**
 * Combinations the official listing has none of: the exact option set the
 * purchase tasks ask for is in stock, but only just (four pieces), and its
 * Poland twin is sold out, so "any warehouse in the EU" is not the same order.
 */
const SOLD_OUT = new Set(["Space Grey|7-in-1|Poland", "Mint|10-in-1|China", "Mint|10-in-1|Spain", "Mint|10-in-1|Poland"]);
const LOW_STOCK: Record<string, number> = { "Space Grey|7-in-1|Spain": 4 };

export function specOptions(listing: Listing): readonly string[] {
  return listing.skuModel === "hub" ? HUB_SPECS : [];
}

/** The option set a listing's page opens with: the first of everything, which is the cheapest. */
export function defaultChoice(listing: Listing): SkuChoice {
  return { color: listing.colors[0] ?? "", spec: specOptions(listing)[0] ?? "", origin: listing.origins[0] ?? "China" };
}

export function isKnownChoice(listing: Listing, choice: SkuChoice): boolean {
  const specs = specOptions(listing);
  return listing.colors.includes(choice.color)
    && listing.origins.includes(choice.origin)
    && (specs.length === 0 ? choice.spec === "" : specs.includes(choice.spec));
}

/** Pieces in stock for an option set, or 0 for one the listing does not sell. */
export function skuStock(listing: Listing, choice: SkuChoice): number {
  if (!isKnownChoice(listing, choice)) return 0;
  if (listing.skuModel === "basic") return 500;
  const key = `${choice.color}|${choice.spec}|${choice.origin}`;
  if (listing.id !== VOLTBAY_OFFICIAL_ID) return 37;
  if (SOLD_OUT.has(key)) return 0;
  return LOW_STOCK[key] ?? 186;
}

/** The price of one piece in euro cents, or `undefined` for an option set the listing does not sell. */
export function skuPriceCents(listing: Listing, choice: SkuChoice): number | undefined {
  if (!isKnownChoice(listing, choice)) return undefined;
  if (listing.skuModel === "basic") return listing.priceCents;
  const base = (listing.id === VOLTBAY_OFFICIAL_ID ? OFFICIAL_BASE : LOOKALIKE_BASE)[choice.spec] ?? listing.priceCents;
  return base + ORIGIN_SURCHARGE[choice.origin] + (choice.color === "Mint" ? 50 : 0);
}

/** The struck-through price for the same option set, at the listing's own discount ratio. */
export function skuOriginalCents(listing: Listing, choice: SkuChoice): number | undefined {
  const price = skuPriceCents(listing, choice);
  return price === undefined ? undefined : Math.round((price * listing.originalCents) / listing.priceCents);
}

/** How the cart, the checkout and the order spell an option set: "Space Grey · 7-in-1 · Ships from Spain". */
export function skuText(choice: SkuChoice): string {
  return [choice.color, choice.spec, `Ships from ${choice.origin}`].filter((part) => part !== "").join(" · ");
}
