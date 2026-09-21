import type { AdPlacement, Product } from "./types.js";

const BASE = "/scenarios/everything-store";

/**
 * Every address the store serves, in the shapes its links use. A product's
 * address carries its slug before the id, as the store's product URLs do; the
 * store also answers the bare `/dp/<id>` form. A sponsored card never links to
 * the product itself: it links to the ad server's click redirect, which
 * records the click and then sends the browser on.
 */
export const STORE_PATHS = {
  base: BASE,
  home: `${BASE}/`,
  search: `${BASE}/s`,
  searchMore: `${BASE}/s/more`,
  cart: `${BASE}/cart`,
  checkout: `${BASE}/checkout`,
  paymentFrame: `${BASE}/checkout/payment-frame`,
  product: (product: Pick<Product, "slug" | "sku">) => `${BASE}/${product.slug}/dp/${product.sku}`,
  image: (sku: string) => `${BASE}/img/${sku}.svg`,
  thankYou: (orderId: string) => `${BASE}/thankyou?orderId=${encodeURIComponent(orderId)}`,
  sponsored: (ad: AdPlacement) => `${BASE}/sspa/click?ie=UTF8&adId=${encodeURIComponent(ad.adId)}&url=${encodeURIComponent(`${BASE}/${ad.product.slug}/dp/${ad.product.sku}`)}`,
} as const;
