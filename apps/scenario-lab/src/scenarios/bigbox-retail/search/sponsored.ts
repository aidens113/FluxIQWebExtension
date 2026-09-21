import { findProduct } from "../catalog/index.js";
import { matchesQuery } from "./query-match.js";
import type { Product } from "../types.js";

/**
 * Every ad the site can run, in the order it runs them. An ad is shown only
 * for a query it answers, three to a page, and never filtered: a shopper who
 * narrows the results by retailer, speed or rating still sees the same ads.
 * Most of them are for products the same search also lists on its own, so a
 * page can carry a product twice.
 */
const AD_POOL = [
  "402917571", "482213960", "417553117",
  "418830127", "461120983", "417553188",
  "402917554", "470665348", "439018290",
  "482214100", "402918013", "433202210",
] as const;

/** Where on a page the three ads go, counted among every tile on it. */
export const AD_POSITIONS = [1, 6, 10] as const;

/** The ads for page `page` of the results for `query`. */
export function sponsoredFor(query: string, page: number): Product[] {
  const ads = AD_POOL.map((id) => findProduct(id)!.product).filter((product) => matchesQuery(product, query));
  return ads.slice((page - 1) * AD_POSITIONS.length, page * AD_POSITIONS.length);
}
