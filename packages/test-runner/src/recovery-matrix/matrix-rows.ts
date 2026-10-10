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

/** The bigbox shopper's cart as every visit starts it: one bottle of dish soap kept from the last visit. */
const SOAP_ONLY = { productId: "418832007", qty: 1 } as const;

/** Elements a script can only name by an evidence handle, which no hand-authored Flow has. */
const ELEMENT_FACT_GAP = "A fact about an element (`exists`, `visible`, `value`, `text`) names it by an evidence handle in the candidate script grammar (Core `flow-bootstrap/script-statements/fact-condition.ts`), and a hand-authored Flow has no exploration to issue one. The web host already evaluates a fact whose target is a literal `selector` (`domain/src/runtime/facts/query.ts`), so the gap is the grammar alone.";

export const RECOVERY_MATRIX_ROWS: readonly RecoveryMatrixRow[] = [
  {
    row: 1,
    scenario: "Cold start uses the default entry",
    needs: [],
    cases: [{ caseId: "1", title: "the hub-to-cart Flow, started cold on the home page, runs from its first step and completes", scenarioId: "crossborder-marketplace", flow: "HUB_TO_CART", check: "cold-start", site: HUB_IN_CART, goalFacts: true }],
  },
  {
    row: 2,
    scenario: "Step already done: eligible entry, inputs bound",
    needs: ["entries"],
    authoringGap: ELEMENT_FACT_GAP,
    cases: [{ caseId: "2", title: "with the pickup store already remembered, the Flow begins at the entry past the store choice", scenarioId: "bigbox-retail", variantId: "store-remembered", flow: "PICKUP_CART_STORE_ENTRY", check: "eligible-entry", skippedStep: "s4", site: { kind: "bigbox-cart", lines: [SOAP_ONLY, { productId: "418830127", qty: 2 }], storeId: "1187" }, goalFacts: false }],
  },
  {
    row: 3,
    scenario: "Similar page, wrong filters: shortcut refused",
    needs: ["entries"],
    authoringGap: ELEMENT_FACT_GAP,
    cases: [{ caseId: "3", title: "on page 2 of the towel results with every filter dropped by the Next arrow, the read-from-here entry is refused", scenarioId: "bigbox-retail", workflowId: "pickup-towels", flow: "TOWELS_FILTER_ENTRY", check: "shortcut-refused", site: { kind: "bigbox-cart", lines: [SOAP_ONLY], storeId: null }, goalFacts: false }],
  },
  {
    row: 4,
    scenario: "Popup before the first action and midway",
    needs: ["handlers"],
    authoringGap: ELEMENT_FACT_GAP,
    cases: [
      { caseId: "4a", title: "the flash deal stands over the home page before the first action", scenarioId: "crossborder-marketplace", variantId: "flash-deal-on-arrival", flow: "HUB_TO_CART_PROMOTION_HANDLER", check: "popup-handled", site: HUB_IN_CART, goalFacts: true },
      { caseId: "4b", title: "the flash deal opens over the product page while options are chosen", scenarioId: "crossborder-marketplace", variantId: "flash-deal", flow: "HUB_TO_CART_PROMOTION_HANDLER", check: "popup-handled", site: HUB_IN_CART, goalFacts: true },
    ],
  },
  {
    row: 5,
    scenario: "Popup removal fails: no loop, honest end",
    needs: ["handlers"],
    authoringGap: ELEMENT_FACT_GAP,
    cases: [{ caseId: "5", title: "the flash deal's close glyph does nothing; the handler runs within its budget and the run ends with the declared failure", scenarioId: "crossborder-marketplace", variantId: "flash-deal-stuck", flow: "HUB_TO_CART_PROMOTION_HANDLER", check: "popup-honest-end", declaredFailure: { category: "unexpected_state", code: "web.target.not_actionable" }, site: NOTHING_IN_CART, goalFacts: false }],
  },
  {
    row: 6,
    scenario: "Node and automation handlers both match: node wins, trace shows why",
    needs: ["handlers"],
    authoringGap: ELEMENT_FACT_GAP,
    cases: [{ caseId: "6", title: "a handler on the first step and one for the whole automation both match the arrival promotion; the step's runs", scenarioId: "crossborder-marketplace", variantId: "flash-deal-on-arrival", flow: "HUB_TO_CART_TWO_HANDLERS", check: "handler-precedence", expectHandler: "h1-", site: HUB_IN_CART, goalFacts: true }],
  },
  {
    row: 7,
    scenario: "Inactive part's handler matches: not run",
    needs: ["handlers"],
    cases: [{ caseId: "7", title: "both situation blocks register a handler for the consent dialog; only the block the Router chose runs its own", scenarioId: "bigbox-retail", flow: "SOAP_SEARCH_TWO_BLOCKS", check: "inactive-handler", quietSubflow: "store", site: { kind: "bigbox-cart", lines: [SOAP_ONLY], storeId: null }, goalFacts: false }],
  },
  {
    row: 8,
    scenario: "Primary way fails, known alternative passes the same check",
    needs: ["handlers", "call-subflow"],
    cases: [{ caseId: "8", title: "under the redesigned buy box the product page's Add to cart is gone; the fail handler adds from the results tile instead", scenarioId: "bigbox-retail", variantId: "redesigned-buy-box", flow: "QUICK_ADD_ALTERNATIVE", check: "known-alternative", expectHandler: "h1-", site: { kind: "bigbox-cart", lines: [{ productId: "418832007", qty: 2 }], storeId: null }, goalFacts: false }],
  },
  {
    row: 9,
    scenario: "Committing act's outcome lost: reconcile first",
    needs: ["reconciliation"],
    cases: [{ caseId: "9", title: "the acknowledgement of the second confirm never reaches Core; the confirm is reconciled, not repeated", scenarioId: "social-network-feed", workflowId: "confirm-requests", perturbation: { kind: "drop-action-result", afterCommittingActs: 2 }, flow: "CONFIRM_QUALIFYING", check: "outcome-reconciled", site: { kind: "social-confirmed", requestIds: QUALIFYING_REQUESTS, rateLimitedAtLeast: 0 }, goalFacts: false }],
  },
  {
    row: 10,
    scenario: "Route back to a checkpoint: no repeated confirmation",
    needs: ["handlers", "checkpoints"],
    cases: [{ caseId: "10", title: "the rate-limit notice sends the run back to the requests checkpoint; confirmed requests are not confirmed again", scenarioId: "social-network-feed", workflowId: "confirm-requests", flow: "CONFIRM_WITH_CHECKPOINT", check: "checkpoint-route", site: { kind: "social-confirmed", requestIds: QUALIFYING_REQUESTS, rateLimitedAtLeast: 1 }, goalFacts: false }],
  },
  {
    row: 11,
    scenario: "Service worker stopped mid-action",
    needs: ["reconciliation"],
    cases: [{ caseId: "11", title: "the extension's worker is stopped as Add to cart reaches the site; the add lands once and the run ends honestly", scenarioId: "crossborder-marketplace", perturbation: { kind: "stop-service-worker", onSiteRequest: "/api/crossborder-marketplace/add-to-cart" }, flow: "HUB_TO_CART", check: "worker-restart", site: HUB_IN_CART, goalFacts: true }],
  },
  {
    row: 13,
    scenario: "Retries and planned fails never call the model",
    needs: [],
    cases: [
      { caseId: "13a", title: "the fourth confirm is refused for going too fast; the node's retry confirms it after the notice's wait", scenarioId: "social-network-feed", workflowId: "confirm-requests", flow: "CONFIRM_QUALIFYING", check: "retries-absorbed", site: { kind: "social-confirmed", requestIds: QUALIFYING_REQUESTS, rateLimitedAtLeast: 1 }, goalFacts: false },
      { caseId: "13b", title: "a check fails on purpose and its failed path ends the run at an End the Flow marked failed", scenarioId: "social-network-feed", workflowId: "confirm-requests", flow: "CONFIRM_THEN_STOP", check: "deliberate-stop", site: { kind: "social-confirmed", requestIds: QUALIFYING_REQUESTS.slice(0, 3), rateLimitedAtLeast: 0 }, goalFacts: false },
    ],
  },
];
