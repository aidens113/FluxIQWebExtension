import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow, validateWebScenario, type ExpectedExtraction } from "@fluxiq-web-extension/test-contracts";
import { DISPATCH_RUN, defaultOrderFilters, filterOrders } from "../filters.js";
import { formatMoney, formatPlaced, lineTotalPence, orderTotalPence, refundedText } from "../format.js";
import { applyOrderChanges, bookCounts, bookSummaryText, isDispatchable, isRefundable, itemCountText, paymentAfterRefund } from "../ledger.js";
import { LINE_ITEM_ORDER, ORDER_BOOK_SIZE, QUIET_WEEK_SIZE, REFUND_ORDER, customerOrders, firstLineOf, quietWeekOrders } from "../orders.js";
import { orderOperationsScenario as scenario } from "../scenario.js";
import type { CustomerOrder, OrderOperationsState } from "../types.js";

const manifest = scenario.manifest;
const context = { runToken: "order-operations-unit-token", seed: 142 };
const initial = () => scenario.createState(scenario.seed);
const apply = (state: OrderOperationsState, operation: string, payload: unknown) => scenario.mutate(state, operation, payload);
const REFUND_PENCE = lineTotalPence(firstLineOf(REFUND_ORDER));
const DISPATCH_BATCH = filterOrders(customerOrders, DISPATCH_RUN);

function route(state: OrderOperationsState, subpath: string) {
  const handler = scenario.route;
  assert.ok(handler);
  return handler(state, { subpath, query: new URLSearchParams(""), method: "GET" }, context);
}

/** Tag text with whitespace collapsed: what `textContent` gives a column read. */
function text(html: string): string {
  return html.replace(/<[^>]*>/gu, " ").replaceAll("&#039;", "'").replace(/\s+/gu, " ").trim();
}

/** The document with its inline bundle taken out: the markup a person's browser paints. */
function markupOf(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gu, "");
}

function headers(html: string): string[] {
  const head = /<thead>([\s\S]*?)<\/thead>/u.exec(html)?.[1] ?? "";
  return [...head.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gu)].map((match) => text(match[1] ?? ""));
}

function rowCells(html: string, pattern: RegExp): string[] {
  const row = pattern.exec(html)?.[1];
  assert.ok(row, String(pattern));
  return [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gu)].map((match) => text(match[1] ?? ""));
}

function extraction(workflowId: string, stepId: string, variantId?: string): ExpectedExtraction {
  const selection = { workflowId, ...(variantId === undefined ? {} : { variantId }) };
  const found = resolveScenarioWorkflow(manifest, selection).expected.extracted?.find(({ step }) => step === stepId);
  assert.ok(found, `${workflowId} declares no dataset ${stepId}`);
  return found;
}

test("the manifest is valid and declares the three workflows and two variants the fixture renders", () => {
  const result = validateWebScenario(manifest);
  assert.equal(result.valid, true, result.valid ? "" : JSON.stringify(result.issues));
  assert.deepEqual(manifest.workflows?.map(({ id }) => id), ["export-order-batch", "read-line-items", "dispatch-batch"]);
  assert.deepEqual(manifest.workflows?.flatMap((workflow) => (workflow.variants ?? []).map(({ id }) => id)), ["quiet-week", "relabelled-dispatch"]);
  assert.equal(manifest.variants, undefined);
  assert.ok(manifest.playbackGoal);
});

test("the book is the size the fixture claims, and every reference and customer is its own", () => {
  assert.equal(customerOrders.length, ORDER_BOOK_SIZE);
  assert.equal(quietWeekOrders.length, QUIET_WEEK_SIZE);
  assert.equal(new Set(customerOrders.map(({ reference }) => reference)).size, ORDER_BOOK_SIZE);
  assert.equal(new Set(customerOrders.map(({ customer }) => customer)).size, ORDER_BOOK_SIZE);
  for (const order of customerOrders) {
    assert.ok(order.lines.length >= 2, order.reference);
    assert.equal(new Set(order.lines.map(({ sku }) => sku)).size, order.lines.length, order.reference);
    assert.equal(orderTotalPence(order), order.lines.reduce((total, line) => total + lineTotalPence(line), 0));
  }
});

test("the two orders the workflows name are the ones their jobs need, and each is the only row its customer matches", () => {
  assert.equal(REFUND_ORDER.payment, "Paid");
  assert.ok(REFUND_PENCE > 0 && REFUND_PENCE < orderTotalPence(REFUND_ORDER), "refunding one line must leave the order part refunded");
  assert.equal(LINE_ITEM_ORDER.lines.length, 4);
  assert.notEqual(LINE_ITEM_ORDER.reference, REFUND_ORDER.reference);
  for (const order of [REFUND_ORDER, LINE_ITEM_ORDER]) {
    const matching = filterOrders(customerOrders, { ...defaultOrderFilters(), search: order.customer });
    assert.deepEqual(matching.map(({ reference }) => reference), [order.reference], order.customer);
  }
});

test("the batch and the dispatch run are both non-empty, so neither read is an empty table", () => {
  const batchFilters = { ...defaultOrderFilters(), payment: "paid", fulfilment: "unfulfilled", placedFrom: "2026-03-01", placedTo: "2026-03-14" };
  assert.ok(filterOrders(customerOrders, batchFilters).length > 1);
  assert.ok(filterOrders(quietWeekOrders, batchFilters).length > 0);
  assert.ok(DISPATCH_BATCH.length > 1);
  for (const order of DISPATCH_BATCH) {
    assert.ok(isDispatchable(order), order.reference);
    assert.ok(order.placed >= DISPATCH_RUN.placedFrom && order.placed <= DISPATCH_RUN.placedTo, order.placed);
  }
  assert.equal(extraction("dispatch-batch", "extract-dispatch-note").count, DISPATCH_BATCH.length);
});

test("the start page renders every order, with generated class names and no authored ones", () => {
  const html = scenario.render(initial(), context);
  assert.equal([...html.matchAll(/data-order-ref="/gu)].length, ORDER_BOOK_SIZE);
  const classNames = [...markupOf(html).matchAll(/class="([^"]*)"/gu)].flatMap((match) => (match[1] ?? "").split(" ")).filter((name) => name !== "");
  assert.deepEqual([...new Set(classNames.filter((name) => !/^css-[0-9a-z]{7}$/u.test(name)))], []);
  assert.ok(html.includes(`data-testid="book-summary">${bookSummaryText(customerOrders)}<`));
  // The lines, the address and the refund control are on the order's own page.
  assert.ok(!html.includes(firstLineOf(REFUND_ORDER).sku));
  assert.ok(!html.includes(`data-testid="issue-refund"`));
});

test("the book column read the export workflow declares is what the rendered rows hold", () => {
  const html = scenario.render(initial(), context);
  const columns = headers(html);
  const declared = extraction("export-order-batch", "extract-order-batch");
  assert.ok((declared.records ?? []).length > 0);
  for (const record of declared.records ?? []) {
    const cells = rowCells(html, new RegExp(`<tr class="[^"]*" data-order-ref="${record.reference}" [^>]*>([\\s\\S]*?)</tr>`, "u"));
    const cell = (header: string) => cells[columns.indexOf(header)];
    assert.equal(cell("Order"), record.reference);
    assert.equal(cell("Customer"), record.customer);
    assert.equal(cell("Placed"), record.placed);
    assert.equal(cell("Total"), record.total);
    assert.equal(cell("Payment"), record.payment);
  }
});

test("the line read the detail workflow declares is what one order's page holds", () => {
  const served = route(initial(), `orders/${LINE_ITEM_ORDER.reference}`);
  assert.equal(served?.status, 200);
  const html = served?.body ?? "";
  const columns = headers(/<h2 id="items-heading">[\s\S]*?<table[\s\S]*?<\/table>/u.exec(html)?.[0] ?? "");
  const declared = extraction("read-line-items", "extract-line-items");
  assert.equal(declared.records?.length, LINE_ITEM_ORDER.lines.length);
  for (const record of declared.records ?? []) {
    const cells = rowCells(html, new RegExp(`<tr data-sku="${record.sku}">([\\s\\S]*?)</tr>`, "u"));
    const cell = (header: string) => cells[columns.indexOf(header)];
    assert.equal(cell("Item"), record.item);
    assert.equal(cell("Quantity"), record.quantity);
    assert.equal(cell("Unit price"), record.unitPrice);
    assert.equal(cell("Line total"), record.lineTotal);
  }
  assert.ok(html.includes(`data-testid="delivery-address"`));
  assert.ok(html.includes(formatPlaced(LINE_ITEM_ORDER.placed)));
});

test("a partial refund leaves the order part refunded and the whole of it refunded outright", () => {
  const part = apply(initial(), "refund-order", { reference: REFUND_ORDER.reference, amountPence: REFUND_PENCE, reason: "Goodwill" });
  const afterPart = applyOrderChanges(customerOrders, part.refunds, part.dispatched, part.cancelled);
  assert.equal(orderIn(afterPart, REFUND_ORDER.reference).payment, "Part refunded");
  assert.equal(refundedText(part.refunds[REFUND_ORDER.reference] ?? 0), refundedText(REFUND_PENCE));
  assert.equal(part.oracle.refundedCount, bookCounts(customerOrders).refundedCount + 1);

  const whole = apply(part, "refund-order", { reference: REFUND_ORDER.reference, amountPence: orderTotalPence(REFUND_ORDER), reason: "Goodwill" });
  assert.equal(whole.refunds[REFUND_ORDER.reference], orderTotalPence(REFUND_ORDER));
  assert.equal(paymentAfterRefund(REFUND_ORDER, orderTotalPence(REFUND_ORDER)), "Refunded");
});

test("dispatching the run empties the state the run was working in, which is what the note records", () => {
  const references = DISPATCH_BATCH.map(({ reference }) => reference);
  const sent = apply(initial(), "dispatch-orders", { references });
  const after = applyOrderChanges(customerOrders, sent.refunds, sent.dispatched, sent.cancelled);
  assert.deepEqual(sent.dispatched, references);
  assert.equal(filterOrders(after, DISPATCH_RUN).length, 0);
  assert.equal(bookSummaryText(after), manifestFact("dispatch-batch", "book-summary"));
  assert.equal(
    manifestFact("dispatch-batch", "dispatch-note-written"),
    `${references.length} orders handed to the carrier.`,
  );
  const note = route(sent, "dispatch-note");
  for (const order of DISPATCH_BATCH) {
    assert.ok(note?.body?.includes(`data-order-ref="${order.reference}"`), order.reference);
    assert.ok(note?.body?.includes(itemCountText(order)), order.reference);
  }
});

test("the desk refuses a change the order is not in a state for, whatever the page sends", () => {
  const state = initial();
  const notPaid = customerOrders.find((order) => !isRefundable(order));
  assert.ok(notPaid);
  const rejected: Array<[string, unknown]> = [
    ["refund-order", { reference: notPaid.reference, amountPence: 500, reason: "Goodwill" }],
    ["refund-order", { reference: REFUND_ORDER.reference, amountPence: 0, reason: "Goodwill" }],
    ["refund-order", { reference: REFUND_ORDER.reference, amountPence: -500, reason: "Goodwill" }],
    ["refund-order", { reference: "ORD-00000", amountPence: 500, reason: "Goodwill" }],
    ["dispatch-orders", { references: [notPaid.reference] }],
    ["dispatch-orders", { references: "ORD-40100" }],
    ["cancel-order", { reference: 42 }],
    ["set-mode", { mode: "nonsense" }],
    ["unknown-operation", { reference: REFUND_ORDER.reference }],
  ];
  for (const [operation, payload] of rejected) assert.equal(apply(state, operation, payload), state, `${operation} ${JSON.stringify(payload)}`);
  for (const payload of [null, "text", ["array"], 7]) assert.equal(apply(state, "cancel-order", payload), state, JSON.stringify(payload));
});

test("a refund is capped at what the order came to, however often it is asked for", () => {
  let state = initial();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    state = apply(state, "refund-order", { reference: REFUND_ORDER.reference, amountPence: orderTotalPence(REFUND_ORDER), reason: "Goodwill" });
  }
  assert.equal(state.refunds[REFUND_ORDER.reference], orderTotalPence(REFUND_ORDER));
});

test("arming a rendering clears what an earlier run did, so an armed run's oracle is its own", () => {
  const worked = apply(initial(), "refund-order", { reference: REFUND_ORDER.reference, amountPence: REFUND_PENCE, reason: "Goodwill" });
  const armed = apply(worked, "set-mode", { mode: "quiet-week" });
  assert.deepEqual([armed.refunds, armed.dispatched, armed.cancelled], [{}, [], []]);
  assert.equal(armed.oracle.orderCount, QUIET_WEEK_SIZE);
  assert.equal(extraction("export-order-batch", "extract-order-batch", "quiet-week").count, filterOrders(quietWeekOrders, {
    ...defaultOrderFilters(), payment: "paid", fulfilment: "unfulfilled", placedFrom: "2026-03-01", placedTo: "2026-03-14",
  }).length);
});

test("the relabelled rendering drops every identifier from the dispatch-run shortcut and keeps its neighbours", () => {
  const baseline = scenario.render(initial(), context);
  const armed = scenario.render(apply(initial(), "set-mode", { mode: "relabelled-dispatch" }), context);
  assert.ok(baseline.includes(`data-testid="dispatch-run"`));
  assert.ok(!armed.includes(`data-testid="dispatch-run"`));
  assert.ok(!armed.includes("Dispatch run"));
  assert.ok(armed.includes("Pick and pack"));
  for (const decoy of [`data-action="export"`, `data-action="new-order"`]) assert.ok(armed.includes(decoy), decoy);
  const variant = manifest.workflows?.find(({ id }) => id === "dispatch-batch")?.variants?.[0];
  const declared = variant?.expected.pageFacts?.find(({ id }) => id === "recorded-dispatch-run-gone");
  assert.deepEqual([declared?.subject, declared?.predicate, declared?.value], ["dispatch-run", "exists", false]);
});

test("the route serves an order, its summary and the dispatch note, and nothing else", () => {
  const state = initial();
  assert.equal(route(state, `orders/${REFUND_ORDER.reference}`)?.status, 200);
  const summary = route(state, `orders/${REFUND_ORDER.reference}/summary`);
  assert.ok(summary?.body?.includes(`data-testid="order-summary"`));
  assert.ok(summary?.body?.includes(refundedText(0)));
  assert.ok(summary?.body?.includes(formatMoney(orderTotalPence(REFUND_ORDER))));
  assert.equal(route(state, "dispatch-note")?.body, "");
  for (const missing of ["orders/ORD-00000", "orders/nonsense", "orders/ORD-40100/nope", ""]) assert.equal(route(state, missing), undefined, missing);
});

function orderIn(orders: readonly CustomerOrder[], reference: string): CustomerOrder {
  const found = orders.find((order) => order.reference === reference);
  assert.ok(found, reference);
  return found;
}

function manifestFact(workflowId: string, factId: string): unknown {
  const workflow = manifest.workflows?.find(({ id }) => id === workflowId);
  return workflow?.expected.finalState?.find(({ id }) => id === factId)?.value;
}
