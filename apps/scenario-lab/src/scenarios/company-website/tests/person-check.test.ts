import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { HUMAN_CHECK_DELAY_MS, quoteScript } from "../client/index.js";
import { companyWebsiteManifest } from "../manifest.js";
import { quoteDrawerIds } from "../pages/index.js";
import { PERSON_CHECKS } from "../person-check.js";
import { siteClasses } from "../styles.js";

test("the Lab recognises the quote form's human check and presses the box a person presses", () => {
  const [check] = PERSON_CHECKS.checks;
  const script = quoteScript(quoteDrawerIds(4519), siteClasses(4519), "/scenarios/company-website/quote/received");
  assert.ok(script.includes(check!.shows), "the box the form draws after sending shows the text the Lab looks for");
  assert.deepEqual(check!.steps, [{ action: "click", text: "Confirm you are human" }]);
  assert.ok(check!.clearsWithinMs > HUMAN_CHECK_DELAY_MS, "the wait covers the check's own delay before the box appears, and the navigation after it");
});

test("the quote rows expect a hand-off at the check, and do not require one", () => {
  assert.deepEqual(PERSON_CHECKS.handOffs.map(({ workflowId, variantId, person, required }) => `${workflowId ?? "primary"}/${variantId ?? "-"}:${person}:${required}`), ["primary/-:completes:false", "primary/redesigned-quote-submit:completes:false"]);
  for (const row of PERSON_CHECKS.handOffs) {
    const expected = resolveScenarioWorkflow(companyWebsiteManifest, row.variantId === undefined ? {} : { variantId: row.variantId }).expected;
    assert.equal(expected.failure, undefined, "a completed hand-off is judged by the quote the run leaves behind");
  }
});
