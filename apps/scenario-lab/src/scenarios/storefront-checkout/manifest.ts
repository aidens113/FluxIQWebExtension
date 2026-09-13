import type { ExpectedFact } from "@fluxiq-web-extension/test-contracts";
import { createScenarioManifest } from "../../types.js";

/** Obviously synthetic values, and the only card-shaped strings in this fixture. */
export const syntheticCheckoutValues = {
  /** A reserved test PAN: it is not an account, and it is the same spelling the sensitive-input fixture uses. */
  cardNumber: "4000000000000000",
  billingCardNumber: "5100000000000000",
  cardHolder: "SYNTHETIC CARDHOLDER",
  cardExpiry: "12/34",
  securityCode: "123",
  password: "SYNTHETIC_PASSWORD_DO_NOT_USE",
  postcode: "97205",
  email: "synthetic-shopper@example.test",
  shopperName: "Ada Synthetic",
} as const;

/**
 * The store as a run first meets it: a consent dialog over a scrim that owns
 * every click, a chat widget in the corner, the first accordion step open, the
 * rest collapsed -- and the payment iframe already embedded and loading inside
 * the collapsed payment step, which is why the frame count is one before the
 * shopper has gone anywhere near payment.
 *
 * Declared on both the workflow and the variant rather than inherited: a page
 * fact describes the rendering it is declared on at the moment that rendering
 * is first presented. They are the same list because arming changes nothing
 * visible -- `decline-next-payment` returns the checkout to its first
 * rendering and sets a gateway decision the page does not show.
 */
const STORE_PAGE_FACTS: ExpectedFact[] = [
  { id: "consent-dialog-blocking", subject: "cookie-consent", predicate: "visible", value: true },
  { id: "support-chat-present", subject: "support-chat-launcher", predicate: "visible", value: true },
  { id: "bag-step-open", subject: "step-cart-body", predicate: "visible", value: true },
  { id: "payment-step-collapsed", subject: "step-payment-body", predicate: "visible", value: false },
  { id: "confirmation-not-shown", subject: "order-confirmation", predicate: "visible", value: false },
  { id: "card-frame-embedded", subject: "document", predicate: "iframe-count", value: 1 },
];

/**
 * A shopper who completes a checkout: dismisses the consent dialog, applies a
 * promotion, looks up an address by postcode and waits for the results,
 * chooses a delivery speed and waits for the quote, then fills the card form
 * inside the payment frame and pays.
 *
 * Two things about the script are deliberate. It starts by answering the
 * consent dialog because on this page nothing else can be clicked until it is
 * answered, and it ends by waiting in the *top* document for a confirmation
 * that a click inside the *frame* produced.
 */
export const storefrontCheckoutManifest = createScenarioManifest({
  id: "storefront-checkout",
  title: "Storefront checkout",
  tags: ["checkout", "iframe", "redaction", "consent-overlay", "async-reveal", "forms"],
  seed: 131,
  startPath: "/scenarios/storefront-checkout/",
  capabilities: ["forms", "iframe", "mutation"],
  recordingScript: [
    { id: "accept-cookies", operation: "click", target: "testid:cookie-accept-all" },
    { id: "enter-promotion", operation: "type", target: "testid:promo-code", value: "TRAIL10" },
    { id: "apply-promotion", operation: "click", target: "testid:apply-promotion" },
    { id: "continue-to-address", operation: "click", target: "testid:continue-to-address" },
    { id: "enter-name", operation: "type", target: "testid:address-name", value: syntheticCheckoutValues.shopperName },
    { id: "enter-email", operation: "type", target: "testid:address-email", value: syntheticCheckoutValues.email },
    { id: "enter-postcode", operation: "type", target: "testid:postcode", value: syntheticCheckoutValues.postcode },
    { id: "find-address", operation: "click", target: "testid:find-address" },
    { id: "await-suggestions", operation: "waitForState", target: "testid:address-suggestions", timeoutMs: 5000 },
    { id: "choose-address", operation: "click", target: "testid:address-option-2" },
    { id: "enter-account-password", operation: "type", target: "testid:account-password", value: syntheticCheckoutValues.password },
    { id: "continue-to-delivery", operation: "click", target: "testid:continue-to-delivery" },
    { id: "choose-express-delivery", operation: "check", target: "testid:delivery-express", value: true },
    { id: "await-delivery-estimate", operation: "waitForState", target: "testid:delivery-estimate", timeoutMs: 5000 },
    { id: "continue-to-payment", operation: "click", target: "testid:continue-to-payment" },
    { id: "enter-card-number", operation: "type", target: "frame:Secure card payment/testid:card-number", value: syntheticCheckoutValues.cardNumber },
    { id: "enter-card-name", operation: "type", target: "frame:Secure card payment/testid:card-name", value: syntheticCheckoutValues.cardHolder },
    { id: "enter-card-expiry", operation: "type", target: "frame:Secure card payment/testid:card-expiry", value: syntheticCheckoutValues.cardExpiry },
    { id: "enter-security-code", operation: "type", target: "frame:Secure card payment/testid:card-security-code", value: syntheticCheckoutValues.securityCode },
    { id: "bill-another-card", operation: "check", target: "frame:Secure card payment/testid:use-different-billing-card", value: true },
    { id: "enter-billing-card-number", operation: "type", target: "frame:Secure card payment/testid:billing-card-number", value: syntheticCheckoutValues.billingCardNumber },
    { id: "pay", operation: "click", target: "frame:Secure card payment/testid:pay-now" },
    { id: "await-confirmation", operation: "waitForState", target: "testid:order-confirmation", timeoutMs: 5000 },
    { id: "order-placed", operation: "checkpoint" },
  ],
  expected: {
    pageFacts: STORE_PAGE_FACTS,
    /**
     * No counts. Ten of these inputs and two of the clicks happen inside the
     * payment frame, and what the recorder emits for a frame-scoped event on a
     * page like this is the open question the fixture was built to answer. A
     * count written from the outside would be a guess dressed as an
     * expectation; the fixture-level spec pins what the page does, and the
     * recording lane will say what the recorder does.
     */
    recordingEvents: [
      { type: "web.element.clicked" },
      { type: "web.element.input_changed" },
      { type: "web.element.changed" },
    ],
    actions: [
      { action: "web.dom.click", outcome: "succeeded" },
      { action: "web.dom.type", outcome: "succeeded" },
      { action: "web.dom.check", outcome: "succeeded" },
    ],
    finalState: [
      { id: "order-confirmed", subject: "order-confirmation", predicate: "visible", value: true },
      // The reference is derived from the lab's seed, not the manifest's, so
      // only its shape can be asserted here.
      { id: "order-reference-issued", subject: "order-reference", predicate: "contains", value: "NLO-" },
      { id: "accordion-replaced", subject: "checkout-accordion", predicate: "visible", value: false },
      { id: "consent-dialog-gone", subject: "cookie-consent", predicate: "exists", value: false },
      { id: "chat-widget-survives", subject: "support-chat-launcher", predicate: "visible", value: true },
      { id: "paid-with-delivery", subject: "summary-total", predicate: "text", value: "$344.10" },
    ],
    allowedConsoleErrors: [],
  },
  variants: [{
    id: "declined-card",
    description: "The same checkout, with the card issuer refusing the payment. The store shows the refusal in the frame and in the top document, and the confirmation the recording waited for never appears.",
    arm: { operation: "decline-next-payment" },
    expected: {
      // The armed rendering, declared rather than inherited: see STORE_PAGE_FACTS.
      pageFacts: STORE_PAGE_FACTS,
      finalState: [
        { id: "decline-notice-shown", subject: "payment-decline-notice", predicate: "visible", value: true },
        { id: "decline-notice-says-declined", subject: "payment-decline-notice", predicate: "contains", value: "declined" },
        { id: "no-confirmation", subject: "order-confirmation", predicate: "visible", value: false },
        { id: "still-on-payment-step", subject: "step-payment-body", predicate: "visible", value: true },
      ],
      /**
       * `unexpected_state`, not `timeout` and not `output_not_observed`: the
       * page answers promptly and says exactly what happened, so nothing hangs
       * and nothing is merely unobserved -- the run is standing on a checkout
       * that reached "declined" where it expected "confirmed". The code is
       * left unstated; the category is the claim, and what a run reports needs
       * the extension and Core to settle.
       */
      failure: { category: "unexpected_state" },
    },
  }],
  /**
   * One declaration for every step that types into a control the domain's
   * sensitivity rule marks (`domain/src/sensitivity/signature.ts`): `type`
   * `password`, `data-sensitive="true"`, or an `autocomplete` token that is
   * `current-password`, `new-password`, `one-time-code` or any `cc-` token.
   * The recorder withholds such a control's value, and the Flow's node asks
   * for it under `web.secret.<key>` instead. The Flow lane pairs those
   * requests with these declarations one-to-one, matching each step's
   * `testid:` target against the control's recorded test id, and fails the
   * run with `fixture.invalid` when they do not pair. So a marked step with
   * no declaration here fails the lane as surely as a wrong one.
   *
   * That makes five, not the obvious three. Beside the password
   * (`new-password`) and the two card numbers (`cc-number`,
   * `billing cc-number`), the cardholder name carries `cc-name` and the
   * expiry `cc-exp`, which the rule marks exactly as it marks the number.
   * Each value comes from `FLUXIQ_TEST_SECRET_<ID>`, the id upper-cased with
   * underscores.
   *
   * `enter-security-code` is not declared here, and that is not an oversight:
   * the field carries no marking, so nothing withholds it and the recording
   * replays whatever was typed. An unmarked card field needs no secret
   * precisely because it was never treated as one -- which is the asymmetry
   * this fixture exists to expose. A declaration for it would pair with no
   * request and fail the run.
   */
  secrets: [
    { id: "storefront-checkout-password", step: "enter-account-password" },
    { id: "storefront-checkout-card", step: "enter-card-number" },
    { id: "storefront-checkout-card-name", step: "enter-card-name" },
    { id: "storefront-checkout-card-expiry", step: "enter-card-expiry" },
    { id: "storefront-checkout-billing-card", step: "enter-billing-card-number" },
  ],
  evidencePolicy: { screenshots: "events", trace: "failure", video: "failure", sampleFps: 0, reviewRequired: true },
});
