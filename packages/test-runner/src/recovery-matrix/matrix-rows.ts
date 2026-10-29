// The acceptance matrix, rows 1-11 and 13, with each row's site assignment
// from t390's report (`docs/working/state-aware-recovery-plan/reports/
// t390-lab-perturbations.md`). Row 12 is the paid proof and is never here.

import type { RecoveryMatrixRow, RecoverySiteExpectation } from "./matrix-row.js";

/** Voltbay Official Store's hub on crossborder, and what the cart task leaves: three in the cart, added once, with the store's coupon. */
const VOLTBAY = { listingId: "1005008123450", storeId: "voltbay-official" } as const;
const HUB_IN_CART: RecoverySiteExpectation = { kind: "crossborder-cart", ...VOLTBAY, pieces: 3, adds: 1, couponHeld: true };
const NOTHING_IN_CART: RecoverySiteExpectation = { kind: "crossborder-cart", ...VOLTBAY, pieces: 0, adds: 0, couponHeld: false };

/** social-network-feed's friend requests from people with at least five mutual friends: Amara Osei, Jonas Weber, Lin Zhao, Freya Holm. */
const QUALIFYING_REQUESTS = ["rq_8b41c7", "rq_c7a0e5", "rq_e24f90", "rq_7a95b3"] as const;

/**
 * Jonas Weber's Confirm, the second confirm, exactly as `CONFIRM_QUALIFYING` targets it: row 9 loses this press's
 * acknowledgement. Named by its target, not by a count of presses, since the optional dismissals before it may or may
 * not be pressed (t404's first launch counted to "Not now").
 */
const JONAS_CONFIRM = '[role="listitem"]:has(a[href$="/people/jonas-weber/"]) [aria-label="Confirm"]';

/** photo-social's first two feed posts that show a like count: harbourlight.studio's and saltmarsh.goods' newest, neither liked nor saved when a visit starts. */
const FIRST_FEED_POSTS = ["D1OKDvAEHfa", "D0eFDg0l9aY"] as const;

/** The bigbox shopper's cart as every visit starts it: one bottle of dish soap kept from the last visit. */
const SOAP_ONLY = { productId: "418832007", qty: 1 } as const;

export const RECOVERY_MATRIX_ROWS: readonly RecoveryMatrixRow[] = [
  {
    row: 1,
    scenario: "Cold start uses the default entry",
    needs: [],
    cases: [{ caseId: "1", taskInstructions: "Find the USB-C hub from Voltbay Official Store. Choose Space Grey, the 7-in-1 model and shipping from Spain, set three pieces, claim the store coupon and add them to the cart once.", title: "the hub-to-cart Flow, started cold on the home page, runs from its first step and completes", scenarioId: "crossborder-marketplace", flow: "HUB_TO_CART", check: "cold-start", site: HUB_IN_CART, goalFacts: true }],
  },
  {
    row: 2,
    scenario: "Step already done: eligible entry, inputs bound",
    needs: ["entries"],
    cases: [{ caseId: "2", taskInstructions: "Put two packs of Select-A-Size paper towels in the 12 Double Rolls size into the pickup cart for Millbrook Crossing Supercenter. Reuse that store if already selected; otherwise select it first.", title: "with the pickup store already remembered, the Flow begins at the entry past the store choice", scenarioId: "bigbox-retail", variantId: "store-remembered", flow: "PICKUP_CART_STORE_ENTRY", check: "eligible-entry", skippedStep: "s4", site: { kind: "bigbox-cart", lines: [SOAP_ONLY, { productId: "418830127", qty: 2 }], storeId: "1187" }, goalFacts: false }],
  },
  {
    row: 3,
    scenario: "Similar page, wrong filters: shortcut refused",
    // The shortcut is the called part's own entry, so the proof needs the part's frame (t404, t406).
    needs: ["entries", "call-subflow"],
    cases: [{ caseId: "3", taskInstructions: "Read the first page of paper towels sold by ValueRidge, available for pickup today and rated at least 4.5 stars, including name, price, unit price and rating. Restore the department, seller, pickup, today and rating filters before reading if navigation dropped them.", title: "on page 2 of the towel results with every filter dropped by the Next arrow, the read-from-here entry is refused", scenarioId: "bigbox-retail", workflowId: "pickup-towels", flow: "TOWELS_FILTER_ENTRY", check: "shortcut-refused", site: { kind: "bigbox-cart", lines: [SOAP_ONLY], storeId: null }, goalFacts: false }],
  },
  {
    row: 4,
    scenario: "Popup before the first action and midway",
    needs: ["handlers"],
    cases: [
      { caseId: "4a", taskInstructions: "Find the Voltbay Official Store USB-C hub, choose Space Grey, 7-in-1 and shipping from Spain, claim its store coupon and add three pieces once. Close a flash-sale promotion that blocks the page before continuing.", title: "the flash deal stands over the home page before the first action", scenarioId: "crossborder-marketplace", variantId: "flash-deal-on-arrival", flow: "HUB_TO_CART_PROMOTION_HANDLER", check: "popup-handled", site: HUB_IN_CART, goalFacts: true },
      { caseId: "4b", taskInstructions: "Find the Voltbay Official Store USB-C hub, choose Space Grey, 7-in-1 and shipping from Spain, claim its store coupon and add three pieces once. Close a flash-sale promotion that interrupts option selection before continuing.", title: "the flash deal opens over the product page while options are chosen", scenarioId: "crossborder-marketplace", variantId: "flash-deal", flow: "HUB_TO_CART_PROMOTION_HANDLER", check: "popup-handled", site: HUB_IN_CART, goalFacts: true },
    ],
  },
  {
    row: 5,
    scenario: "Popup removal fails: no loop, honest end",
    needs: ["handlers"],
    cases: [{ caseId: "5", taskInstructions: "Find the Voltbay Official Store USB-C hub and prepare three Space Grey 7-in-1 pieces shipped from Spain with its store coupon. If the blocking flash-sale promotion cannot be dismissed within the bounded recovery attempt, stop with an explicit failure rather than claim that the cart task completed.", title: "the flash deal's close glyph does nothing; the handler runs within its budget and the run ends with the declared failure", scenarioId: "crossborder-marketplace", variantId: "flash-deal-stuck", flow: "HUB_TO_CART_PROMOTION_HANDLER", check: "popup-honest-end", declaredFailure: { category: "unexpected_state", code: "web.action.blocked_by_dialog" }, site: NOTHING_IN_CART, goalFacts: false }],
  },
  {
    row: 6,
    scenario: "Node and automation handlers both match: node wins, trace shows why",
    needs: ["handlers"],
    cases: [{ caseId: "6", taskInstructions: "Add three Space Grey 7-in-1 Voltbay Official Store USB-C hubs shipped from Spain with the store coupon. Dismiss a promotion covering the welcome step through that step's handler; use the automation-wide dismissal for other blocked steps.", title: "a handler on the first step and one for the whole automation both match the arrival promotion; the step's runs", scenarioId: "crossborder-marketplace", variantId: "flash-deal-on-arrival", flow: "HUB_TO_CART_TWO_HANDLERS", check: "handler-precedence", expectHandler: "h1-", site: HUB_IN_CART, goalFacts: true }],
  },
  {
    row: 7,
    scenario: "Inactive part's handler matches: not run",
    needs: ["handlers"],
    cases: [{ caseId: "7", taskInstructions: "Search the store for dish soap and answer privacy choices only through the active search path. Change the pickup store to Millbrook Crossing Supercenter only when the task input explicitly asks for change-store; otherwise leave the store unchanged.", title: "both situation blocks register a handler for the consent dialog; only the block the Router chose runs its own", scenarioId: "bigbox-retail", flow: "SOAP_SEARCH_TWO_BLOCKS", check: "inactive-handler", quietSubflow: "store", site: { kind: "bigbox-cart", lines: [SOAP_ONLY], storeId: null }, goalFacts: false }],
  },
  {
    row: 8,
    scenario: "Primary way fails, known alternative passes the same check",
    needs: ["handlers", "call-subflow"],
    cases: [{ caseId: "8", taskInstructions: "Add one bottle of lemon dish soap to the cart and read its cart summary. Use the product page first; if its Add to cart control fails, add from the search-result tile as the known alternative.", title: "under the redesigned buy box the product page's Add to cart is gone; the fail handler adds from the results tile instead", scenarioId: "bigbox-retail", variantId: "redesigned-buy-box", flow: "QUICK_ADD_ALTERNATIVE", check: "known-alternative", expectHandler: "h1-", site: { kind: "bigbox-cart", lines: [{ productId: "418832007", qty: 2 }], storeId: null }, goalFacts: false }],
  },
  {
    row: 9,
    scenario: "Committing act's outcome lost: reconcile first",
    needs: ["reconciliation"],
    cases: [{ caseId: "9", taskInstructions: "Open friend requests and confirm the requests from Amara Osei, Jonas Weber, Lin Zhao and Freya Holm, who qualify with at least five mutual friends. Leave other requests unanswered and wait until Freya's request is accepted; do not repeat a confirmation whose outcome was already established.", title: "the acknowledgement of the second confirm never reaches Core; the confirm is reconciled, not repeated", scenarioId: "social-network-feed", workflowId: "confirm-requests", perturbation: { kind: "drop-action-result", onTargetSelector: JONAS_CONFIRM }, flow: "CONFIRM_QUALIFYING", check: "outcome-reconciled", site: { kind: "social-confirmed", requestIds: QUALIFYING_REQUESTS, rateLimitedAtLeast: 0 }, goalFacts: false }],
  },
  {
    row: 10,
    scenario: "Route back to a checkpoint: no repeated confirmation",
    needs: ["handlers", "checkpoints"],
    cases: [{ caseId: "10", taskInstructions: "Confirm the qualifying friend requests from Amara Osei, Jonas Weber, Lin Zhao and Freya Holm, leaving others unanswered. When the site rate-limits a confirmation, wait out the notice, dismiss it and return to the requests checkpoint without confirming already accepted requests again.", title: "the rate-limit notice sends the run back to the requests checkpoint; confirmed requests are not confirmed again", scenarioId: "social-network-feed", workflowId: "confirm-requests", flow: "CONFIRM_WITH_CHECKPOINT", check: "checkpoint-route", site: { kind: "social-confirmed", requestIds: QUALIFYING_REQUESTS, rateLimitedAtLeast: 1 }, goalFacts: false }],
  },
  {
    row: 11,
    scenario: "Service worker stopped mid-action",
    needs: ["reconciliation"],
    cases: [{ caseId: "11", taskInstructions: "Add three Space Grey 7-in-1 Voltbay Official Store USB-C hubs shipped from Spain with the store coupon. If the extension loses the Add to cart acknowledgement, establish the cart outcome before deciding whether the lasting add still needs execution.", title: "the extension's worker is stopped as Add to cart reaches the site; the add lands once and the run ends honestly", scenarioId: "crossborder-marketplace", perturbation: { kind: "stop-service-worker", onSiteRequest: "/api/crossborder-marketplace/add-to-cart" }, flow: "HUB_TO_CART", check: "worker-restart", site: HUB_IN_CART, goalFacts: true }],
  },
  {
    row: 13,
    scenario: "Retries and planned fails never call the model",
    needs: [],
    cases: [
      { caseId: "13a", taskInstructions: "Confirm friend requests from Amara Osei, Jonas Weber, Lin Zhao and Freya Holm, who have at least five mutual friends. Leave other requests unanswered, respect the site's rate-limit wait and finish after Freya's request is accepted.", title: "the fourth confirm is refused for going too fast; the node's retry confirms it after the notice's wait", scenarioId: "social-network-feed", workflowId: "confirm-requests", flow: "CONFIRM_QUALIFYING", check: "retries-absorbed", site: { kind: "social-confirmed", requestIds: QUALIFYING_REQUESTS, rateLimitedAtLeast: 1 }, goalFacts: false },
      { caseId: "13b", taskInstructions: "Confirm only the requests from Amara Osei, Jonas Weber and Lin Zhao. Then check whether any request remains unanswered; if so, deliberately end with a failed result explaining that requests still wait rather than confirm anyone else.", title: "a check fails on purpose and its failed path ends the run at an End the Flow marked failed", scenarioId: "social-network-feed", workflowId: "confirm-requests", flow: "CONFIRM_THEN_STOP", check: "deliberate-stop", site: { kind: "social-confirmed", requestIds: QUALIFYING_REQUESTS.slice(0, 3), rateLimitedAtLeast: 0 }, goalFacts: false },
      { caseId: "13c", taskInstructions: "On the home feed, like the first two posts that show a like count, and save each of those two posts to your saved posts right after liking it. Like and save each of them exactly once, and leave every other post as it is.", title: "a post's like moves its count, so the row the read took is gone and its bookmark fails three times; the run reads the posts again, finds the same post and saves it", scenarioId: "photo-social", flow: "LIKE_THEN_SAVE", check: "row-reacquired", reacquire: { step: "s11", source: "s7", passes: 2, reacquiredPasses: 2 }, site: { kind: "photo-liked-saved", postCodes: FIRST_FEED_POSTS }, goalFacts: false },
    ],
  },
];
