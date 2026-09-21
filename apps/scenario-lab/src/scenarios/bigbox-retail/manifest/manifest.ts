import { createScenarioManifest } from "../../../types.js";
import { PICKUP_ORDER_WORKFLOW } from "./pickup-order-workflow.js";
import { PICKUP_TOWELS_WORKFLOW } from "./pickup-towels-workflow.js";
import { PRIMARY_EXPECTED, PRIMARY_SCRIPT, REDESIGNED_BUY_BOX } from "./primary-workflow.js";

/**
 * ValueRidge, a big-box retailer's site with the mess a real one has: a
 * consent dialog, an email offer that opens a moment later with a field only
 * a bot fills, a support widget in a shadow root lying over the buttons that
 * matter, a store picker in another shadow root offering four identical "Set
 * as my store" buttons, generated class names and ids that change with every
 * build and seed, ads mixed into results and ignoring every filter, prices
 * drawn in pieces, a bot check on the third results page, a Next arrow that
 * forgets the filters, an Add to cart whose first press only wakes the page,
 * a header count that goes stale, a checkout behind a sign-in wall whose
 * pickup times are rate-limited, a card form in a cross-origin frame, and
 * links that open new tabs.
 *
 * The primary workflow builds a pickup cart for another store (judged by the
 * mini cart). `pickup-towels` reads qualifying listings across pages (judged
 * by the records). `pickup-order` places an order, the consequential job
 * (judged by the confirmation's records).
 */
export const bigboxRetailManifest = createScenarioManifest({
  id: "bigbox-retail",
  title: "Big-box retail",
  tags: ["retail", "ecommerce", "consent", "modal", "shadow-dom", "iframe", "new-tab", "sponsored", "pagination", "generated-classes", "anti-bot", "rate-limit", "variants", "checkout", "extraction", "filter"],
  seed: 239,
  startPath: "/scenarios/bigbox-retail/",
  capabilities: ["navigation", "forms", "scroll", "mutation", "iframe", "popup"],
  recordingScript: [...PRIMARY_SCRIPT],
  playbackGoal: {
    id: "build-pickup-cart",
    description: "Switch the pickup store to Millbrook Crossing Supercenter, then add two 12 Double Rolls packs of ValueRidge Essentials Select-A-Size Paper Towels and one 250 Count pack of ValueRidge Everyday Dinner Napkins for pickup, keeping what was already in the cart.",
    successFacts: [...PRIMARY_EXPECTED.finalState!],
  },
  expected: PRIMARY_EXPECTED,
  variants: [REDESIGNED_BUY_BOX],
  workflows: [PICKUP_TOWELS_WORKFLOW, PICKUP_ORDER_WORKFLOW],
});
