import { createScenarioManifest } from "../../types.js";
import { ADD_TO_CART_WORKFLOW, FIRST_PAGE_WORKFLOW, PLUS_UNDER_FIFTY_WORKFLOW, PURCHASE_WORKFLOW } from "./workflows/index.js";

/**
 * Brightaisle, an everything store, with the mess a real one has and the
 * defences a large one runs.
 *
 * Four workflows. The primary one buys a kettle, which is the consequential
 * task and carries the playback goal; `add-to-cart` changes the cart and
 * reads it back; `first-page-earbuds` reads a filtered results page; and
 * `plus-under-fifty` sweeps every page for the pairs that meet three
 * criteria, which no recording can do.
 *
 * Three variants: `redesigned-header` (repair), `deal-wheel` (a new popup in
 * front of a Flow built without it) and `robot-check` (the hard challenge,
 * whose right outcome is asking a person).
 *
 * `recordingEvents` name types without counts, because no recording lane has
 * run this fixture yet: that a type occurs can be claimed honestly, and an
 * exact tally cannot.
 */
export const everythingStoreManifest = createScenarioManifest({
  id: "everything-store",
  title: "Everything store",
  tags: ["retail", "marketplace", "search", "pagination", "sponsored", "variants", "checkout", "anti-bot", "captcha", "rate-limit", "honeypot", "consent-banner", "shadow-dom", "iframe", "generated-classes", "extraction"],
  seed: 241,
  startPath: "/scenarios/everything-store/",
  capabilities: ["navigation", "forms", "scroll", "mutation", "iframe", "popup"],
  recordingScript: PURCHASE_WORKFLOW.recordingScript,
  playbackGoal: PURCHASE_WORKFLOW.playbackGoal,
  expected: PURCHASE_WORKFLOW.expected,
  workflows: [ADD_TO_CART_WORKFLOW, FIRST_PAGE_WORKFLOW, PLUS_UNDER_FIFTY_WORKFLOW],
});
