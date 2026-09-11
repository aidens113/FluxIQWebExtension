import { createScenarioManifest } from "../../types.js";
import { purchaseOrdersFor } from "./purchase-orders.js";

const SEED = 118;
const OPENED_ORDER = "PO-4472";
const openedRecord = purchaseOrdersFor(SEED).find((order) => order.order === OPENED_ORDER);
if (!openedRecord) throw new Error(`multi-tab: seed ${SEED} has no ${OPENED_ORDER}`);

const detailField = (key: string) => `[data-testid="detail-${key}"]`;

/**
 * Corpus row W15. The primary workflow opens PO-4472's details from the list
 * in a new tab, switches to that tab, extracts the order, closes the tab, and
 * confirms the review on the list, which the fixture accepts only for an
 * order whose details were visited. `popup-blocked` refuses every open path;
 * the report for this fixture justifies its expected failure category.
 */
export const multiTabManifest = createScenarioManifest({
  id: "multi-tab", title: "Multiple tabs", tags: ["multi-tab", "popup", "window-open", "extract"], seed: SEED,
  startPath: "/scenarios/multi-tab/", capabilities: ["popup", "mutation"],
  recordingScript: [
    { id: "open-order-details", operation: "click", target: "testid:open-details-po-4472" },
    { id: "switch-to-details", operation: "switchTab", path: "/scenarios/multi-tab/details/PO-4472", timeoutMs: 3000 },
    { id: "details-loaded", operation: "waitForState", target: "testid:order-details", timeoutMs: 3000 },
    {
      id: "extract-order-details", operation: "extract", target: "testid:order-details",
      fields: {
        order: detailField("order"), supplier: detailField("supplier"), status: detailField("status"),
        buyer: detailField("buyer"), delivery: detailField("delivery"), total: detailField("total"),
      },
    },
    { id: "close-details-tab", operation: "closeTab" },
    { id: "order-list-restored", operation: "waitForState", target: "testid:order-list", timeoutMs: 3000 },
    { id: "confirm-order-review", operation: "click", target: "testid:confirm-review-po-4472" },
    { id: "review-recorded", operation: "waitForState", target: "testid:reviewed-po-4472", timeoutMs: 3000 },
    { id: "multi-tab-final", operation: "checkpoint" },
  ],
  expected: {
    pageFacts: [{ id: "order-list-visible", subject: "order-list", predicate: "visible", value: true }],
    recordingEvents: [{ type: "web.element.clicked" }],
    actions: [{ action: "web.dom.click", outcome: "succeeded" }, { action: "web.dom.extract", outcome: "succeeded" }],
    finalState: [
      { id: "back-on-order-list", subject: "document", predicate: "path", value: "/scenarios/multi-tab/" },
      { id: "order-reviewed", subject: "reviewed-po-4472", predicate: "text", value: "Reviewed" },
      { id: "review-confirmed", subject: "review-result", predicate: "text", value: "PO-4472 review confirmed." },
    ],
    extracted: [{ step: "extract-order-details", count: 1, records: [{ ...openedRecord }] }],
    allowedConsoleErrors: [],
  },
  variants: [{
    id: "popup-blocked",
    description: "The list page refuses both open paths, the new-tab link and the window.open control, and shows an inline pop-up-blocked notice instead; no details tab opens.",
    arm: { operation: "block-popups" },
    expected: {
      actions: [{ action: "web.dom.click" }],
      finalState: [
        { id: "still-on-order-list", subject: "document", predicate: "path", value: "/scenarios/multi-tab/" },
        { id: "popup-notice-shown", subject: "open-notice", predicate: "contains", value: "Pop-up blocked: PO-4472 did not open." },
        { id: "order-not-reviewed", subject: "reviewed-po-4472", predicate: "exists", value: false },
      ],
      extracted: [],
      failure: { category: "output_not_observed" },
    },
  }],
});
