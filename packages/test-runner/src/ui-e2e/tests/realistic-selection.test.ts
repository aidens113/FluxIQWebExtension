// `pnpm ui:e2e` opens a browser on Scenario Lab pages, so its entry point
// refuses any selection whose journeys open a scenario outside the ten
// realistic ones, before it prepares a workspace or starts anything.

import assert from "node:assert/strict";
import test from "node:test";
import { UI_E2E_JOURNEY_IDS } from "../journey-selection.js";
import { UI_E2E_JOURNEY_SCENARIOS, uiE2eScenarioRefusal } from "../realistic-selection.js";

const RULE = /every Lab or browser test run, live or provider-free, uses only the ten realistic scenarios \(user rule, 2026-09-29\): everything-store, crossborder-marketplace, bigbox-retail, job-board, local-classifieds, auction-marketplace, photo-social, social-network-feed, company-website, professional-network\./u;

test("every journey declares the scenarios it opens", () => {
  assert.deepEqual(Object.keys(UI_E2E_JOURNEY_SCENARIOS).sort(), [...UI_E2E_JOURNEY_IDS].sort());
});

test("the provider-free journeys open basic fixture scenarios, so the default run and each of them is refused", () => {
  const all = uiE2eScenarioRefusal({ lane: "provider-free", journeys: [] });
  assert.ok(all);
  assert.match(all, /^pnpm ui:e2e refused llm-target-drift, product-catalog: /u);
  assert.match(all, RULE);
  for (const journey of ["F1", "F2", "F3", "F4"] as const) assert.match(uiE2eScenarioRefusal({ lane: "provider-free", journeys: [journey] }) ?? "", RULE, journey);
});

test("a selection that opens no scenario is not refused: the provider lane's journeys are not wired", () => {
  assert.equal(uiE2eScenarioRefusal({ lane: "provider", journeys: [] }), null);
  assert.equal(uiE2eScenarioRefusal({ lane: "provider-free", journeys: ["P1"] }), null, "a journey outside the lane does not run");
});
