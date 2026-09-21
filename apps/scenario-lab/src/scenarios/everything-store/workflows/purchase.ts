import type { ExpectedFact, ScenarioExpected, ScenarioGoal, ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { TIDEWELL_KETTLES } from "../catalog/index.js";
import { confirmationTexts } from "../pages/index.js";
import { SHARED_STEPS } from "./shared-steps.js";

const FAMILY_CARD = TIDEWELL_KETTLES[0]?.sku ?? "";
const MATTE_BLACK_17 = TIDEWELL_KETTLES.find((child) => child.variant?.colour === "Matte Black" && child.variant.capacity === "1.7 L");
if (!MATTE_BLACK_17) throw new Error("The Tidewell family has no Matte Black 1.7 L child");

/**
 * The order the purchase task asks for: one new Matte Black 1.7 L kettle sold
 * by the store, standard delivery, home address, the Visa, no gift card and
 * no Plus trial.
 */
const ORDER = confirmationTexts({
  lines: [{ sku: MATTE_BLACK_17.sku, offerId: null, quantity: 1, unitCents: MATTE_BLACK_17.priceCents }],
  addressId: "home",
  paymentId: "visa-4417",
  giftCard: false,
  delivery: "standard",
  plusTrial: false,
  totalCents: MATTE_BLACK_17.priceCents,
});

/**
 * What the confirmation page must say, and must not. The cart still holding
 * its two earlier items is part of the goal: the task says to leave them, and
 * checking out the whole cart, or emptying it first, both break that.
 */
const ORDER_FACTS: ExpectedFact[] = [
  { id: "order-placed", subject: "order-status", predicate: "text", value: ORDER.status },
  { id: "order-is-the-kettle", subject: "order-line-1", predicate: "text", value: ORDER.lines[0] ?? "" },
  { id: "order-has-one-line", subject: "order-line-2", predicate: "exists", value: false },
  { id: "order-standard-delivery", subject: "order-delivery", predicate: "text", value: ORDER.delivery },
  { id: "order-home-address", subject: "order-ship-to", predicate: "text", value: ORDER.shipTo },
  { id: "order-paid-by-visa", subject: "order-payment", predicate: "text", value: ORDER.payment },
  { id: "order-total", subject: "order-total", predicate: "text", value: ORDER.total },
  { id: "no-plus-trial", subject: "plus-trial", predicate: "exists", value: false },
  { id: "cart-left-alone", subject: "cart-count", predicate: "text", value: "2" },
];

/**
 * The manifest's primary workflow: buy one kettle. It is the consequential
 * task, the one whose last press spends the shopper's money, and the reason
 * the playback goal exists. The recording takes the Buy Now route, which
 * leaves the cart alone; changes delivery to standard; and unticks the Plus
 * trial the store ticked.
 *
 * Two waits in it are a person's, not the script's: the support chat opens
 * itself over the buy box five seconds into the first product page and is
 * minimised, and the app banner that arrives two seconds into the chosen
 * finish's page is closed before Buy Now is pressed -- by which time the buy
 * box has come alive and a press is not lost.
 */
export const PURCHASE_WORKFLOW: { recordingScript: ScenarioStep[]; playbackGoal: ScenarioGoal; expected: ScenarioExpected } = {
  recordingScript: [
    ...SHARED_STEPS.openStore,
    ...SHARED_STEPS.search("buy", "tidewell kettle"),
    { id: "buy-kettle-listed", operation: "waitForState", target: `[data-component="search-result"][data-sku="${FAMILY_CARD}"]`, timeoutMs: 6000 },
    { id: "buy-open-kettle", operation: "click", target: `[data-component="search-result"][data-sku="${FAMILY_CARD}"]:not([data-ad-id]) h2 a` },
    { id: "buy-chat-opened", operation: "waitForState", target: "role:dialog:Brightaisle Assistant", timeoutMs: 9000 },
    { id: "buy-minimize-chat", operation: "click", target: "role:button:Minimize chat" },
    { id: "buy-choose-matte-black", operation: "click", target: `[title="Click to select Matte Black"]` },
    { id: "buy-app-banner", operation: "waitForState", target: `[title="Close"]`, timeoutMs: 6000 },
    { id: "buy-close-app-banner", operation: "click", target: `[title="Close"]` },
    { id: "buy-now", operation: "click", target: "role:button:Buy Now" },
    { id: "buy-checkout-open", operation: "waitForState", target: `input[name="delivery"][value="standard"]`, timeoutMs: 6000 },
    { id: "buy-standard-delivery", operation: "check", target: `input[name="delivery"][value="standard"]`, value: true },
    { id: "buy-trial-offered", operation: "waitForState", target: `input[name="delivery"][value="standard"][checked]`, timeoutMs: 6000 },
    { id: "buy-decline-plus-trial", operation: "check", target: `section:has-text("Brightaisle Plus trial") input[type="checkbox"]`, value: false },
    { id: "buy-trial-declined", operation: "waitForState", target: `section:has-text("Brightaisle Plus trial") input[type="checkbox"]:not([checked])`, timeoutMs: 6000 },
    { id: "buy-place-order", operation: "click", target: `aside [data-action="place-order"]` },
    { id: "buy-order-placed", operation: "waitForState", target: "testid:order-status", timeoutMs: 6000 },
    { id: "buy-done", operation: "checkpoint" },
  ],
  playbackGoal: {
    id: "buy-one-kettle",
    description: "One new Tidewell 1.7 L kettle in Matte Black, sold by Brightaisle, ordered with free standard delivery to the home address and paid by Visa, with nothing else ordered, no Plus trial started, and the rest of the cart left where it was.",
    successFacts: ORDER_FACTS,
  },
  expected: {
    pageFacts: [...SHARED_STEPS.homeFacts],
    recordingEvents: [{ type: "web.element.clicked" }, { type: "web.element.input_changed" }],
    actions: [
      { action: "web.dom.click", outcome: "succeeded" },
      { action: "web.dom.type", outcome: "succeeded" },
    ],
    finalState: ORDER_FACTS,
    allowedConsoleErrors: [],
  },
};
