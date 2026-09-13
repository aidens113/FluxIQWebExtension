import { applyIdentifierPolicy } from "../../identifier-policy/index.js";
import { escapeHtml, page } from "../../html.js";
import type { RenderContext } from "../../types.js";
import { renderCheckoutSteps } from "./checkout-steps.js";
import { storefrontCheckoutClientScript } from "./client-script.js";
import { storefrontOrder } from "./order.js";
import { renderStoreOverlays } from "./overlays.js";
import type { StorefrontCheckoutState } from "./state.js";
import { storefrontStyles, styleClass as cx } from "./styles.js";

/** Same-origin, as a hosted card form is: the store embeds it, the provider serves it. */
export const PAYMENT_FRAME_PATH = "payment-frame";

/**
 * The whole store page: masthead, the four-step accordion, the order summary
 * that follows the shopper down the page, the confirmation panel that replaces
 * the accordion, the footer, and the two overlays.
 *
 * The confirmation panel is in the document from the first load, collapsed. It
 * is filled from state rather than rebuilt in the browser, so the panel a
 * reload renders and the panel the payment produces are the same markup with
 * the same order reference.
 */
export function renderStorefrontCheckout(state: StorefrontCheckoutState, context: RenderContext): string {
  const confirmed = state.step === "confirmed";
  const body = `${storefrontStyles}<div class="${cx.announcement}" data-testid="announcement">Free returns for 60 days. Free standard shipping on orders over $75.</div>
<div class="${cx.shell}">
  <header class="${cx.header}">
    <div class="${cx.brand}">${escapeHtml(storefrontOrder.store.name)}</div>
    <nav class="${cx.headerNav}" aria-label="Account">
      <a href="#order-status">Order status</a>
      <a href="#help">Help</a>
      <a href="#account">Sign in</a>
      <span data-testid="bag-count">${storefrontOrder.items.reduce((count, item) => count + item.quantity, 0)} items</span>
    </nav>
  </header>
  <p class="${cx.progress}" data-testid="checkout-progress">${escapeHtml(state.status.progress)}</p>
  <div class="${cx.columns}">
    <main class="${cx.form}">
      <div data-testid="checkout-accordion"${confirmed ? " hidden" : ""}>
        ${renderCheckoutSteps(state, PAYMENT_FRAME_PATH)}
      </div>
      ${confirmationPanel(state)}
    </main>
    ${orderSummary(state)}
  </div>
  <footer class="${cx.footer}">
    <a href="#terms" data-testid="footer-terms">Terms of sale</a>
    <a href="#privacy" data-testid="footer-privacy">Privacy</a>
    <a href="#cookies" data-testid="footer-cookies">Cookie preferences</a>
    <a href="#accessibility">Accessibility</a>
    <a href="#returns">Returns and refunds</a>
    <a href="#contact">Contact us</a>
    <span>&copy; Northlake Outfitters</span>
    <a href="#help-centre" data-testid="footer-help" style="margin-left:auto">Help centre</a>
  </footer>
</div>
<button type="button" class="${cx.backToTop}" data-testid="back-to-top">Back to top</button>${renderStoreOverlays(state)}`;
  const document = page(`Checkout | ${storefrontOrder.store.name}`, body, storefrontCheckoutClientScript(context.runToken));
  // Last, over the finished document: the client script builds controls from
  // the same attributes the markup does, so a policy applied to the markup
  // alone would leave every client-rendered control labelled.
  return applyIdentifierPolicy(document, state.identifiers);
}

function confirmationPanel(state: StorefrontCheckoutState): string {
  return `<section class="${cx.confirmation}" data-testid="order-confirmation" aria-labelledby="order-confirmation-title"${state.step === "confirmed" ? "" : " hidden"}>
        <h2 id="order-confirmation-title">Thank you, your order is confirmed</h2>
        <p>Order reference <strong data-testid="order-reference">${escapeHtml(state.order.reference)}</strong></p>
        <p data-testid="order-total-paid">Paid today: ${escapeHtml(state.status.total)}</p>
        <p data-testid="order-delivery-estimate">${escapeHtml(state.status.deliveryEstimate)}</p>
        <p class="${cx.hint}">A receipt is on its way to the email address you gave us. Your card details were handled by our payment provider and are not held by this store.</p>
      </section>`;
}

function orderSummary(state: StorefrontCheckoutState): string {
  return `<aside class="${cx.summary}" data-testid="order-summary" aria-label="Order summary">
      <h2>Order summary</h2>
      <div class="${cx.summaryRow}"><span>Subtotal</span><span data-testid="summary-subtotal">${escapeHtml(state.status.subtotal)}</span></div>
      <div class="${cx.summaryRow}" data-testid="summary-discount-row"${state.totals.discountCents === 0 ? " hidden" : ""}><span>Promotion</span><span data-testid="summary-discount">${escapeHtml(state.status.discount)}</span></div>
      <div class="${cx.summaryRow}"><span>Delivery</span><span data-testid="summary-delivery">${escapeHtml(state.status.deliveryCost)}</span></div>
      <div class="${cx.summaryTotal}"><span>Total</span><span data-testid="summary-total">${escapeHtml(state.status.total)}</span></div>
      <p class="${cx.hint}">Free returns within 60 days. Sales tax is not charged on orders shipped within Oregon.</p>
    </aside>`;
}
