import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import type { ScenarioStep, ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { apprenticesWorkflow, heatPumpQuoteWorkflow, newsletterSignupWorkflow, saturdayCertificateWorkflow } from "../qualification/index.js";
import { closeBrowser, failedFacts, runScript, serverState, unexpectedConsoleErrors, withSite } from "./site-driver.js";

/**
 * The breadth rows (t704) in a person's browser. Each workflow's own
 * recording reaches every oracle it declares, and a plausible wrong path --
 * the unfiltered or unfinished list, the wrong row or branch, an extra act --
 * fails at least one of them.
 */
after(closeBrowser);

const TIMEOUT = { timeout: 120_000 };
const dataset = (workflow: ScenarioWorkflow) => workflow.expected.extracted![0]!;
const replace = (script: readonly ScenarioStep[], id: string, change: Partial<ScenarioStep>) => {
  assert.ok(script.some((step) => step.id === id), `no step ${id}`);
  return script.map((step) => step.id === id ? { ...step, ...change } : step);
};
const without = (script: readonly ScenarioStep[], ...ids: string[]) => script.filter(({ id }) => !ids.includes(id));
const insertBefore = (script: readonly ScenarioStep[], id: string, extra: ScenarioStep[]) => {
  const at = script.findIndex((step) => step.id === id);
  assert.ok(at >= 0, `no step ${id}`);
  return [...script.slice(0, at), ...extra, ...script.slice(at)];
};

describe("breadth rows: the honest recording passes every oracle", { concurrency: 4 }, () => {
  for (const workflow of [apprenticesWorkflow, newsletterSignupWorkflow, saturdayCertificateWorkflow, heatPumpQuoteWorkflow]) {
    test(`${workflow.id}: the recording reaches the declared records and final state`, TIMEOUT, () => withSite(async ({ page, consoleErrors }) => {
      assert.deepEqual(await failedFacts(page, workflow.expected.pageFacts ?? []), []);
      const rows = await runScript(page, workflow.recordingScript);
      assert.deepEqual(rows[dataset(workflow).step], dataset(workflow).records);
      assert.deepEqual(await failedFacts(page, workflow.expected.finalState ?? []), []);
      assert.deepEqual(unexpectedConsoleErrors(consoleErrors), []);
    }));
  }
});

describe("breadth rows: a plausible wrong path fails the oracle", { concurrency: 4 }, () => {
  test("apprentices: stopping at the batches that load on their own misses the last apprentice", TIMEOUT, () => withSite(async ({ page }) => {
    const script = without(apprenticesWorkflow.recordingScript, "apprentices-show-more", "apprentices-show-more-again", "apprentices-last-batch");
    const rows = await runScript(page, script);
    assert.equal(rows["extract-apprentices"]?.length, 3);
    assert.notDeepEqual(rows["extract-apprentices"], dataset(apprenticesWorkflow).records);
  }));

  test("apprentices: the other James Whitlock is the wrong row", TIMEOUT, () => withSite(async ({ page }) => {
    const step = apprenticesWorkflow.recordingScript.find(({ id }) => id === "extract-apprentices")!;
    const script = replace(apprenticesWorkflow.recordingScript, "extract-apprentices", { target: step.target!.replace("nth-of-type(12)", "nth-of-type(16)") });
    const rows = await runScript(page, script);
    assert.deepEqual(rows["extract-apprentices"]?.[1], { name: "James Whitlock", role: "Heating Engineer", branch: "Eastmoor" });
    assert.notDeepEqual(rows["extract-apprentices"], dataset(apprenticesWorkflow).records);
  }));

  test("newsletter-signup: signing a second address up as well fails the read and the account", TIMEOUT, () => withSite(async ({ lab, page }) => {
    const script = insertBefore(newsletterSignupWorkflow.recordingScript, "extract-newsletter-subscription", [
      { id: "newsletter-enter-second", operation: "type", target: 'main input[name="email"]', value: "ada@example.test" },
      { id: "newsletter-sign-up-second", operation: "click", target: 'button:text-is("Sign me up")' },
      { id: "newsletter-second-listed", operation: "waitForState", target: 'td:text-is("ada@example.test")', timeoutMs: 8000 },
    ]);
    const rows = await runScript(page, script);
    assert.equal(rows["extract-newsletter-subscription"]?.length, 2);
    assert.notDeepEqual(rows["extract-newsletter-subscription"], dataset(newsletterSignupWorkflow).records);
    assert.notDeepEqual(await failedFacts(page, newsletterSignupWorkflow.expected.finalState ?? []), []);
    assert.equal((await serverState(lab)).newsletter.subscribers.length, 2);
  }));

  test("newsletter-signup: signing up the same address twice is one subscription, and Unsubscribe undoes it", TIMEOUT, () => withSite(async ({ lab, page }) => {
    const script = insertBefore(newsletterSignupWorkflow.recordingScript, "extract-newsletter-subscription", [
      { id: "newsletter-enter-again", operation: "type", target: 'main input[name="email"]', value: "ada.synthetic@example.test" },
      { id: "newsletter-sign-up-again", operation: "click", target: 'button:text-is("Sign me up")' },
      { id: "newsletter-still-listed", operation: "waitForState", target: 'section[aria-label="Your subscriptions"]', timeoutMs: 8000 },
    ]);
    const rows = await runScript(page, script);
    assert.deepEqual(rows["extract-newsletter-subscription"], dataset(newsletterSignupWorkflow).records);
    await runScript(page, [{ id: "unsubscribe", operation: "click", target: 'button:text-is("Unsubscribe")' }, { id: "form-back", operation: "waitForState", target: 'h2:text-is("Sign up")', timeoutMs: 8000 }]);
    assert.deepEqual((await serverState(lab)).newsletter.subscribers, []);
    assert.deepEqual(await failedFacts(page, newsletterSignupWorkflow.expected.pageFacts ?? []), [], "the account is a first visit's again");
  }));

  test("saturday-certificate: Wrenfield, which opens on Saturdays, is the wrong branch", TIMEOUT, () => withSite(async ({ page }) => {
    const script = without(replace(saturdayCertificateWorkflow.recordingScript, "saturday-branch", { target: 'frame:Slotwise booking/div:has(> strong:text-is("Wrenfield"))' }), "saturday-first-week", "saturday-second-week", "saturday-third-week");
    const rows = await runScript(page, script);
    assert.ok((rows["extract-saturday-certificate-slots"]?.length ?? 0) > 0);
    assert.notDeepEqual(rows["extract-saturday-certificate-slots"], dataset(saturdayCertificateWorkflow).records);
  }));

  test("heat-pump-quote: naming head office instead of the heat pump centre fails the final state", TIMEOUT, () => withSite(async ({ page }) => {
    const script = replace(heatPumpQuoteWorkflow.recordingScript, "heat-pump-details", { value: "Please could the survey be done by your Wrenfield head office." });
    const rows = await runScript(page, script);
    assert.deepEqual(rows["extract-heat-pump-quote"], dataset(heatPumpQuoteWorkflow).records, "the reference covers no free text");
    assert.deepEqual(await failedFacts(page, heatPumpQuoteWorkflow.expected.finalState ?? []), ['heat-pump-quote-names-sallowmere: expected "Sallowmere", saw ' + JSON.stringify(await page.locator('[data-testid="quote-details"]').textContent())]);
  }));

  test("heat-pump-quote: leaving the pre-ticked marketing box and the Phone default fails the read", TIMEOUT, () => withSite(async ({ page }) => {
    const script = without(heatPumpQuoteWorkflow.recordingScript, "heat-pump-refuse-marketing", "heat-pump-contact-by-text");
    const rows = await runScript(page, script);
    assert.deepEqual({ contactBy: rows["extract-heat-pump-quote"]?.[0]?.contactBy, offers: rows["extract-heat-pump-quote"]?.[0]?.offers }, { contactBy: "Phone", offers: "Yes" });
    assert.notDeepEqual(rows["extract-heat-pump-quote"], dataset(heatPumpQuoteWorkflow).records);
  }));
});
