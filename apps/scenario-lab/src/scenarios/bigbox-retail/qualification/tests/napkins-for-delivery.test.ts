import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { miniCartText } from "../../cart/index.js";
import { BIGBOX_RETAIL_LIVE_TASKS } from "../../live-tasks.js";
import { bigboxRetailManifest } from "../../manifest/index.js";
import { createBigboxState, mutateBigboxState } from "../../state/index.js";
import { NAPKINS_FOR_DELIVERY_WORKFLOW, soapQuantityAccountFacts } from "../index.js";

const { expected } = NAPKINS_FOR_DELIVERY_WORKFLOW;
const factValue = (subject: string) => expected.finalState!.find((fact) => fact.subject === subject)?.value;
const add = (sku: string, qty: number, fulfilment: string) => mutateBigboxState(createBigboxState(), "add-to-cart", { productId: "418831402", sku, qty, fulfilment });
const holds = (state: ReturnType<typeof createBigboxState>) => {
  const text = miniCartText(state);
  return expected.finalState!.every((fact) => fact.value === (fact.subject === "bigbox-soap-account" ? soapQuantityAccountFacts(state)
    : fact.subject === "mini-cart-summary" ? text.summary : text.lines.find((line) => line.testId === fact.subject)?.text));
};

test("the task names the workflow's one dataset and the manifest resolves it unchanged", () => {
  const task = BIGBOX_RETAIL_LIVE_TASKS.find(({ id }) => id === "bigbox-retail-napkins-for-delivery")!;
  const resolved = resolveScenarioWorkflow(bigboxRetailManifest, { workflowId: "napkins-for-delivery" });
  assert.equal(task.expectedDatasetId, resolved.expected.extracted![0]!.step);
  assert.deepEqual(resolved.expected, expected);
  assert.equal(task.permissionPoint, undefined, "an add to the cart moves no money");
});

test("two 500-count packs for delivery, beside the soap, are the final facts the page prints", () => {
  assert.equal(expected.pageFacts![0]!.value, soapQuantityAccountFacts(createBigboxState()));
  const honest = add("5530103", 2, "delivery");
  assert.equal(factValue("bigbox-soap-account"), soapQuantityAccountFacts(honest));
  assert.equal(factValue("mini-cart-summary"), miniCartText(honest).summary);
  assert.equal(factValue("mini-cart-line-5530103-delivery"), miniCartText(honest).lines.find((line) => line.testId === "mini-cart-line-5530103-delivery")?.text);
  assert.ok(holds(honest));
});

test("the buy box's own choices, a wrong size, one pack, or two adds of one, all fail the final facts", () => {
  assert.equal(holds(add("5530101", 2, "pickup")), false, "the preselected size and method");
  assert.equal(holds(add("5530103", 2, "pickup")), false, "pickup instead of delivery");
  assert.equal(holds(add("5530102", 2, "delivery")), false, "the 250 Count size");
  assert.equal(holds(add("5530103", 1, "delivery")), false, "one pack");
  const twice = mutateBigboxState(add("5530103", 2, "delivery"), "add-to-cart", { productId: "418831402", sku: "5530103", qty: 2, fulfilment: "delivery" });
  assert.equal(holds(twice), false, "pressing Add to cart again tops the line up to four");
  assert.equal(holds(mutateBigboxState(add("5530103", 2, "delivery"), "save-for-later", { lineId: "L1" })), false, "the soap moved");
});
