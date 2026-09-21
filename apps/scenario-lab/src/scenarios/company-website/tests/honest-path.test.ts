import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { resolveScenarioWorkflow, type ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { BOOKING_RECORD, GAS_ENGINEER_RECORDS, PRICE_LIST_RECORDS } from "../expectations.js";
import { companyWebsiteManifest as manifest } from "../manifest.js";
import { closeBrowser, failedFacts, runScript, serverState, unexpectedConsoleErrors, withSite } from "./site-driver.js";

/**
 * An honest person, driven by each workflow's own recording script, meets
 * every oracle the manifest declares: the page facts of the rendering first
 * presented, the extracted records, the final-state facts and the playback
 * goal -- and the server holds exactly what they did, with nothing extra
 * subscribed, drafted, dropped or paid.
 *
 * The armed rows are run the way a person meets them: the recorded script,
 * with the one step the new situation needs.
 */
after(closeBrowser);

const workflow = (workflowId?: string, variantId?: string) => resolveScenarioWorkflow(manifest, { ...(workflowId ? { workflowId } : {}), ...(variantId ? { variantId } : {}) });
const goal = manifest.playbackGoal!.successFacts;

/** The script with `extra` steps inserted after the step `afterId`. */
function withStepsAfter(script: readonly ScenarioStep[], afterId: string, extra: ScenarioStep[]): ScenarioStep[] {
  const at = script.findIndex(({ id }) => id === afterId);
  assert.ok(at >= 0, `no step ${afterId}`);
  return [...script.slice(0, at + 1), ...extra, ...script.slice(at + 1)];
}

describe("the honest path passes every oracle", { concurrency: 4 }, () => {
  test("primary: the quote request reaches the office exactly as asked", async () => withSite(async ({ lab, page, consoleErrors }) => {
    const { recordingScript, expected } = workflow();
    assert.deepEqual(await failedFacts(page, expected.pageFacts ?? []), []);
    await runScript(page, recordingScript);
    assert.deepEqual(await failedFacts(page, [...expected.finalState ?? [], ...goal]), []);
    const state = await serverState(lab);
    assert.equal(state.quotes.length, 1);
    assert.deepEqual({ discarded: state.discarded, drafts: state.drafts, subscribers: state.newsletter.subscribers, consent: state.consent }, { discarded: { honeypot: 0, unverified: 0, invalid: 0 }, drafts: 0, subscribers: [], consent: "all" });
    assert.deepEqual(unexpectedConsoleErrors(consoleErrors), []);
  }));

  test("gas-engineers: the whole grid is read and the right eight people kept", async () => withSite(async ({ lab, page, consoleErrors }) => {
    const { recordingScript, expected } = workflow("gas-engineers");
    assert.deepEqual(await failedFacts(page, expected.pageFacts ?? []), []);
    const extracted = await runScript(page, recordingScript);
    assert.deepEqual(extracted["extract-gas-engineers"], GAS_ENGINEER_RECORDS);
    assert.deepEqual(expected.extracted?.[0]?.records, GAS_ENGINEER_RECORDS);
    assert.deepEqual(await failedFacts(page, expected.finalState ?? []), []);
    assert.ok((await serverState(lab)).team.batchRequests >= 4, "every batch was fetched");
    assert.deepEqual(unexpectedConsoleErrors(consoleErrors), []);
  }));

  test("business-prices: ex-VAT prices of two categories without the adverts", async () => withSite(async ({ page, consoleErrors }) => {
    const { recordingScript, expected } = workflow("business-prices");
    const extracted = await runScript(page, recordingScript);
    assert.deepEqual(extracted["extract-business-prices"], PRICE_LIST_RECORDS);
    assert.deepEqual(await failedFacts(page, expected.finalState ?? []), []);
    assert.deepEqual(unexpectedConsoleErrors(consoleErrors), []);
  }));

  test("book-service: the permitted run books Monday 5 October at 10:30 and pays one deposit", async () => withSite(async ({ lab, page, consoleErrors }) => {
    const { recordingScript, expected } = workflow("book-service");
    const extracted = await runScript(page, recordingScript);
    assert.deepEqual(extracted["extract-booking"], [BOOKING_RECORD]);
    assert.deepEqual(await failedFacts(page, expected.finalState ?? []), []);
    const state = await serverState(lab);
    assert.deepEqual({ bookings: state.bookings.length, deposits: state.deposits }, { bookings: 1, deposits: { count: 1, totalPence: 3_000 } });
    assert.deepEqual(unexpectedConsoleErrors(consoleErrors), []);
  }));

  test("winter-notice: a person dismisses the notice and reads the same eight people", async () => withSite(async ({ page, consoleErrors }) => {
    const { recordingScript, expected } = workflow("gas-engineers", "winter-notice");
    assert.deepEqual(await failedFacts(page, expected.pageFacts ?? []), []);
    const script = withStepsAfter(recordingScript, "accept-cookies", [{ id: "continue-past-notice", operation: "click", target: 'button:text-is("Continue to site")' }]);
    const extracted = await runScript(page, script);
    assert.deepEqual(extracted["extract-gas-engineers"], GAS_ENGINEER_RECORDS);
    assert.deepEqual(await failedFacts(page, expected.finalState ?? []), []);
    assert.deepEqual(unexpectedConsoleErrors(consoleErrors), []);
  }, { arm: { operation: "set-mode", payload: { mode: "winter-notice" } } }));

  test("redesigned-quote-submit: the recording stops where Send request was; Get my free quote passes the repaired run's oracle", async () => withSite(async ({ lab, page }) => {
    const { recordingScript, expected } = workflow(undefined, "redesigned-quote-submit");
    assert.deepEqual(await failedFacts(page, expected.pageFacts ?? []), []);
    const repaired = recordingScript.map((step) => step.id === "send-request" ? { ...step, target: 'button:text-is("Get my free quote")' } : step);
    await runScript(page, repaired);
    assert.deepEqual(await failedFacts(page, [...expected.finalState ?? [], ...goal]), []);
    assert.equal((await serverState(lab)).drafts, 0);
  }, { arm: { operation: "set-mode", payload: { mode: "redesigned-quote-submit" } } }));

  test("redesigned-quote-submit: the unrepaired recording cannot find its button", async () => withSite(async ({ lab, page }) => {
    const { recordingScript } = workflow(undefined, "redesigned-quote-submit");
    const upToSend = recordingScript.slice(0, recordingScript.findIndex(({ id }) => id === "send-request") + 1).map((step) => step.id === "send-request" ? { ...step, timeoutMs: 1_500 } : step);
    await assert.rejects(runScript(page, upToSend), /step send-request failed/u);
    assert.equal((await serverState(lab)).quotes.length, 0);
  }, { arm: { operation: "set-mode", payload: { mode: "redesigned-quote-submit" } } }));
});
