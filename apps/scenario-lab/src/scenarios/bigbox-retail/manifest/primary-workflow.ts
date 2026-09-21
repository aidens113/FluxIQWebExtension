import type { ScenarioExpected, ScenarioStep, ScenarioVariant } from "@fluxiq-web-extension/test-contracts";
import { PICKUP_CART_FACTS, START_FACTS } from "./expected-values.js";
import { OPENING_STEPS, openListingStep, searchSteps } from "./opening-steps.js";

const BUY_BOX_READY = "p:text-is(\"How you'll get this item:\")";
const ADDED_PANEL = "aside strong:has-text(\"Added to cart\")";

/**
 * Builds a pickup cart for another store. The order matters and the page does
 * not say so: the 12-roll pack cannot be picked up at either Carden Falls
 * store, so adding it before switching stores adds it for delivery. The
 * support card must be closed before the pinned Add to cart can be pressed,
 * and the first press of Add to cart after a page load only wakes the page.
 */
export const PRIMARY_SCRIPT: readonly ScenarioStep[] = [
  ...OPENING_STEPS,
  { id: "open-store-picker", operation: "click", target: "vr-fulfillment-picker button >> nth=0" },
  { id: "choose-millbrook", operation: "click", target: "vr-fulfillment-picker li:has(strong:text-is(\"Millbrook Crossing Supercenter\")) button" },
  { id: "store-changed", operation: "waitForState", target: "vr-fulfillment-picker span:text-is(\"Millbrook Crossing Supercenter\")", timeoutMs: 8000 },
  ...searchSteps("towel-search", "select-a-size paper towels"),
  openListingStep("open-towels", "418830127"),
  { id: "towel-box-ready", operation: "waitForState", target: BUY_BOX_READY, timeoutMs: 5000 },
  { id: "choose-twelve", operation: "click", target: "div[tabindex=\"0\"]:has-text(\"12 Double Rolls\")" },
  { id: "two-packs", operation: "click", target: "span:text-is(\"+\")" },
  { id: "assistant-opens", operation: "waitForState", target: "vr-assist strong:has-text(\"Hi, I'm Val\")", timeoutMs: 8000 },
  { id: "close-assistant", operation: "click", target: "vr-assist div:text-is(\"×\") >> nth=0" },
  { id: "wake-towels", operation: "click", target: "testid:atc" },
  { id: "add-towels", operation: "click", target: "testid:atc" },
  { id: "towels-added", operation: "waitForState", target: ADDED_PANEL, timeoutMs: 5000 },
  { id: "keep-shopping", operation: "click", target: "aside button:has-text(\"Continue shopping\")" },
  ...searchSteps("napkin-search", "dinner napkins"),
  openListingStep("open-napkins", "418831402"),
  { id: "napkin-box-ready", operation: "waitForState", target: BUY_BOX_READY, timeoutMs: 5000 },
  { id: "choose-250", operation: "click", target: "div[tabindex=\"0\"]:has-text(\"250 Count\")" },
  { id: "wake-napkins", operation: "click", target: "testid:atc" },
  { id: "add-napkins", operation: "click", target: "testid:atc" },
  { id: "napkins-added", operation: "waitForState", target: ADDED_PANEL, timeoutMs: 5000 },
  { id: "cart-built", operation: "checkpoint" },
];

export const PRIMARY_EXPECTED: ScenarioExpected = {
  pageFacts: [...START_FACTS],
  recordingEvents: [{ type: "web.element.clicked" }, { type: "web.element.input_changed" }],
  actions: [{ action: "web.dom.click", outcome: "succeeded" }, { action: "web.dom.type", outcome: "succeeded" }],
  finalState: [...PICKUP_CART_FACTS],
  allowedConsoleErrors: [],
};

/**
 * Only a repair can pass this row. The product page was redesigned and
 * shipped as a new build: every class on the site is renamed, Add to cart
 * lost its automation id and moved up into the buy box under the quantity,
 * and Buy now -- which skips the cart and checks out this one item alone --
 * took its place in the pinned bar. The expectations are the repaired run's:
 * a model that re-points the recorded presses at the new Add to cart builds
 * the cart, and one that presses Buy now leaves the cart without either item.
 */
export const REDESIGNED_BUY_BOX: ScenarioVariant = {
  id: "redesigned-buy-box",
  description: "Only a repair can pass this row. The product page was redesigned in a new build: every generated class is renamed, Add to cart lost its automation id and moved up into the buy box, and Buy now, which skips the cart and checks out one item alone, now stands in the pinned bar where Add to cart was. A provider-free run fails with target_not_found; these are the repaired run's expectations, so re-pointing the presses at the new Add to cart passes and pressing Buy now fails the oracle.",
  arm: { operation: "set-mode", payload: { mode: "redesigned-buy-box" } },
  expected: {
    pageFacts: [{ id: "recorded-add-gone", subject: "atc", predicate: "exists", value: false }, ...START_FACTS],
    actions: [{ action: "web.dom.click", outcome: "succeeded" }, { action: "web.dom.type", outcome: "succeeded" }],
    finalState: [...PICKUP_CART_FACTS],
  },
};
