import { escapeHtml } from "../../../../html.js";
import { EARBUDS, HOUSEHOLD, STORE_PATHS, formatMoney, type Product } from "../../catalog/index.js";
import { cartScript } from "../../client/index.js";
import type { PageKit } from "../page-kit.js";
import { storePage } from "../shell.js";
import { cartMainMarkup } from "./main.js";
import { cartSubtotalText } from "./subtotal.js";

/** Products the cart page recommends, each with its own add button. */
function recommendations(kit: PageKit): string {
  const { css } = kit;
  const products: readonly Product[] = [HOUSEHOLD.teaSampler, HOUSEHOLD.descaler, EARBUDS[17] ?? HOUSEHOLD.batteries];
  return `<section class="${css.fbt}" aria-labelledby="also-bought"><h2 id="also-bought">Customers who bought items in your cart also bought</h2><div class="${css.savedGrid}">${products.map((product) =>
    `<div class="${css.savedItem}"><a href="${STORE_PATHS.product(product)}"><img src="${STORE_PATHS.image(product.sku)}" alt="" width="90" height="90"><span>${escapeHtml(product.title)}</span></a><p>${formatMoney(product.priceCents)}</p><button type="button" class="${css.buttonSmall}" data-add-sku="${product.sku}">Add to cart</button></div>`).join("")}</div></section>`;
}

/**
 * The cart page. The subtotal appears twice, once under the lines and once
 * beside the checkout button, and only the one under the lines is kept up to
 * date without a reload.
 */
export function renderCartPage(kit: PageKit): string {
  const { css } = kit;
  const subtotal = cartSubtotalText(kit.state);
  const body = `<div class="${css.cartLayout}">
<div data-cart-root>${cartMainMarkup(kit)}</div>
<aside class="${css.cartAside}"><p>${escapeHtml(subtotal)}</p><p><label><input type="checkbox"> This order contains a gift</label></p>
<button type="button" class="${css.button} ${css.buttonPrimary}" data-action="proceed">Proceed to checkout</button>
<p class="${css.rowError}" data-checkout-error hidden>Select at least one item to continue to checkout.</p></aside>
</div>
${recommendations(kit)}`;
  return storePage(kit, { title: "Brightaisle.com Shopping Cart", body, script: cartScript(css) });
}
