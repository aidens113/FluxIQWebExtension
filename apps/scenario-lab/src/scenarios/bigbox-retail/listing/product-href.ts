import { SITE_ROOT } from "../catalog/index.js";
import type { Product } from "../types.js";

/** A product page's address: the slug for people and search engines, the item id for the store. */
export function productHref(product: Product, sku?: string): string {
  return `${SITE_ROOT}ip/${product.slug}/${product.id}${sku === undefined ? "" : `?variant=${sku}`}`;
}

/** A one-pixel placeholder an image shows until it scrolls near the viewport and its real source is swapped in. */
export const IMAGE_PLACEHOLDER = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
