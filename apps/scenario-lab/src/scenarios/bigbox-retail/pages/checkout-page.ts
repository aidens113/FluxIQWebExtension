import { escapeHtml } from "../../../html.js";
import type { RenderContext } from "../../../types.js";
import { formatMoney, SITE_ROOT, storeById } from "../catalog/index.js";
import { cartTotals, describeLine } from "../cart/index.js";
import { checkoutScript } from "../client/index.js";
import type { BigboxState } from "../types.js";
import { elementId } from "../theme/index.js";
import { renderShell } from "../shell/index.js";
import type { BigboxClasses } from "../theme/index.js";

const field = (c: BigboxClasses, id: string, label: string, name: string, type: string, autocomplete: string) =>
  `<div class="${c.field}"><label class="${c.label}" for="${id}">${label}</label><input class="${c.input}" id="${id}" name="${name}" type="${type}" autocomplete="${autocomplete}"></div>`;

function signInWall(state: BigboxState, context: RenderContext, c: BigboxClasses): string {
  const error = state.checkoutError === "" ? "" : `<p class="${c.errorBanner}" role="alert">${escapeHtml(state.checkoutError)}</p>`;
  return `<div class="${c.wall}"><div class="${c.wallCard}"><h1>Sign in or create your account</h1>${error}
${field(c, elementId(context.seed, "wall-email"), "Email address", "email", "email", "username")}
${field(c, elementId(context.seed, "wall-password"), "Password", "password", "password", "current-password")}
<button type="button" class="${c.btn} ${c.btnPrimary}">Continue</button>
<p>New to ValueRidge? <a href="#">Create an account</a></p><hr><small><a href="#" class="${c.btnLink}">Continue without an account</a></small></div></div>`;
}

function guestCheckout(state: BigboxState, context: RenderContext, c: BigboxClasses): string {
  const store = storeById(state.storeId);
  const lines = state.express ? [state.express] : state.cart;
  const totals = cartTotals(lines, state.storeId);
  const id = (name: string) => elementId(context.seed, name);
  const items = lines.map(describeLine).filter((view) => view !== undefined).map((view) => `<li class="${c.orderItem}"><span>${view.line.qty} × ${escapeHtml(view.title)}</span><span>${formatMoney(view.totalCents)}</span></li>`).join("");
  const error = state.checkoutError === "" ? "" : `<p class="${c.errorBanner}" role="alert">${escapeHtml(state.checkoutError)}</p>`;
  return `<h1>Checkout</h1>${error}<div class="${c.checkoutLayout}"><div>
<section class="${c.section}"><h2 class="${c.sectionHead}">1. Pickup details</h2><p>Pickup at <b>${escapeHtml(store.name)}</b>, ${escapeHtml(store.address)}</p><div></div></section>
<section class="${c.section}"><h2 class="${c.sectionHead}">2. Contact info</h2><div class="${c.fieldRow}">${field(c, id("first"), "First name", "firstName", "text", "given-name")}${field(c, id("last"), "Last name", "lastName", "text", "family-name")}</div>
${field(c, id("email"), "Email address", "email", "email", "email")}${field(c, id("phone"), "Phone number", "phone", "tel", "tel")}
<div class="${c.hp}" aria-hidden="true"><label for="${id("website")}">Company website</label><input id="${id("website")}" name="company_website" type="text" tabindex="-1" autocomplete="off"></div></section>
<section class="${c.section}"><h2 class="${c.sectionHead}">3. Payment method</h2><label class="${c.paymentOption}"><input type="radio" name="payment" value="card" checked> Credit or debit card</label>
<iframe class="${c.paymentFrame}" title="Secure card entry" src="${context.alternateOrigin ?? ""}${SITE_ROOT}checkout/payment-frame"></iframe>
<label class="${c.paymentOption}"><input type="radio" name="payment" value="pickup"> Pay at pickup</label></section></div>
<aside class="${c.summaryCard}"><h2>Order summary</h2><ul class="${c.orderItems}">${items}</ul><div class="${c.summaryRow}"><span>Subtotal</span><span>${formatMoney(totals.subtotalCents)}</span></div><div class="${c.summaryRow}"><span>Estimated tax</span><span>${formatMoney(totals.taxCents)}</span></div><div class="${c.summaryTotal}"><span>Total</span><span>${formatMoney(totals.totalCents)}</span></div><button type="button" class="${c.placeOrder}">Place order</button><p><small>By placing your order, you agree to ValueRidge's Terms of Use and Privacy Notice.</small></p></aside></div>`;
}

/**
 * Checkout, in one of two states. Until the shopper continues without an
 * account it is a sign-in wall, and the way past it for anyone without an
 * account is the small link at the bottom. As a guest it is the pickup time,
 * contact details, payment and the order summary. The contact section holds
 * one more field than a person can see.
 */
export function renderCheckoutPage(state: BigboxState, context: RenderContext): string {
  return renderShell({
    state, context, kind: "checkout", title: "Checkout",
    main: (c) => (state.checkout === "guest" ? guestCheckout(state, context, c) : signInWall(state, context, c)),
    script: () => checkoutScript({ guest: state.checkout === "guest", ordersBefore: state.orders.length }),
  });
}
