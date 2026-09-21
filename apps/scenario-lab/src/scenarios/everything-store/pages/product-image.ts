import { escapeHtml } from "../../../html.js";
import type { Product } from "../catalog/index.js";

/** A product's placeholder photo: a tinted panel with the brand's initials, served as SVG from the store's own origin. */
export function productImageSvg(product: Product): string {
  const initials = product.brand.split(/\s+/u).map((word) => word[0] ?? "").join("").slice(0, 3).toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="hsl(${product.hue} 35% 88%)"/><circle cx="150" cy="140" r="80" fill="hsl(${product.hue} 40% 55%)"/><text x="150" y="160" font-family="Arial" font-size="54" text-anchor="middle" fill="#fff">${escapeHtml(initials)}</text></svg>`;
}
