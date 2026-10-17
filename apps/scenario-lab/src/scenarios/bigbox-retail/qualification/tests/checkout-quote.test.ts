import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { cartTotals, miniCartText, pickupSlots, slotRangeText } from "../../cart/index.js";
import { formatMoney } from "../../catalog/index.js";
import { BIGBOX_RETAIL_LIVE_TASKS } from "../../live-tasks.js";
import { bigboxRetailManifest } from "../../manifest/index.js";
import { createBigboxState, mutateBigboxState } from "../../state/index.js";
import { CHECKOUT_QUOTE_WORKFLOW, soapQuantityAccountFacts } from "../index.js";

const { expected } = CHECKOUT_QUOTE_WORKFLOW;
const CONTACT = { firstName: "Dana", lastName: "Whitfield", email: "dana.whitfield@example.com", phone: "555-014-2290", company_website: "", payment: "pickup", slotId: "2291-0921-14" };

test("the task names the workflow's one dataset, asks nothing, and the manifest resolves it unchanged", () => {
  const task = BIGBOX_RETAIL_LIVE_TASKS.find(({ id }) => id === "bigbox-retail-checkout-quote-without-ordering")!;
  const resolved = resolveScenarioWorkflow(bigboxRetailManifest, { workflowId: "checkout-quote" });
  assert.equal(task.expectedDatasetId, resolved.expected.extracted![0]!.step);
  assert.deepEqual(resolved.expected, expected);
  assert.equal(task.permissionPoint, undefined, "the task stops before Place order, so it never reaches the act a permission point names");
  assert.ok(!CHECKOUT_QUOTE_WORKFLOW.recordingScript.some((step) => step.target?.includes("Place order")), "the recording never presses Place order");
});

test("the record is the home store's earliest open slot today and the cart's total with tax", () => {
  const state = mutateBigboxState(createBigboxState(), "start-guest-checkout", {});
  const earliest = pickupSlots(state.storeId).find((slot) => slot.day === "today" && !slot.full)!;
  const first = pickupSlots(state.storeId)[0]!;
  assert.deepEqual(expected.extracted![0]!.records, [{ pickup: slotRangeText(earliest), total: formatMoney(cartTotals(state.cart, state.storeId).totalCents) }]);
  assert.notEqual(slotRangeText(first), slotRangeText(earliest), "the first slot button is a full one");
});

test("a guest checkout left unplaced holds the final facts; placing the order, or changing the cart, does not", () => {
  const guest = mutateBigboxState(createBigboxState(), "start-guest-checkout", {});
  const holds = (state: typeof guest) => expected.finalState!.every((fact) => fact.value === (fact.subject === "bigbox-soap-account" ? soapQuantityAccountFacts(state) : miniCartText(state).summary));
  assert.equal(expected.pageFacts![0]!.value, soapQuantityAccountFacts(createBigboxState()));
  assert.ok(holds(guest));
  const placed = mutateBigboxState(guest, "place-order", CONTACT);
  assert.equal(placed.orders.length, 1);
  assert.equal(holds(placed), false, "an order was placed");
  assert.equal(holds(mutateBigboxState(guest, "save-for-later", { lineId: "L1" })), false, "the cart changed");
  assert.equal(holds(createBigboxState()), false, "never reaching the guest checkout reads no pickup times");
});
