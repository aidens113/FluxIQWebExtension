import { escapeHtml } from "../../html.js";
import { addressesFor } from "./mutate.js";
import { formatAddress, formatMoney, storefrontOrder } from "./order.js";
import type { CheckoutStep, StorefrontCheckoutState } from "./state.js";
import { styleClass as cx } from "./styles.js";

/** Where each step sits in the accordion, and what its header says. */
const STEPS: { id: Exclude<CheckoutStep, "confirmed">; number: number; title: string }[] = [
  { id: "cart", number: 1, title: "Review your bag" },
  { id: "address", number: 2, title: "Delivery address" },
  { id: "delivery", number: 3, title: "Delivery speed" },
  { id: "payment", number: 4, title: "Payment" },
];

/**
 * The four-step accordion. Every step is in the document from the first load
 * with its body collapsed, which is how a real accordion checkout is built and
 * why the payment iframe is embedded -- and loading -- long before the shopper
 * reaches it.
 */
export function renderCheckoutSteps(state: StorefrontCheckoutState, paymentFrameSrc: string): string {
  return STEPS.map(step => {
    const open = state.step === step.id;
    const complete = isComplete(state, step.id);
    return `<section class="${cx.step}" data-testid="step-${step.id}" aria-labelledby="step-${step.id}-title">
      <div class="${cx.stepHead}">
        <h2 id="step-${step.id}-title">${step.number}. ${step.title}</h2>
        ${complete ? `<span class="${cx.stepDone}" data-testid="step-${step.id}-done">Complete</span>` : ""}
      </div>
      <div class="${cx.stepBody}" data-testid="step-${step.id}-body"${open ? "" : " hidden"}>${stepBody(state, step.id, paymentFrameSrc)}</div>
    </section>`;
  }).join("\n");
}

function isComplete(state: StorefrontCheckoutState, step: Exclude<CheckoutStep, "confirmed">): boolean {
  const order: CheckoutStep[] = ["cart", "address", "delivery", "payment", "confirmed"];
  return order.indexOf(state.step) > order.indexOf(step);
}

function stepBody(state: StorefrontCheckoutState, step: Exclude<CheckoutStep, "confirmed">, paymentFrameSrc: string): string {
  if (step === "cart") return cartBody(state);
  if (step === "address") return addressBody(state);
  if (step === "delivery") return deliveryBody(state);
  return paymentBody(state, paymentFrameSrc);
}

function cartBody(state: StorefrontCheckoutState): string {
  const lines = storefrontOrder.items.map((item, index) => `<div class="${cx.lineItem}" data-testid="bag-line-${index + 1}">
        <div class="${cx.thumb}" aria-hidden="true"></div>
        <div>
          <strong>${escapeHtml(item.name)}</strong>
          <div class="${cx.hint}">${escapeHtml(item.option)} &middot; ${escapeHtml(item.sku)}</div>
          <label class="${cx.hint}">Qty
            <select data-testid="bag-quantity-${index + 1}" name="quantity-${item.sku}">
              ${[1, 2, 3, 4].map(value => `<option value="${value}"${value === item.quantity ? " selected" : ""}>${value}</option>`).join("")}
            </select>
          </label>
        </div>
        <div class="${cx.hint}">${formatMoney(item.unitCents * item.quantity)}</div>
      </div>`).join("\n");
  // No `autocomplete` on the gift-card number. Card-shaped fields on the
  // periphery of a checkout -- gift cards, store credit, loyalty numbers --
  // are routinely shipped unmarked, and an unmarked one is the case a
  // redaction rule keyed to `autocomplete` cannot see.
  return `<div class="${cx.wallets}" data-testid="express-checkout">
        <button type="button" class="${cx.quietButton}" data-testid="wallet-cascade-pay">Cascade Pay</button>
        <button type="button" class="${cx.quietButton}" data-testid="wallet-bank">Pay by bank</button>
        <span class="${cx.hint}">or check out with a card below</span>
      </div>
      ${lines}
      <div data-testid="gift-card">
        <label class="${cx.field}" for="gift-card-number">Gift card number
          <input id="gift-card-number" data-testid="gift-card-number" name="giftCardNumber" type="text" inputmode="numeric" maxlength="19" placeholder="0000 0000 0000 0000">
        </label>
        <button type="button" class="${cx.quietButton}" data-testid="gift-card-apply">Apply gift card</button>
        <p class="${cx.notice}" data-testid="gift-card-status" role="status"></p>
      </div>
      <div data-testid="promotion">
        <label class="${cx.field}" for="promo-code">Promotion code
          <input id="promo-code" data-testid="promo-code" name="promoCode" type="text" autocomplete="off" maxlength="24">
        </label>
        <button type="button" class="${cx.quietButton}" data-testid="apply-promotion">Apply</button>
        <p class="${cx.notice}" data-testid="promotion-status" role="status">${escapeHtml(state.status.promotion)}</p>
      </div>
      <div class="${cx.actions}">
        <button type="button" class="${cx.primaryButton}" data-testid="continue-to-address">Continue to delivery</button>
      </div>`;
}

function addressBody(state: StorefrontCheckoutState): string {
  const chosen = addressesFor(state.address.postcode).find(entry => entry.id === state.address.chosenId);
  // The password field is `type="password"`, the one marking every sensitivity
  // rule agrees on. It is here so the page carries the marked case beside the
  // unmarked ones rather than only the exotic spellings.
  return `<label class="${cx.field}" for="address-name">Full name
        <input id="address-name" data-testid="address-name" name="name" type="text" autocomplete="name">
      </label>
      <label class="${cx.field}" for="address-email">Email for order updates
        <input id="address-email" data-testid="address-email" name="email" type="email" autocomplete="email">
      </label>
      <label class="${cx.field}" for="postcode">ZIP code
        <input id="postcode" data-testid="postcode" name="postalCode" type="text" autocomplete="postal-code" maxlength="12">
      </label>
      <button type="button" class="${cx.quietButton}" data-testid="find-address">Find address</button>
      <p class="${cx.notice}" data-testid="address-lookup-status" role="status">${escapeHtml(lookupStatus(state))}</p>
      ${suggestionList(state)}
      <p class="${cx.notice}" data-testid="address-chosen">${chosen ? escapeHtml(formatAddress(chosen, state.address.postcode)) : "No address chosen"}</p>
      <fieldset data-testid="account-signup">
        <legend>Create an account for faster checkout</legend>
        <label class="${cx.field}" for="account-password">Choose a password
          <input id="account-password" data-testid="account-password" name="password" type="password" autocomplete="new-password">
        </label>
        <p class="${cx.hint}">At least 8 characters. We will email a link to confirm it.</p>
      </fieldset>
      <div class="${cx.alert}" data-testid="address-validation" role="alert" hidden>Choose a delivery address before continuing.</div>
      <div class="${cx.actions}">
        <button type="button" class="${cx.primaryButton}" data-testid="continue-to-delivery">Continue to delivery speed</button>
      </div>`;
}

function lookupStatus(state: StorefrontCheckoutState): string {
  if (state.address.lookups === 0) return "";
  if (state.address.suggestionIds.length === 0) return `No addresses found for ${state.address.postcode}`;
  return `${state.address.suggestionIds.length} addresses found for ${state.address.postcode}`;
}

/**
 * Rendered only once a lookup has answered. The client rebuilds this list from
 * the same address book after its own lookup, so the markup a reload produces
 * and the markup a lookup produces are the same shape.
 */
function suggestionList(state: StorefrontCheckoutState): string {
  const entries = addressesFor(state.address.postcode).filter(entry => state.address.suggestionIds.includes(entry.id));
  if (entries.length === 0) return "";
  const options = entries.map((entry, index) => `<li><button type="button" data-testid="address-option-${index + 1}" data-address-id="${entry.id}">${escapeHtml(formatAddress(entry, state.address.postcode))}</button></li>`).join("");
  return `<ul class="${cx.suggestions}" data-testid="address-suggestions">${options}</ul>`;
}

function deliveryBody(state: StorefrontCheckoutState): string {
  const options = storefrontOrder.deliveryOptions.map(option => `<label class="${cx.field}">
        <input type="radio" name="deliveryOption" value="${option.id}" data-testid="${option.testId}"${option.id === state.delivery.optionId ? " checked" : ""}>
        ${escapeHtml(option.label)} - ${formatMoney(option.costCents)}
        <span class="${cx.hint}">${escapeHtml(option.detail)}</span>
      </label>`).join("\n");
  const chosen = storefrontOrder.deliveryOptions.find(option => option.id === state.delivery.optionId);
  return `<p class="${cx.hint}" data-testid="delivery-recap">Delivering to ZIP ${escapeHtml(state.address.postcode || "not set")}</p>
      ${options}
      <p class="${cx.notice}" data-testid="delivery-cost-status" role="status">${escapeHtml(state.status.deliveryOption)}</p>
      ${chosen ? `<p class="${cx.notice}" data-testid="delivery-estimate">${escapeHtml(state.status.deliveryEstimate)}</p>` : ""}
      <div class="${cx.actions}">
        <button type="button" class="${cx.primaryButton}" data-testid="continue-to-payment"${chosen ? "" : " disabled"}>Continue to payment</button>
      </div>`;
}

function paymentBody(state: StorefrontCheckoutState, paymentFrameSrc: string): string {
  const declined = state.payment.outcome === "declined";
  return `<p class="${cx.hint}">Card details are handled by our payment provider, so this store never receives them.</p>
      <ul class="${cx.brands}" data-testid="accepted-cards"><li>Visa</li><li>Mastercard</li><li>Amex</li><li>Discover</li></ul>
      <iframe title="Secure card payment" data-testid="payment-frame" src="${escapeHtml(paymentFrameSrc)}" width="100%" height="430" frameborder="0"></iframe>
      <div class="${cx.alert}" data-testid="payment-decline-notice" role="alert"${declined ? "" : " hidden"}>${escapeHtml(state.status.payment)}</div>
      <label class="${cx.field}"><input type="checkbox" data-testid="billing-same" name="billingSameAsDelivery" checked> Billing address is the same as my delivery address</label>
      <p class="${cx.hint}" data-testid="payment-total">Your card will be charged ${formatMoney(state.totals.totalCents)}.</p>`;
}
