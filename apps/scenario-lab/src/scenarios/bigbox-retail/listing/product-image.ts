import { escapeHtml } from "../../../html.js";
import type { Product } from "../types.js";

const PALETTE = ["#0b4f4a", "#7a3b00", "#2c2c6b", "#6b2c4f", "#2f5d1f", "#5a5a5a"];

/** A packshot stand-in: the brand's initials on a colour the item id picks. */
export function productImageSvg(product: Product): string {
  const initials = product.brand.split(/\s+/u).map((word) => word[0] ?? "").join("").slice(0, 2);
  const color = PALETTE[Number(product.id.slice(-2)) % PALETTE.length];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" rx="16" fill="${color}"/><text x="80" y="96" font-family="sans-serif" font-size="48" font-weight="700" fill="#fff" text-anchor="middle">${escapeHtml(initials)}</text></svg>`;
}
