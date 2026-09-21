import { pickupAt } from "./availability.js";
import type { Department, Product, Speed, Variant } from "../types.js";

/** Where a variant can be had: pickup per store, delivery, and the day a shipped order arrives. */
export type Availability = { pickup: Readonly<Record<string, Speed>>; delivery: Speed; shipping: string };

/** A marketplace listing: shipped by the seller, never on a ValueRidge shelf. */
export const shippedOnly = (arrives: string): Availability => ({ pickup: pickupAt("none"), delivery: "none", shipping: arrives });

const ABOUT: Readonly<Record<Department, readonly string[]>> = {
  "Paper Towels": [
    "Absorbent two-ply sheets that hold up to spills and scrubbing",
    "Roll counts are stated in regular-roll equivalents on the pack",
    "Made with responsibly sourced fibre; the core and wrap are recyclable",
  ],
  "Paper Towel Holders": [
    "Holds standard, double and mega rolls",
    "Weighted base keeps the roll steady while you tear",
    "Paper towels sold separately",
  ],
  Napkins: [
    "Soft, strong two-ply napkins for everyday meals",
    "Folded to fit standard napkin holders",
    "Count is per pack",
  ],
  "Dish Soap": [
    "Cuts through grease on contact",
    "Gentle on hands, tough on baked-on food",
    "Concentrated formula: a little goes a long way",
  ],
};

/**
 * One product in the shape the site renders it from. The slug is derived from
 * the name, the "about" bullets from the department, and a variant list of one
 * is a product sold in one size.
 */
export function buildProduct(input: Omit<Product, "slug" | "about" | "variants"> & { variants: readonly Variant[] }): Product {
  const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "");
  return Object.freeze({ ...input, slug, about: ABOUT[input.department], variants: Object.freeze([...input.variants]) });
}

/** One size of a product. `priceCents` is what it costs now; `wasCents`, when given, is the pre-Rollback price. */
export function buildVariant(sku: string, label: string, priceCents: number, unit: string, availability: Availability, wasCents?: number): Variant {
  return Object.freeze({ sku, label, priceCents, unit, ...availability, ...(wasCents === undefined ? {} : { wasCents }) });
}
