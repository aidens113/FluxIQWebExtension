import { applyIdentifierPolicy } from "../../identifier-policy/index.js";
import { escapeHtml, fixtureClient, page } from "../../html.js";
import type { StorefrontCheckoutState } from "./state.js";
import { storefrontStyles, styleClass as cx } from "./styles.js";

/**
 * The card form, served as its own document and embedded in the checkout, the
 * way a hosted payment field set is. It is same-origin here because the
 * Scenario Lab's second port exists for the cross-origin fixture; what this
 * one is for is a frame that genuinely *has* to be driven -- the card fields
 * and the button that spends the money are all inside it, and the effect of
 * pressing that button shows up in the top document.
 *
 * The markings are the ones real card forms carry, including the ones they get
 * wrong:
 *
 * - `autocomplete="cc-number"` on the card number, the spelling every
 *   sensitivity rule is written against;
 * - `autocomplete="billing cc-number"` on the billing card, the ordinary
 *   multi-token spelling, and the one that has leaked a card number twice in
 *   this plan because a rule compared the whole attribute instead of its
 *   tokens;
 * - **nothing at all** on the security code. The spec calls for `cc-csc` and
 *   a great many real forms omit it, partly out of a belief that a CVC should
 *   never be autofilled. A fixture where every sensitive field is conveniently
 *   labelled proves that the labelled case works and nothing else.
 */
export function renderPaymentFrame(state: StorefrontCheckoutState, runToken: string): string {
  const body = `${storefrontStyles}<main style="padding:.75rem">
  <p class="${cx.hint}">Secure payment by Cascade Pay on behalf of Northlake Outfitters</p>
  <label class="${cx.frameField}" for="card-number">Card number
    <input id="card-number" data-testid="card-number" name="cardnumber" type="text" autocomplete="cc-number" inputmode="numeric" maxlength="19" placeholder="0000 0000 0000 0000">
  </label>
  <label class="${cx.frameField}" for="card-name">Name on card
    <input id="card-name" data-testid="card-name" name="ccname" type="text" autocomplete="cc-name">
  </label>
  <div class="${cx.frameRow}">
    <label class="${cx.frameField}" for="card-expiry">Expiry
      <input id="card-expiry" data-testid="card-expiry" name="cc-exp" type="text" autocomplete="cc-exp" inputmode="numeric" maxlength="5" placeholder="MM/YY">
    </label>
    <label class="${cx.frameField}" for="card-security-code">Security code
      <input id="card-security-code" data-testid="card-security-code" name="csc" type="text" inputmode="numeric" maxlength="4" placeholder="CVC">
    </label>
  </div>
  <label class="${cx.frameField}"><input type="checkbox" data-testid="use-different-billing-card" name="differentBillingCard"> Bill a different card</label>
  <div data-testid="billing-card" hidden>
    <label class="${cx.frameField}" for="billing-card-number">Billing card number
      <input id="billing-card-number" data-testid="billing-card-number" name="billingCardNumber" type="text" autocomplete="billing cc-number" inputmode="numeric" maxlength="19">
    </label>
  </div>
  <label class="${cx.frameField}"><input type="checkbox" data-testid="save-card" name="saveCard" checked> Save this card for next time</label>
  <button type="button" class="${cx.primaryButton}" data-testid="pay-now">Pay ${escapeHtml(state.status.total)}</button>
  <div class="${cx.frameError}" data-testid="card-error" role="alert" hidden></div>
  <p class="${cx.hint}" data-testid="card-result" role="status">${escapeHtml(paymentResult(state))}</p>
  <ul class="${cx.brands}" data-testid="frame-assurances">
    <li>Encrypted</li>
    <li>PCI DSS Level 1</li>
    <li>3-D Secure</li>
  </ul>
</main>`;
  // The frame is a second document under the same policy: a card form that
  // kept its test ids while the page around it lost them would be a page no
  // build produces.
  return applyIdentifierPolicy(page("Secure card payment", body, paymentFrameScript(runToken)), state.identifiers);
}

function paymentResult(state: StorefrontCheckoutState): string {
  if (state.payment.outcome === "approved") return "Payment approved";
  if (state.payment.outcome === "declined") return state.status.payment;
  return "";
}

/**
 * The frame decides nothing about the outcome: it posts `submit-payment` with
 * no body and reads the answer back, so the digits typed into it are never
 * transmitted and can never be what makes a run pass or fail.
 */
function paymentFrameScript(runToken: string): string {
  return `${fixtureClient(runToken, "storefront-checkout")}
const byTestId = id => document.querySelector('[data-testid="' + id + '"]');
const REQUIRED = ['card-number', 'card-name', 'card-expiry', 'card-security-code'];

byTestId('use-different-billing-card').addEventListener('change', event => {
  byTestId('billing-card').hidden = !event.target.checked;
});

// The store tells the provider what to charge when the shopper reaches the
// payment step; until then this frame has been loading in a collapsed section.
window.addEventListener('message', event => {
  if (event.origin !== window.location.origin) return;
  const message = event.data;
  if (!message || message.channel !== 'northlake-payments' || message.type !== 'amount') return;
  byTestId('pay-now').textContent = 'Pay ' + message.total;
});

byTestId('pay-now').addEventListener('click', async () => {
  const error = byTestId('card-error');
  const missing = REQUIRED.filter(id => byTestId(id).value.trim() === '');
  if (byTestId('use-different-billing-card').checked && byTestId('billing-card-number').value.trim() === '') missing.push('billing-card-number');
  if (missing.length > 0) {
    error.textContent = 'Check the card details and try again.';
    error.hidden = false;
    return;
  }
  error.hidden = true;
  const snapshot = await mutate('submit-payment');
  const state = snapshot.state;
  const approved = state.payment.outcome === 'approved';
  byTestId('card-result').textContent = approved ? 'Payment approved' : state.status.payment;
  if (!approved) {
    error.textContent = state.status.payment;
    error.hidden = false;
  }
  byTestId('pay-now').disabled = approved;
  window.parent.postMessage({ channel: 'northlake-payments', type: 'result', outcome: state.payment.outcome, reference: approved ? state.order.reference : null }, window.location.origin);
});`;
}
