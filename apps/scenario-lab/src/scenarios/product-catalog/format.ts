import type { CatalogProduct, CatalogVariant } from "./types.js";

/** The start page. Product links are written root-relative from here, so their `href` text is the same on every run's port. */
export const CATALOG_ROOT = "/scenarios/product-catalog/";

/** `$1,249.00`; the `text-variant` writes the same amount as `1,249.00 USD`. */
export function formatPrice(priceCents: number, variant: CatalogVariant): string {
  const dollars = String(Math.floor(priceCents / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const amount = `${dollars}.${String(priceCents % 100).padStart(2, "0")}`;
  return variant === "text-variant" ? `${amount} USD` : `$${amount}`;
}

export function formatRating(ratingTenths: number): string {
  return `${Math.floor(ratingTenths / 10)}.${ratingTenths % 10} out of 5`;
}

export function productPath(product: CatalogProduct): string {
  return `${CATALOG_ROOT}products/${product.slug}`;
}

/**
 * The origin `absolute-links` writes card links against. A fixed, non-loopback
 * host on purpose: the lab's port moves between runs and an expected record is
 * literal text, so a link to the live origin could not be written down here.
 * Nothing navigates it -- the workflows that read it extract the attribute.
 */
export const CATALOG_ABSOLUTE_ORIGIN = "https://catalog.example.test";

/** The card link's `href` exactly as the page writes it under `variant`. */
export function productHref(product: CatalogProduct, variant: CatalogVariant): string {
  return variant === "absolute-links" ? `${CATALOG_ABSOLUTE_ORIGIN}${productPath(product)}` : productPath(product);
}

/** The slug of the shared placeholder a deferred card shows before its photo arrives. */
export const CATALOG_PLACEHOLDER_SLUG = "placeholder";

/** A card photo, served by the `route` hook. Read as an attribute, never fetched by an extraction. */
export function productImagePath(slug: string): string {
  return `${CATALOG_ROOT}images/${slug}.svg`;
}

export function productImageAlt(product: CatalogProduct): string {
  return `${product.name} product photo`;
}

/**
 * Under `sparse-cards` a card omits its price when the product is out of stock
 * and its rating when the rating is below 4.2, so those fields are absent from
 * the card rather than empty. The manifest builds its expected records from
 * these two predicates and the page renders from them, so the two cannot drift.
 */
export function cardShowsPrice(product: CatalogProduct, variant: CatalogVariant): boolean {
  return variant !== "sparse-cards" || product.inStock;
}

export function cardShowsRating(product: CatalogProduct, variant: CatalogVariant): boolean {
  return variant !== "sparse-cards" || product.ratingTenths >= 42;
}

export function stockLabel(product: CatalogProduct): string {
  return product.inStock ? "In stock" : "Out of stock";
}
