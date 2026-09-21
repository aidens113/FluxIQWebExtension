import { escapeHtml } from "../../../html.js";
import type { RenderContext } from "../../../types.js";
import { PRODUCTS } from "../catalog/index.js";
import type { BigboxState } from "../types.js";
import { renderShell } from "../shell/index.js";
import { listingMarkup, tileDefaultsFor } from "../listing/index.js";

/** A seller's storefront, which a product page opens in a new tab. */
export function renderSellerPage(state: BigboxState, context: RenderContext, seller: string): string {
  const listings = PRODUCTS.filter((product) => product.seller === seller);
  const marketplace = seller !== "ValueRidge";
  return renderShell({
    state, context, kind: "seller", title: seller,
    tileDefaults: tileDefaultsFor(listings, state.storeId),
    main: (c) => `<h1>${escapeHtml(seller)}</h1><p>${marketplace ? "Marketplace seller · Ships from the seller's own warehouse · Returns accepted within 30 days" : "Sold and shipped by ValueRidge · Free pickup at any store"}</p><p>${marketplace ? "94% positive feedback over the last 12 months" : ""}</p><section class="${c.rail}"><div class="${c.railHead}"><h2>Items from this seller</h2></div><ul class="${c.railList}">${listings.map((product) => listingMarkup(product, state.storeId, c, "rail")).join("")}</ul></section>`,
  });
}
