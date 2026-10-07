// The demo lanes' and `pnpm ui:e2e`'s browser session refuses any scenario
// outside the ten realistic ones before it starts the scenario lab or a browser.

import assert from "node:assert/strict";
import test from "node:test";
import { withDemoBrowser } from "../browser-session.js";
import type { DemoWorkspaceConfiguration } from "../configuration.js";
import { demoScenarioIdOfPath } from "../scenario-lab.js";

const RULE = /every Lab or browser test run, live or provider-free, uses only the ten realistic scenarios \(user rule, 2026-09-29\): everything-store, crossborder-marketplace, bigbox-retail, job-board, local-classifieds, auction-marketplace, photo-social, social-network-feed, company-website, professional-network\./u;

test("the scenario a demo path opens is the segment after /scenarios/", () => {
  assert.equal(demoScenarioIdOfPath("/scenarios/basic-form/"), "basic-form");
  assert.equal(demoScenarioIdOfPath("/scenarios/job-board/jobs/123?x=1"), "job-board");
  assert.equal(demoScenarioIdOfPath("/elsewhere/"), "/elsewhere/");
});

test("withDemoBrowser refuses basic-form, its default, and product-catalog before it starts anything", async () => {
  // A configuration with nothing in it: any step past the guard would fail on it differently.
  const config = {} as DemoWorkspaceConfiguration;
  let operated = false;
  const operation = async () => { operated = true; };
  await assert.rejects(withDemoBrowser(config, "cookie", "guard-test", operation), { message: RULE });
  await assert.rejects(withDemoBrowser(config, "cookie", "guard-test", operation, [], "/scenarios/basic-form/"), { message: /^A demo or UI end-to-end browser session refused basic-form: / });
  await assert.rejects(withDemoBrowser(config, "cookie", "guard-test", operation, [], "/scenarios/product-catalog/"), { message: /refused product-catalog: / });
  assert.equal(operated, false);
});

