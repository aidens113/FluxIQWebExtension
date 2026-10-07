import assert from "node:assert/strict";
import test from "node:test";
import { assertRealisticScenarios, isRealisticScenario, REALISTIC_SCENARIO_IDS, unrealisticScenarioRefusal } from "../index.js";

const TEN = ["everything-store", "crossborder-marketplace", "bigbox-retail", "job-board", "local-classifieds", "auction-marketplace", "photo-social", "social-network-feed", "company-website", "professional-network"];

test("the list is exactly the ten realistic scenarios the user named, in that order", () => {
  assert.deepEqual([...REALISTIC_SCENARIO_IDS], TEN);
  assert.equal(Object.isFrozen(REALISTIC_SCENARIO_IDS), true);
});

test("each of the ten is admitted; the basic fixture scenarios are not", () => {
  for (const scenario of TEN) assert.equal(isRealisticScenario(scenario), true, scenario);
  for (const scenario of ["basic-form", "product-catalog", "instruction-only-form", "", "Everything-Store"]) assert.equal(isRealisticScenario(scenario), false, scenario);
  assert.equal(unrealisticScenarioRefusal(TEN, "lab run"), null);
  assert.doesNotThrow(() => assertRealisticScenarios(TEN, "lab run"));
});

test("the refusal names the entry, each refused scenario once, the rule and the ten", () => {
  const refusal = unrealisticScenarioRefusal(["job-board", "basic-form", "product-catalog", "basic-form"], "lab matrix");
  assert.equal(refusal, "lab matrix refused basic-form, product-catalog: every Lab or browser test run, live or provider-free, uses only the ten realistic scenarios (user rule, 2026-09-29): everything-store, crossborder-marketplace, bigbox-retail, job-board, local-classifieds, auction-marketplace, photo-social, social-network-feed, company-website, professional-network.");
  assert.throws(() => assertRealisticScenarios(["basic-form"], "lab run"), { message: /^lab run refused basic-form: every Lab or browser test run/u });
});
