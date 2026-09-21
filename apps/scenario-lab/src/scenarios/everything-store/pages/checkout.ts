import { escapeHtml } from "../../../html.js";
import { CATALOG, STORE_PATHS, formatMoney } from "../catalog/index.js";
import { checkoutScript } from "../client/index.js";
import { ACCOUNT, orderTotals, type AddressId, type CheckoutSession, type DeliveryOptionId } from "../state/index.js";
import type { PageKit } from "./page-kit.js";
import { storePage } from "./shell.js";

function lineMarkup(kit: PageKit, line: CheckoutSession["lines"][number]): string {
  const product = CATALOG.bySku(line.sku);
  const seller = line.offerId === null ? product?.seller ?? "" : CATALOG.offer(line.offerId)?.seller ?? "";
  return `<li class="${kit.css.optionRow}"><b>${escapeHtml(product?.title ?? line.sku)}</b><br>${formatMoney(line.unitCents)} &middot; Qty: ${line.quantity} &middot; Sold by: ${escapeHtml(seller)}</li>`;
}

/**
 * Checkout, as the store opens it: on its own preferences rather than the
 * shopper's. Delivery is preset to Brightaisle Day, which is free and two
 * days later than standard; the Plus free trial is ticked, and becomes a
 * monthly charge after thirty days. Payment is chosen inside a frame. "Place
 * your order" appears twice, and both place it.
 */
export function renderCheckoutPage(kit: PageKit): string {
  const { css, ids, state } = kit;
  const session = state.checkout;
  if (!session) {
    return storePage(kit, {
      title: "Checkout",
      body: `<div class="${css.section}"><h1>Your checkout session has ended</h1><p>Nothing was ordered. <a href="${STORE_PATHS.cart}">Return to your cart</a>.</p></div>`,
      script: "",
    });
  }
  const totals = orderTotals(session);
  const option = ACCOUNT.delivery[session.delivery];
  const addresses = (Object.keys(ACCOUNT.addresses) as AddressId[]).map((id) => `<li class="${css.optionRow}"><label><input type="radio" name="address" value="${id}"${id === session.addressId ? " checked" : ""}> ${escapeHtml(ACCOUNT.addresses[id].line)}</label></li>`).join("");
  const deliveries = (Object.keys(ACCOUNT.delivery) as DeliveryOptionId[]).map((id) => {
    const entry = ACCOUNT.delivery[id];
    const cost = entry.costCents === 0 ? "" : ` &middot; ${formatMoney(entry.costCents)}`;
    return `<li class="${css.optionRow}"><label><input type="radio" name="delivery" value="${id}"${id === session.delivery ? " checked" : ""}> <b>${escapeHtml(entry.date.long)}</b> &mdash; ${escapeHtml(entry.label)}${cost}</label>${entry.note ? `<br><small>${escapeHtml(entry.note)}</small>` : ""}</li>`;
  }).join("");
  const place = `<button type="button" class="${css.placeButton}" data-action="place-order">Place your order</button>`;
  const body = `<h1>Checkout (${totals.itemCount} ${totals.itemCount === 1 ? "item" : "items"})</h1>
<div class="${css.checkoutLayout}">
<div>
<section class="${css.section}" aria-labelledby="ship-heading"><div class="${css.sectionHead}"><h2 id="ship-heading">Delivering to ${escapeHtml(ACCOUNT.name)}</h2><span class="${css.changeLink} ${css.linkish}" data-action="change-address" tabindex="0">Change</span></div>
<p>${escapeHtml(ACCOUNT.addresses[session.addressId].line)}</p>
<div id="${ids.addressList}" hidden><ul class="${css.optionList}">${addresses}</ul><button type="button" class="${css.button}" data-action="use-address">Deliver to this address</button></div></section>
<section class="${css.section}" aria-labelledby="pay-heading"><div class="${css.sectionHead}"><h2 id="pay-heading">Paying with ${escapeHtml(ACCOUNT.payments[session.paymentId].replace(" ending in", ""))}</h2><span class="${css.changeLink} ${css.linkish}" data-action="change-payment" tabindex="0">Change</span></div>
<p>${escapeHtml(ACCOUNT.payments[session.paymentId])}</p>
<iframe class="${css.paymentFrame}" id="${ids.paymentFrame}" title="Payment methods" src="${STORE_PATHS.paymentFrame}" hidden></iframe>
<p><input type="checkbox" id="${ids.giftCard}"${session.giftCard ? " checked" : ""}> <label for="${ids.giftCard}">Use your ${formatMoney(ACCOUNT.giftCardCents)} Brightaisle gift card balance</label></p></section>
<section class="${css.section}" aria-labelledby="arrive-heading"><h2 id="arrive-heading">Arriving ${escapeHtml(option.date.long)}</h2>
<ul class="${css.optionList}">${session.lines.map((line) => lineMarkup(kit, line)).join("")}</ul>
<fieldset><legend>Choose your delivery option:</legend><ul class="${css.optionList}">${deliveries}</ul></fieldset></section>
<section class="${css.upsell}"><p><strong>Get FREE One-Day Delivery on this order</strong></p><input type="checkbox" id="${ids.plusTrial}"${session.plusTrial ? " checked" : ""}> <label for="${ids.plusTrial}">Yes, start my 30-day FREE Brightaisle Plus trial. After the trial, Plus is ${formatMoney(ACCOUNT.plusMonthlyCents)}/month. Cancel anytime.</label></section>
<p>${place} By placing your order, you agree to Brightaisle's privacy notice and conditions of use.</p>
</div>
<aside class="${css.summary}">${place}
<div class="${css.summaryRow}"><span>Items (${totals.itemCount}):</span><span>${formatMoney(totals.itemsCents)}</span></div>
<div class="${css.summaryRow}"><span>Shipping &amp; handling:</span><span>${formatMoney(totals.deliveryCents)}</span></div>
${totals.giftCents === 0 ? "" : `<div class="${css.summaryRow}"><span>Gift card balance:</span><span>-${formatMoney(totals.giftCents)}</span></div>`}
<div class="${css.summaryRow}"><span>Total before tax:</span><span>${formatMoney(totals.totalCents)}</span></div>
<div class="${css.summaryRow}"><span>Estimated tax to be collected:</span><span>${formatMoney(totals.taxCents)}</span></div>
<div class="${css.summaryTotal}"><span>Order total:</span><span>${formatMoney(totals.totalCents)}</span></div>
</aside>
</div>`;
  return storePage(kit, { title: "Brightaisle.com Checkout", body, script: checkoutScript(css, ids) });
}
