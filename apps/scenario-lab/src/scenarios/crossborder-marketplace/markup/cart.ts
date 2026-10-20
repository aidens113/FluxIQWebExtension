import { escapeHtml } from "../../../html.js";
import type { RenderContext } from "../../../types.js";
import { listingById, skuText, storeById } from "../catalog/index.js";
import { cartAddOnsScript, cartScript } from "../client/index.js";
import { formatMoney } from "../locale/index.js";
import { linesByStore, lineUnitCents, type CartLine, type MarketState } from "../state/index.js";
import type { MarketClasses } from "../styles/index.js";
import { itemHref, MARKET_ROOT } from "./links.js";
import { marketDocument } from "./shell.js";

/**
 * The cart: lines grouped by store, each with a round tick, its options, its
 * price and a quantity stepper, and a summary that checks out the ticked
 * lines. Every line starts ticked.
 *
 * The rebuilt cart (`cart-add-ons`) draws each line with `addOnsCartLine`
 * instead, starts with nothing selected, and runs `cartAddOnsScript`; the rest
 * of the page is the same.
 */
export function renderCartPage(state: MarketState, context: RenderContext, c: MarketClasses): string {
  const groups = linesByStore(state.cart);
  const subtotal = state.cart.reduce((sum, line) => sum + lineUnitCents(line) * line.quantity, 0);
  const addOns = state.mode === "cart-add-ons";
  const lines = groups.map((group) => `<div class="${c.cartStore}"><b>${escapeHtml(storeById(group.storeId).name)}</b>${group.lines.map((line) => {
    if (addOns) return addOnsCartLine(line, state, c);
    const listing = listingById(line.listingId)!;
    return `<div class="${c.cartLine}"><div class="${c.cartCheck}" style="background:#e62e04;border-color:#e62e04"></div><img src="${MARKET_ROOT}img/${listing.id}.svg" alt="" width="80" height="80"><div><a href="${itemHref(listing.id)}">${escapeHtml(listing.title)}</a><div class="${c.stockNote}">${escapeHtml(skuText(line.choice))}</div></div><div><b>${escapeHtml(formatMoney(lineUnitCents(line), state.region))}</b></div><div class="${c.qtyRow}"><div class="${c.qtyButton}">−</div><span>${line.quantity}</span><div class="${c.qtyButton}">+</div><span title="Remove" style="cursor:pointer;margin-left:8px">🗑</span></div></div>`;
  }).join("")}</div>`).join("");
  const body = state.cart.length === 0
    ? `<div class="${c.panel}" style="text-align:center;padding:48px"><div class="${c.panelTitle}">Your cart is empty</div><p>Browse today's deals and add something you like.</p><a class="${c.btn} ${c.btnPrimary}" href="${MARKET_ROOT}">Start shopping</a></div>`
    : `<div class="${c.cartLayout}"><div><div class="${c.panelTitle}">Cart (${state.cart.reduce((sum, line) => sum + line.quantity, 0)})</div>${lines}</div><div class="${c.cartSummary}"><div class="${c.panelTitle}">Summary</div><div class="${c.summaryRow}"><span>Subtotal</span><span>${escapeHtml(formatMoney(subtotal, state.region))}</span></div><div class="${c.stockNote}">Store coupons and shipping are applied at checkout.</div><div class="${c.placeOrder}">Checkout (${addOns ? 0 : state.cart.length})</div></div></div>`;
  const pageData = addOns ? addOnsPageData(groups) : { lines: state.cart.map((line) => ({ id: line.id, quantity: line.quantity })) };
  const script = addOns ? cartAddOnsScript() : cartScript();
  return marketDocument({ state, context, c, kind: "cart", title: "Shopping Cart - Farbazaar", body, pageScript: `const pageData = ${JSON.stringify(pageData)};\n${script}` });
}

/** The rebuilt cart's lines in the order the page draws them, grouped by store, each with its store's name for the cart's notes. */
function addOnsPageData(groups: ReturnType<typeof linesByStore>): { lines: Array<{ id: string; quantity: number; store: string }> } {
  return { lines: groups.flatMap((group) => group.lines.map((line) => ({ id: line.id, quantity: line.quantity, store: storeById(group.storeId).name }))) };
}

/** What each add-on costs, in euro cents, before the region's currency. */
const ADD_ONS = [
  { name: "giftWrap", label: "Gift wrap", cents: 150 },
  { name: "warranty", label: "2-year extended warranty", cents: 499 },
  { name: "insurance", label: "Shipping insurance", cents: 99 },
] as const;

/**
 * One cart line as the rebuilt cart (`cart-add-ons`) draws it: a native
 * Select box where the round tick stood, starting unselected, and the line's
 * add-on boxes under its options, with a status line the cart writes to when
 * it takes one back. The line's price and quantity stepper are the baseline's.
 */
function addOnsCartLine(line: CartLine, state: MarketState, c: MarketClasses): string {
  const listing = listingById(line.listingId)!;
  const title = escapeHtml(listing.title);
  const addOns = ADD_ONS.map(({ name, label, cents }) => `<label style="display:flex;gap:6px;align-items:center;cursor:pointer"><input type="checkbox" name="${name}" value="${line.id}">${escapeHtml(label)} · ${escapeHtml(formatMoney(cents, state.region))}</label>`).join("");
  const select = `<input type="checkbox" name="select" value="${line.id}" aria-label="Select ${title}" style="width:18px;height:18px;margin:0;accent-color:#e62e04;cursor:pointer">`;
  const extras = `<fieldset style="border:0;padding:0;margin:8px 0 0;display:grid;gap:4px"><legend style="padding:0;font-size:12px;color:#666">Add-ons</legend>${addOns}<div class="${c.stockNote}" role="status"></div></fieldset>`;
  return `<div class="${c.cartLine}">${select}<img src="${MARKET_ROOT}img/${listing.id}.svg" alt="" width="80" height="80"><div><a href="${itemHref(listing.id)}">${title}</a><div class="${c.stockNote}">${escapeHtml(skuText(line.choice))}</div>${extras}</div><div><b>${escapeHtml(formatMoney(lineUnitCents(line), state.region))}</b></div><div class="${c.qtyRow}"><div class="${c.qtyButton}">−</div><span>${line.quantity}</span><div class="${c.qtyButton}">+</div><span title="Remove" style="cursor:pointer;margin-left:8px">🗑</span></div></div>`;
}
