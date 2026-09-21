import { escapeHtml } from "../../../html.js";
import type { RenderContext } from "../../../types.js";
import { findProduct, formatMoney, storeById } from "../catalog/index.js";
import { cartTotals, describeLine, type LineView } from "../cart/index.js";
import type { BigboxState, CartLine } from "../types.js";
import { productHref } from "../listing/index.js";
import { renderShell } from "../shell/index.js";
import type { BigboxClasses } from "../theme/index.js";
import { listingMarkup, tileDefaultsFor } from "../listing/index.js";

const TOGETHER = ["418831402", "433202210", "402917655", "418832007"];
const GROUPS = [
  { method: "pickup", heading: (store: string) => `Pickup at ${store}` },
  { method: "delivery", heading: (store: string) => `Delivery from ${store}` },
  { method: "shipping", heading: () => "Shipping" },
] as const;

function lineMarkup(view: LineView, c: BigboxClasses, saved: boolean): string {
  const options = Array.from({ length: 12 }, (_, index) => index + 1).map((qty) => `<option value="${qty}"${qty === view.line.qty ? " selected" : ""}>${qty}</option>`).join("");
  const actions = saved
    ? `<button type="button" class="${c.btnLink}">Move to cart</button><button type="button" class="${c.btnLink}">Remove</button>`
    : `<label>Qty <select class="${c.qtySelect}">${options}</select></label><button type="button" class="${c.btnLink}">Remove</button><button type="button" class="${c.btnLink}">Save for later</button>`;
  return `<div class="${c.cartLine}"><div class="${c.cartLineMain}"><a href="${productHref(view.product, view.variant.sku)}">${escapeHtml(view.title)}</a><span>Sold and shipped by ${escapeHtml(view.product.seller)}</span><span>${formatMoney(view.unitCents)} each</span><div class="${c.cartLineActions}">${actions}</div></div><strong>${formatMoney(view.totalCents)}</strong></div>`;
}

const views = (lines: readonly CartLine[]) => lines.map(describeLine).filter((view) => view !== undefined);

/**
 * The cart: lines grouped by how they will be fulfilled, a Saved for later
 * list, the order summary, and the checkout bar pinned to the bottom of the
 * window. The lines draw a moment after load, behind "Loading your cart".
 * Every control on a line is a button styled as a link, and each change
 * reloads the page.
 */
export function renderCartPage(state: BigboxState, context: RenderContext): string {
  const store = storeById(state.storeId).name;
  const totals = cartTotals(state.cart, state.storeId);
  const together = TOGETHER.map((id) => findProduct(id)!.product);
  return renderShell({
    state, context, kind: "cart", title: "Cart",
    tileDefaults: tileDefaultsFor(together, state.storeId),
    main: (c) => {
      const groups = GROUPS.map((group) => {
        const lines = views(state.cart.filter((line) => line.fulfilment === group.method));
        return lines.length === 0 ? "" : `<section class="${c.cartGroup}"><div class="${c.cartGroupHead}">${escapeHtml(group.heading(store))}</div>${lines.map((view) => lineMarkup(view, c, false)).join("")}</section>`;
      }).join("");
      const saved = state.saved.length === 0 ? "" : `<section class="${c.savedSection}"><h2>Saved for later (${state.saved.length})</h2>${views(state.saved).map((view) => lineMarkup(view, c, true)).join("")}</section>`;
      const items = state.cart.length === 0 ? `<div class="${c.emptyCart}"><h2>Your cart is empty</h2><a href="/scenarios/bigbox-retail/">Continue shopping</a></div>` : groups;
      const summary = `<aside class="${c.summaryCard}"><div class="${c.summaryRow}"><span>Subtotal (${totals.itemCount} ${totals.itemCount === 1 ? "item" : "items"})</span><span>${formatMoney(totals.subtotalCents)}</span></div><div class="${c.summaryRow}"><span>Estimated taxes</span><span>${formatMoney(totals.taxCents)}</span></div><div class="${c.summaryTotal}"><span>Estimated total</span><span>${formatMoney(totals.totalCents)}</span></div></aside>`;
      const bar = state.cart.length === 0 ? "" : `<div class="${c.checkoutBar}"><span>Estimated total <b>${formatMoney(totals.totalCents)}</b></span><button type="button" class="${c.btn} ${c.btnPrimary}" style="width:260px;height:48px">Continue to checkout</button></div>`;
      return `<h1>Cart <small>(${totals.itemCount} ${totals.itemCount === 1 ? "item" : "items"})</small></h1><div class="${c.skeleton}">Loading your cart&hellip;</div>
<div class="${c.cartLayout}" hidden><div>${items}${saved}</div>${summary}</div>
<section class="${c.rail}"><div class="${c.railHead}"><h2>Frequently bought together</h2></div><ul class="${c.railList}">${together.map((product) => listingMarkup(product, state.storeId, c, "rail")).join("")}</ul></section>${bar}`;
    },
    script: (c) => `{
  const IN_ORDER = ${JSON.stringify(GROUPS.flatMap((group) => state.cart.filter((line) => line.fulfilment === group.method).map((line) => line.lineId)))};
  const SAVED = ${JSON.stringify(state.saved.map((line) => line.lineId))};
  setTimeout(() => { one(C.skeleton).remove(); one(C.cartLayout).hidden = false; }, 500);
  const change = async (operation, payload) => { await mutate(operation, payload); location.reload(); };
  all(C.cartGroup).flatMap((group) => all(C.cartLine, group)).forEach((node, index) => {
    const lineId = IN_ORDER[index];
    node.querySelector('select').addEventListener('change', (event) => change('update-qty', { lineId, qty: Number(event.target.value) }));
    const [remove, save] = node.querySelectorAll('button');
    remove.addEventListener('click', () => change('remove-line', { lineId }));
    save.addEventListener('click', () => change('save-for-later', { lineId }));
  });
  const savedSection = one(C.savedSection);
  if (savedSection) all(C.cartLine, savedSection).forEach((node, index) => {
    const [move, remove] = node.querySelectorAll('button');
    move.addEventListener('click', () => change('move-to-cart', { lineId: SAVED[index] }));
    remove.addEventListener('click', () => change('remove-line', { lineId: SAVED[index] }));
  });
  const bar = one(C.checkoutBar);
  if (bar) bar.querySelector('button').addEventListener('click', () => { location.href = ROOT + 'checkout'; });
}`,
  });
}
