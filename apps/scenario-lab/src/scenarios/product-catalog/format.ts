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

export function stockLabel(product: CatalogProduct): string {
  return product.inStock ? "In stock" : "Out of stock";
}
