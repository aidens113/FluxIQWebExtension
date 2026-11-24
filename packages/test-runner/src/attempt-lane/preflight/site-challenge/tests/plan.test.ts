import assert from "node:assert/strict";
import test from "node:test";
import type { ScenarioPersonChecks, WebScenario } from "@fluxiq-web-extension/test-contracts";
import { planSiteChallenge } from "../index.js";

const step = { action: "click" as const, text: "Verify" };
const check = { id: "c", description: "d", shows: "Verify", steps: [step], clears: "in-place" as const, clearsWithinMs: 1000 };
const variant = { id: "timed", description: "d", arm: { operation: "set-mode" }, expected: {} };
const scenario = (id: string) => ({ id, workflows: [{ id: "w", variants: [variant] }] }) as unknown as WebScenario;
const module = (handOffs: ScenarioPersonChecks["handOffs"]): ScenarioPersonChecks => ({ scenarioId: "x", checks: [check], handOffs });

test("the required hand-off row names the variant that arms the check", () => {
  const plan = planSiteChallenge(module([{ workflowId: "w", variantId: "timed", person: "completes", required: true, because: "b" }]), scenario("x"));
  assert.equal(plan.how, "variant");
  assert.equal(plan.how === "variant" ? plan.variant.id : null, "timed");
});

test("a row that is not required arms nothing", () => {
  assert.deepEqual(planSiteChallenge(module([{ workflowId: "w", variantId: "timed", person: "completes", required: false, because: "b" }]), scenario("x")), { how: "none" });
});

test("sites that raise their check from the page are driven by the Lab", () => {
  assert.deepEqual(planSiteChallenge(module([]), scenario("bigbox-retail")), { how: "lab_raise", scenarioId: "bigbox-retail" });
  assert.deepEqual(planSiteChallenge(module([]), scenario("company-website")), { how: "lab_raise", scenarioId: "company-website" });
});
