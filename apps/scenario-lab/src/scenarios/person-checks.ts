import type { ScenarioPersonChecks } from "@fluxiq-web-extension/test-contracts";
import { BIGBOX_RETAIL_PERSON_CHECKS } from "./bigbox-retail/index.js";
import { COMPANY_WEBSITE_PERSON_CHECKS } from "./company-website/index.js";
import { CROSSBORDER_MARKETPLACE_PERSON_CHECKS } from "./crossborder-marketplace/index.js";
import { EVERYTHING_STORE_PERSON_CHECKS } from "./everything-store/index.js";

/**
 * Every fixture's person-only checks, gathered for the corpus tests. The Lab's
 * runner does not read this list: it loads `scenarios/<scenarioId>/person-check.js`
 * for the one scenario it runs, as it loads a scenario's `repair.js`
 * (`packages/test-runner/src/person-simulation/check-module.ts`).
 */
export const SCENARIO_PERSON_CHECKS: readonly ScenarioPersonChecks[] = Object.freeze([
  EVERYTHING_STORE_PERSON_CHECKS,
  CROSSBORDER_MARKETPLACE_PERSON_CHECKS,
  BIGBOX_RETAIL_PERSON_CHECKS,
  COMPANY_WEBSITE_PERSON_CHECKS,
]);
