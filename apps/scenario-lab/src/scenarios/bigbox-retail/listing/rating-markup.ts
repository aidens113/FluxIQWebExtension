import type { Product } from "../types.js";
import type { BigboxClasses } from "../theme/index.js";

/** Stars drawn as a clipped bar, with the average beside them and the review count in brackets. */
export function ratingMarkup(product: Product, c: BigboxClasses): string {
  const reviews = product.reviews.toLocaleString("en-US");
  return `<div class="${c.ratingRow}"><span class="${c.ratingValue}" aria-hidden="true">${product.rating.toFixed(1)}</span><span class="${c.stars}" style="--pct:${Math.round(product.rating * 20)}%"></span><span class="${c.srOnly}">${product.rating.toFixed(1)} out of 5 Stars. ${reviews} reviews</span><span class="${c.reviewCount}" aria-hidden="true">(${reviews})</span></div>`;
}
