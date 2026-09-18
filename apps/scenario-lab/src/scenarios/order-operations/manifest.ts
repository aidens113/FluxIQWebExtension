import { createScenarioManifest } from "../../types.js";
import { DISPATCH_RUN, defaultOrderFilters, filterOrders } from "./filters.js";
import { formatMoney, formatPlaced, lineTotalPence, orderTotalPence, refundedText } from "./format.js";
import { applyOrderChanges, bookSummaryText, itemCountText, ordersFor, resultCountText } from "./ledger.js";
import { LINE_ITEM_ORDER, REFUND_ORDER, firstLineOf } from "./orders.js";
import { orderBuildMarker } from "./styles.js";
import type { CustomerOrder } from "./types.js";

/** The rows an extract step reads: real orders only, never the empty-state row a filter with no matches renders. */
const ORDER_ROWS = `[data-testid="order-rows"] > tr[data-order-ref]`;
/** One order's own lines. */
const LINE_ROWS = `[data-testid="line-items"] > tr[data-sku]`;
/** The dispatch note's rows, which exist only once something has actually been dispatched. */
const DISPATCH_ROWS = `[data-testid="dispatch-rows"] > tr[data-order-ref]`;
/** The way into one order, addressed the only way it can be: by the row it is in. */
const orderOpener = (reference: string) => `[data-order-ref="${reference}"] a`;

/** The date range the batch export asks for: the first fortnight of March. */
const BATCH_FROM = "2026-03-01";
const BATCH_TO = "2026-03-14";

const BASELINE = ordersFor("baseline");
const QUIET = ordersFor("quiet-week");
const batchFilters = { ...defaultOrderFilters(), payment: "paid", fulfilment: "unfulfilled", placedFrom: BATCH_FROM, placedTo: BATCH_TO };
const BATCH = filterOrders(BASELINE, batchFilters);
const QUIET_BATCH = filterOrders(QUIET, batchFilters);
/** This week's paid, unpicked orders: what the dispatch-run shortcut selects and the run hands to the carrier. */
const DISPATCH_BATCH = filterOrders(BASELINE, DISPATCH_RUN);
const AFTER_DISPATCH = applyOrderChanges(BASELINE, {}, DISPATCH_BATCH.map((order) => order.reference), []);

/** What a partial refund gives back: the value of the order's first line, which is less than the order came to. */
const REFUND_PENCE = lineTotalPence(firstLineOf(REFUND_ORDER));
/** The same amount as a person types it into a money box: the figure without its currency mark. */
const REFUND_TYPED = formatMoney(REFUND_PENCE).slice(1);

/**
 * What a person exporting this book would read. `column:` follows the header
 * rather than the column position, so the read survives a column reorder.
 */
const orderFields = {
  reference: "column:Order",
  customer: "column:Customer",
  placed: "column:Placed",
  total: "column:Total",
  payment: "column:Payment",
};

/** What one order's own page holds, and the list does not: the lines the total is made of. */
const lineFields = {
  item: "column:Item",
  sku: "column:SKU",
  quantity: "column:Quantity",
  unitPrice: "column:Unit price",
  lineTotal: "column:Line total",
};

/** What the dispatch note holds, which exists only because the run dispatched something. */
const dispatchFields = {
  order: "column:Order",
  customer: "column:Customer",
  items: "column:Items",
  total: "column:Total",
};

const bookLine = (orders: readonly CustomerOrder[]) => ({ id: "book-summary", subject: "book-summary", predicate: "text", value: bookSummaryText(orders) });
const listed = (orders: readonly CustomerOrder[]) => ({ id: "rows-listed", subject: "result-count", predicate: "text", value: resultCountText(orders.length, orders.length) });
const showing = (shown: number, total: number) => ({ id: "rows-shown", subject: "result-count", predicate: "text", value: resultCountText(shown, total) });
/**
 * "No filters are applied" as a page fact, for a workflow's own unarmed page.
 *
 * It is deliberately never declared on a variant. `filter-summary` is a control
 * the recording waits on, and the repair-coverage check reads a variant's
 * "this recorded subject does not exist" fact as the drift having removed it
 * (`tests/live-repair-tasks.test.ts`). On a variant that changes only data, that
 * reading would be wrong, and it would demand a repair task for a row a
 * recorded Flow passes perfectly well.
 */
const unfiltered = { id: "no-filters", subject: "filter-summary", predicate: "exists", value: false };
const filtered = { id: "filters-shown", subject: "filter-summary", predicate: "exists", value: true };
const confirmDialogClosed = { id: "confirm-dialog-closed", subject: "confirm-dialog", predicate: "exists", value: false };
const buildMarker = { id: "build-marker", subject: "build-marker", predicate: "text", value: orderBuildMarker() };
/**
 * The top bar's search input and the book filter's are both labelled "Search":
 * two controls on one page with one accessible name, neither distinguishable
 * from the other by its name alone.
 */
const duplicateSearchLabels = { id: "duplicate-search-labels", subject: "document", predicate: "label-count:Search", value: 2 };

/** The final state of a dispatch run, however it was carried out: the batch gone, and the note saying what went. */
const DISPATCHED = [
  bookLine(AFTER_DISPATCH),
  { id: "dispatch-note-written", subject: "dispatch-note-summary", predicate: "text", value: `${DISPATCH_BATCH.length === 1 ? "1 order" : `${DISPATCH_BATCH.length} orders`} handed to the carrier.` },
  // The filters are still this week's paid and unpicked orders, and nothing is
  // in that state any more, so the table the run was working in is now empty.
  showing(0, BASELINE.length),
];

/**
 * An order back office at the scale and with the markup of a real one: a
 * 280-order book, generated class names, a portalled row menu, one action
 * button per row identical to the other 279, and an order page of its own
 * carrying the lines, the address and the refund control.
 *
 * Four workflows, and every one of them requires a multi-step automation with
 * a consequence. The manifest's own script finds one customer's order, opens
 * it, refunds the value of a line it had to read there, and leaves the order
 * part refunded; `export-order-batch` narrows the book by state and date range
 * and reads what is left; `read-line-items` opens one order and reads the lines
 * that make its total up; `dispatch-batch` hands this week's paid, unpicked
 * orders to the carrier and reads back the note that only exists because it
 * did.
 *
 * `recordingEvents` name types without counts on purpose. No recording lane has
 * run this fixture yet, so "this type occurred" is a claim that can be made
 * honestly and an exact tally is not; a count belongs here once a run has
 * produced one.
 */
export const orderOperationsManifest = createScenarioManifest({
  id: "order-operations",
  title: "Order operations",
  tags: ["orders", "back-office", "table", "generated-classes", "row-actions", "bulk-actions", "modal", "refund", "cross-screen"],
  seed: 142,
  startPath: "/scenarios/order-operations/",
  capabilities: ["forms", "mutation", "navigation", "scroll"],
  recordingScript: [
    { id: "find-customer", operation: "type", target: "testid:order-search", value: REFUND_ORDER.customer },
    { id: "customer-found", operation: "waitForState", target: "testid:filter-summary", timeoutMs: 2000 },
    { id: "open-order", operation: "click", target: orderOpener(REFUND_ORDER.reference) },
    { id: "order-open", operation: "waitForState", target: "testid:order-detail", timeoutMs: 5000 },
    // The amount is the value of the order's first line, which is on this page
    // and on no other, so a run has to read it here before it can type it.
    { id: "enter-refund-amount", operation: "type", target: "testid:refund-amount", value: REFUND_TYPED },
    { id: "choose-refund-reason", operation: "select", target: "testid:refund-reason", value: "damaged-on-arrival" },
    // Disabled until an amount above zero and a reason have been given.
    { id: "issue-refund", operation: "click", target: "testid:issue-refund" },
    { id: "refund-confirmation", operation: "waitForState", target: "testid:confirm-dialog", timeoutMs: 2000 },
    { id: "confirm-refund", operation: "click", target: "role:button:Refund this order" },
    // The desk raises this toast only after the summary has been fetched back,
    // so waiting for it is what makes the facts below the refunded order.
    { id: "refund-recorded", operation: "waitForState", target: "testid:toast", timeoutMs: 5000 },
    { id: "refund-done", operation: "checkpoint" },
  ],
  playbackGoal: {
    id: "refund-one-line",
    description: `Refund the value of the first line on ${REFUND_ORDER.customer}'s order and leave the order showing that part of it has been given back.`,
    // Says nothing about how the refund was reached: the row menu, the search
    // box or the reference all end at the same order page, and refunding the
    // wrong amount fails the second fact.
    successFacts: [
      { id: "payment-part-refunded", subject: "payment-state", predicate: "text", value: "Part refunded" },
      { id: "refunded-amount", subject: "refunded-total", predicate: "text", value: refundedText(REFUND_PENCE) },
    ],
  },
  expected: {
    pageFacts: [bookLine(BASELINE), listed(BASELINE), unfiltered, duplicateSearchLabels, buildMarker],
    recordingEvents: [{ type: "web.element.clicked" }, { type: "web.element.changed" }, { type: "web.element.input_changed" }],
    actions: [
      { action: "web.dom.type", outcome: "succeeded" },
      { action: "web.dom.select", outcome: "succeeded" },
      { action: "web.dom.click", outcome: "succeeded" },
    ],
    finalState: [
      { id: "payment-part-refunded", subject: "payment-state", predicate: "text", value: "Part refunded" },
      { id: "refunded-amount", subject: "refunded-total", predicate: "text", value: refundedText(REFUND_PENCE) },
      { id: "order-total-unchanged", subject: "order-total", predicate: "text", value: formatMoney(orderTotalPence(REFUND_ORDER)) },
      { id: "refund-toast", subject: "toast", predicate: "text", value: `Refund recorded against ${REFUND_ORDER.reference}` },
      confirmDialogClosed,
    ],
    allowedConsoleErrors: [],
  },
  workflows: [
    {
      id: "export-order-batch",
      description: `Narrow the book to paid, unpicked orders placed between ${formatPlaced(BATCH_FROM)} and ${formatPlaced(BATCH_TO)}, and export what is left.`,
      recordingScript: [
        { id: "filter-paid", operation: "select", target: "testid:payment-filter", value: "paid" },
        { id: "filter-unfulfilled", operation: "select", target: "testid:fulfilment-filter", value: "unfulfilled" },
        { id: "set-placed-from", operation: "type", target: "testid:placed-from", value: BATCH_FROM },
        { id: "set-placed-to", operation: "type", target: "testid:placed-to", value: BATCH_TO },
        { id: "batch-filtered", operation: "waitForState", target: "testid:filter-summary", timeoutMs: 2000 },
        { id: "extract-order-batch", operation: "extract", target: ORDER_ROWS, fields: orderFields },
        { id: "order-batch-extracted", operation: "checkpoint" },
      ],
      expected: {
        pageFacts: [bookLine(BASELINE), listed(BASELINE), unfiltered, duplicateSearchLabels],
        recordingEvents: [{ type: "web.element.changed" }, { type: "web.element.input_changed" }],
        actions: [
          { action: "web.dom.select", outcome: "succeeded" },
          { action: "web.dom.type", outcome: "succeeded" },
          { action: "web.dom.extract_list" },
        ],
        extracted: [{ step: "extract-order-batch", count: BATCH.length, records: orderRecords(BATCH) }],
        finalState: [showing(BATCH.length, BASELINE.length), filtered],
        allowedConsoleErrors: [],
      },
      variants: [{
        id: "quiet-week",
        description: "A short trading period, so the book holds far fewer orders. Nothing on the page moves: the same filters, the same columns and the same read, returning the shorter batch that is left.",
        arm: { operation: "set-mode", payload: { mode: "quiet-week" } },
        expected: {
          pageFacts: [bookLine(QUIET), listed(QUIET), buildMarker],
          extracted: [{ step: "extract-order-batch", count: QUIET_BATCH.length, records: orderRecords(QUIET_BATCH) }],
          finalState: [showing(QUIET_BATCH.length, QUIET.length), filtered],
        },
      }],
    },
    {
      id: "read-line-items",
      description: `Find ${LINE_ITEM_ORDER.customer}'s order in the book, open it, and read the lines its total is made of.`,
      recordingScript: [
        { id: "find-line-item-customer", operation: "type", target: "testid:order-search", value: LINE_ITEM_ORDER.customer },
        { id: "line-item-customer-found", operation: "waitForState", target: "testid:filter-summary", timeoutMs: 2000 },
        { id: "open-line-item-order", operation: "click", target: orderOpener(LINE_ITEM_ORDER.reference) },
        { id: "line-item-order-open", operation: "waitForState", target: "testid:order-detail", timeoutMs: 5000 },
        { id: "extract-line-items", operation: "extract", target: LINE_ROWS, fields: lineFields },
        { id: "line-items-read", operation: "checkpoint" },
      ],
      expected: {
        pageFacts: [bookLine(BASELINE), listed(BASELINE), unfiltered, duplicateSearchLabels],
        recordingEvents: [{ type: "web.element.clicked" }, { type: "web.element.input_changed" }],
        actions: [
          { action: "web.dom.type", outcome: "succeeded" },
          { action: "web.dom.click", outcome: "succeeded" },
          { action: "web.dom.extract_list" },
        ],
        extracted: [{ step: "extract-line-items", count: LINE_ITEM_ORDER.lines.length, records: lineRecords(LINE_ITEM_ORDER) }],
        finalState: [
          { id: "line-item-order-total", subject: "order-total", predicate: "text", value: formatMoney(orderTotalPence(LINE_ITEM_ORDER)) },
          { id: "on-the-order-page", subject: "document", predicate: "path", value: `/scenarios/order-operations/orders/${LINE_ITEM_ORDER.reference}` },
        ],
        allowedConsoleErrors: [],
      },
    },
    {
      id: "dispatch-batch",
      description: "Start the dispatch run, hand this week's paid, unpicked orders to the carrier, and read back the note that only exists because they went.",
      recordingScript: [
        { id: "start-dispatch-run", operation: "click", target: "testid:dispatch-run" },
        { id: "dispatch-run-filtered", operation: "waitForState", target: "testid:filter-summary", timeoutMs: 2000 },
        { id: "select-the-run", operation: "check", target: "role:checkbox:Select every order in this list", value: true },
        { id: "open-dispatch", operation: "click", target: "role:button:Mark dispatched" },
        { id: "dispatch-confirmation", operation: "waitForState", target: "testid:confirm-dialog", timeoutMs: 2000 },
        { id: "confirm-dispatch", operation: "click", target: "role:button:Mark as dispatched" },
        { id: "dispatch-note-shown", operation: "waitForState", target: "testid:dispatch-note", timeoutMs: 5000 },
        { id: "extract-dispatch-note", operation: "extract", target: DISPATCH_ROWS, fields: dispatchFields },
        { id: "dispatch-batch-done", operation: "checkpoint" },
      ],
      expected: {
        pageFacts: [bookLine(BASELINE), listed(BASELINE), unfiltered, duplicateSearchLabels, buildMarker],
        recordingEvents: [{ type: "web.element.clicked" }, { type: "web.element.changed" }],
        actions: [{ action: "web.dom.click", outcome: "succeeded" }, { action: "web.dom.extract_list" }],
        extracted: [{ step: "extract-dispatch-note", count: DISPATCH_BATCH.length, records: dispatchRecords(DISPATCH_BATCH) }],
        finalState: [...DISPATCHED, confirmDialogClosed],
        allowedConsoleErrors: [],
      },
      variants: [{
        id: "relabelled-dispatch",
        description: "Only a repair can pass this row. The dispatch-run shortcut was redesigned: the same control in the same place doing the same job, with none of the three things a recording wrote down -- no test id, a new class, and the label renamed to Pick and pack -- so the element matcher refuses it and a provider-free run fails with target_not_found. The expectations are the repaired run's: a model that re-points the click at Pick and pack reaches the same batch and sends the same orders. Export and New order sit beside it as the pressable wrong answers; either leaves the whole book selected and dispatches orders nobody paid for.",
        arm: { operation: "set-mode", payload: { mode: "relabelled-dispatch" } },
        expected: {
          pageFacts: [
            { id: "recorded-dispatch-run-gone", subject: "dispatch-run", predicate: "exists", value: false },
            bookLine(BASELINE), listed(BASELINE), buildMarker,
          ],
          actions: [{ action: "web.dom.click", outcome: "succeeded" }, { action: "web.dom.extract_list" }],
          extracted: [{ step: "extract-dispatch-note", count: DISPATCH_BATCH.length, records: dispatchRecords(DISPATCH_BATCH) }],
          finalState: [...DISPATCHED, confirmDialogClosed],
        },
      }],
    },
  ],
});

/** The records the book yields for a set of orders, in the page's own text. */
function orderRecords(orders: readonly CustomerOrder[]): Array<Record<string, string>> {
  return orders.map((order) => ({
    reference: order.reference,
    customer: order.customer,
    placed: formatPlaced(order.placed),
    total: formatMoney(orderTotalPence(order)),
    payment: order.payment,
  }));
}

/** The records one order's own page yields for its lines. */
function lineRecords(order: CustomerOrder): Array<Record<string, string>> {
  return order.lines.map((line) => ({
    item: line.item,
    sku: line.sku,
    quantity: String(line.quantity),
    unitPrice: formatMoney(line.unitPence),
    lineTotal: formatMoney(lineTotalPence(line)),
  }));
}

/** The records the dispatch note yields. It exists only once the orders have actually been dispatched. */
function dispatchRecords(orders: readonly CustomerOrder[]): Array<Record<string, string>> {
  return orders.map((order) => ({
    order: order.reference,
    customer: order.customer,
    items: itemCountText(order),
    total: formatMoney(orderTotalPence(order)),
  }));
}
