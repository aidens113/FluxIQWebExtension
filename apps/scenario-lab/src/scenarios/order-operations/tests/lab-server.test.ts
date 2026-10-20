import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { startScenarioLab, type RunningScenarioLab } from "../../../server.js";
import { DISPATCH_RUN, defaultOrderFilters, filterOrders } from "../filters.js";
import { lineTotalPence, orderPath } from "../format.js";
import { bookCounts } from "../ledger.js";
import { REFUND_ORDER, customerOrders, firstLineOf } from "../orders.js";
import { orderOperationsScenario } from "../scenario.js";
import type { OrderOperationsState } from "../types.js";

/**
 * The back office's server side, driven over HTTP exactly as its client script
 * and the Testing Lab drive it: the refund, dispatch and variant-arm operations
 * through `/api/order-operations/<operation>`, an order's own page through its
 * route, and the oracle through `/__control/final-state`. These replace the
 * server-side halves of the retired browser spec; its browser halves (the
 * refund button enabling as the form is filled, filters re-rendering the
 * table, hashed classes counted in a live DOM) are fixture behaviour no
 * browser test may open.
 */

const SCENARIO = "order-operations";
const manifest = orderOperationsScenario.manifest;
const BASE = bookCounts(customerOrders);
const REFUND_PENCE = lineTotalPence(firstLineOf(REFUND_ORDER));
const DISPATCH_BATCH = filterOrders(customerOrders, DISPATCH_RUN).map(({ reference }) => reference);

async function withLab(run: (io: ReturnType<typeof client>) => Promise<void>): Promise<void> {
  const lab = await startScenarioLab({ runToken: "order-operations-lab-server-token", seed: 42 });
  try { await run(client(lab)); } finally { await lab.close(); }
}

function client(lab: RunningScenarioLab) {
  const authorization = `Bearer ${lab.runToken}`;
  return {
    get: async (path: string) => {
      const response = await fetch(`${lab.origin}${path}`);
      return { status: response.status, body: await response.text() };
    },
    post: async (operation: string, payload: unknown) => {
      const response = await fetch(`${lab.origin}/api/${SCENARIO}/${operation}`, {
        method: "POST", headers: { authorization, "content-type": "application/json" }, body: JSON.stringify(payload),
      });
      assert.equal(response.status, 200, operation);
      return (await response.json() as { mutation: { status: string } }).mutation.status;
    },
    arm: async (workflowId: string, variantId: string) => {
      const { variant } = resolveScenarioWorkflow(manifest, { workflowId, variantId });
      assert.ok(variant, variantId);
      const response = await fetch(`${lab.origin}/api/${SCENARIO}/${variant.arm.operation}`, {
        method: "POST", headers: { authorization, "content-type": "application/json" }, body: JSON.stringify(variant.arm.payload ?? {}),
      });
      assert.equal(response.status, 200, `arming ${variantId}`);
    },
    state: async () => {
      const response = await fetch(`${lab.origin}/__control/final-state?scenario=${SCENARIO}`, { headers: { authorization } });
      assert.equal(response.status, 200);
      return (await response.json() as { state: OrderOperationsState }).state;
    },
  };
}

test("over HTTP, refunding one line leaves the desk holding a part-refunded order", async () => withLab(async (io) => {
  assert.equal(await io.post("refund-order", { reference: REFUND_ORDER.reference, amountPence: REFUND_PENCE, reason: "Goodwill" }), "changed");
  const state = await io.state();
  assert.deepEqual(state.refunds, { [REFUND_ORDER.reference]: REFUND_PENCE });
  assert.deepEqual(state.dispatched, []);
  assert.deepEqual([state.oracle.orderCount, state.oracle.refundedCount], [BASE.orderCount, BASE.refundedCount + 1]);
}));

test("over HTTP, the dispatch run records what went and empties the awaiting line by that much", async () => withLab(async (io) => {
  assert.ok(DISPATCH_BATCH.length > 1);
  assert.equal(await io.post("dispatch-orders", { references: DISPATCH_BATCH }), "changed");
  const state = await io.state();
  assert.deepEqual(state.dispatched, DISPATCH_BATCH);
  assert.equal(state.oracle.awaitingDispatchCount, BASE.awaitingDispatchCount - DISPATCH_BATCH.length);
  assert.equal(await io.post("dispatch-orders", { references: DISPATCH_BATCH }), "no_change", "an order already sent is not sent again");
}));

test("over HTTP, the relabelled rendering drops the shortcut and the repaired run still dispatches the batch", async () => withLab(async (io) => {
  await io.arm("dispatch-batch", "relabelled-dispatch");
  const page = (await io.get(orderOperationsScenario.startPath)).body;
  assert.equal(page.includes(`data-testid="dispatch-run"`), false);
  assert.ok(page.includes("Pick and pack"));
  await io.post("dispatch-orders", { references: DISPATCH_BATCH });
  const state = await io.state();
  assert.deepEqual([state.mode, state.dispatched], ["relabelled-dispatch", DISPATCH_BATCH]);
}));

test("over HTTP, an unpaid order's page offers no refund and no dispatch, and serving it records nothing", async () => withLab(async (io) => {
  const unpaid = customerOrders.find((order) => order.payment === "Failed");
  assert.ok(unpaid, "the book holds no failed payment");
  const served = await io.get(orderPath(unpaid.reference));
  assert.equal(served.status, 200);
  assert.match(served.body, /data-testid="refund-blocked"/);
  assert.match(served.body, /data-testid="refund-amount"[^>]* disabled>/);
  assert.match(served.body, /data-testid="mark-dispatched" disabled>/);
  assert.match(served.body, /data-testid="issue-refund" disabled>/);
  assert.equal(await io.post("refund-order", { reference: unpaid.reference, amountPence: 500, reason: "Goodwill" }), "no_change");

  // A paid order's form is open, with only its submit held until it is filled.
  const paid = (await io.get(orderPath(REFUND_ORDER.reference))).body;
  assert.doesNotMatch(paid, /data-testid="refund-blocked"/);
  assert.doesNotMatch(paid, /data-testid="refund-amount"[^>]* disabled>/);
  assert.match(paid, /data-testid="issue-refund" disabled>/);
  const state = await io.state();
  assert.deepEqual([state.refunds, state.dispatched], [{}, []]);
}));

test("the toolbar's filters narrow the book: a half-typed date is no bound, and a range past trading leaves none", () => {
  const unfulfilled = { ...defaultOrderFilters(), fulfilment: "unfulfilled" };
  assert.equal(filterOrders(customerOrders, unfulfilled).length, BASE.awaitingDispatchCount);
  assert.equal(filterOrders(customerOrders, { ...unfulfilled, placedFrom: "2026-03" }).length, BASE.awaitingDispatchCount);
  assert.equal(filterOrders(customerOrders, { ...unfulfilled, placedFrom: "2026-04-01" }).length, 0);
  assert.equal(filterOrders(customerOrders, defaultOrderFilters()).length, BASE.orderCount);
});
