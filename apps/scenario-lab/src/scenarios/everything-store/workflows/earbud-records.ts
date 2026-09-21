import { STORE_PATHS, formatMoney, type Product } from "../catalog/index.js";

/**
 * What a person copying a results card into a table writes down: the title,
 * the price as the card prints it, the rating as the number beside the stars,
 * and the address the title links to.
 */
export function earbudRecords(products: readonly Product[]): Array<Record<string, string>> {
  return products.map((product) => ({
    name: product.title,
    price: formatMoney(product.priceCents),
    rating: product.rating.toFixed(1),
    url: STORE_PATHS.product(product),
  }));
}
