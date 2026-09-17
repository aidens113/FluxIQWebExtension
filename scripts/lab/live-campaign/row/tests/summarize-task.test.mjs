import assert from "node:assert/strict";
import test from "node:test";
import { renderSummaryMarkdown, totalsOf } from "../../summary/index.mjs";
import { attempt, resultLine } from "../../tests/attempts.mjs";
import { CATALOG } from "../../tests/tasks.mjs";
import { summarizeTask } from "../index.mjs";

test("a row reports provider-reported spend only, codes only, and the judgement its task asks for", () => {
  const bundle = {
    evaluation: {
      flowCreated: true, oracleVerdict: "failed", failureCategory: undefined,
      automationFailureReported: { category: "output_not_observed", code: "web.extract.empty" },
      actions: [{ actionType: "web.browser.navigate" }, { actionType: "web.dom.extract_list" }, { actionType: "web.browser.navigate" }],
      llm: { mode: "live", calls: 9 },
      extraction: [{ status: "judged", expectedRecords: 12, observedRecords: 12, matchedRecords: 12, recordsListed: true }],
      harnessRecovery: { interventions: [{ validationCodes: ["diagnosis.schema_invalid"] }], runtimePatchAttempts: [{ issueCodes: ["runtime_patch.target_override_rejected"] }] },
    },
    run: null,
    liveLlm: { observed: { calls: 3, totalEstimatedCostUsd: 9.99, accounting: { totalTokens: 999999, estimatedCostUsd: 9.99 }, observedCalls: [
      { totalTokens: 1000, estimatedCostUsd: 0.001, validationCodes: [] },
      { totalTokens: null, inputTokens: 200, outputTokens: 50, estimatedCostUsd: 0.0002, validationCodes: ["llm.provider_configuration_invalid"] },
      { totalTokens: null, inputTokens: null, outputTokens: null, estimatedCostUsd: null, validationCodes: ["Free text with page data", "llm.provider_configuration_invalid"] },
    ] } },
    flowLane: { proposalIssues: ["mapper.unmapped_input", "a sentence that is not a code"], failure: { code: "web.extract.empty" } },
  };
  const row = summarizeTask(CATALOG[1], [{ attempt: 1, exitCode: 1, ramFault: null }], attempt({ code: 1, stdout: resultLine({ verdict: "failed" }) }), bundle);
  assert.equal(row.verdict, "failed");
  assert.equal(row.flowCreated, true);
  assert.deepEqual(row.actionTypes, ["web.browser.navigate", "web.dom.extract_list"]);
  assert.equal(row.providerCalls, 3);
  assert.equal(row.reportedTokens, 1250, "reported per-call totals, never Core's accounting");
  assert.equal(row.reportedCostUsd, 0.0012, "reported per-call cost, never the charged total");
  assert.equal(row.callsWithoutReportedTokens, 1);
  assert.equal(row.judgement.passed, true, "a dataset task is judged by its dataset, not by the oracle");
  assert.equal(row.judgement.oracleVerdict, "failed");
  assert.equal(row.automationFailure, "output_not_observed/web.extract.empty");
  assert.deepEqual(row.issueCodes, ["diagnosis.schema_invalid", "llm.provider_configuration_invalid", "mapper.unmapped_input", "runtime_patch.target_override_rejected", "web.extract.empty"]);

  const goal = summarizeTask(CATALOG[0], [], attempt({ stdout: resultLine({}) }), bundle);
  assert.equal(goal.judgement.passed, false, "a goal task is judged by the oracle");
  assert.equal(goal.judgement.dataset, null);

  const noSteps = summarizeTask(CATALOG[1], [], attempt({ stdout: resultLine({}) }), { ...bundle, evaluation: { ...bundle.evaluation, extraction: [] } });
  assert.equal(noSteps.judgement.passed, false, "a created Flow with no extract step fails a dataset task");
  const miscounted = summarizeTask(CATALOG[1], [], attempt({ stdout: resultLine({}) }), { ...bundle, evaluation: { ...bundle.evaluation, extraction: [{ status: "judged", expectedRecords: 12, observedRecords: 12, matchedRecords: 11, recordsListed: true }] } });
  assert.equal(miscounted.judgement.passed, false);
  const unmeasured = summarizeTask(CATALOG[1], [], attempt({ code: 1 }), { evaluation: null, run: null, liveLlm: null, flowLane: null });
  assert.deepEqual([unmeasured.verdict, unmeasured.judgement.passed, unmeasured.reportedTokens, unmeasured.reportedCostUsd, unmeasured.runId], ["no-result", null, null, null, null]);
});

// run-mu4y52hs-943d1c8d: a finished bundle whose run failed on the facility
// (a control request timed out) read only "environment.missing" in the summary.
test("a run that failed on the facility says where, and a refusal keeps its variable names but not its tokens", () => {
  const facilityFailure = { boundary: "finalized-bundle", stage: "scenario.execute", reason: "http.timeout", operationStage: "control.request", timeoutMs: 30000 };
  const bundle = { evaluation: { verdict: "failed", failureCategory: "environment.missing", facilityFailure, flowCreated: false, actions: [], extraction: null, llm: { mode: "live", calls: 0 } }, run: null, liveLlm: null, flowLane: null };
  const timedOut = summarizeTask(CATALOG[0], [], attempt({ code: 1, stdout: resultLine({ verdict: "failed", failureCategory: "environment.missing" }) }), bundle);
  assert.equal(timedOut.failureCategory, "environment.missing");
  assert.equal(timedOut.runnerMessage, "http.timeout at control.request after 30000 ms (finalized-bundle, scenario.execute)");
  const transport = summarizeTask(CATALOG[0], [], attempt({ code: 1, stdout: resultLine({ verdict: "failed" }) }), { ...bundle, evaluation: { ...bundle.evaluation, facilityFailure: { boundary: "finalized-bundle", stage: "scenario.execute", reason: "http.transport", operationStage: "control.request", causeCode: "ECONNRESET", note: "free text is never read" } } });
  assert.equal(transport.runnerMessage, "http.transport at control.request, ECONNRESET (finalized-bundle, scenario.execute)");
  const passed = summarizeTask(CATALOG[0], [], attempt({ stdout: resultLine({}) }), { ...bundle, evaluation: { ...bundle.evaluation, facilityFailure: null } });
  assert.equal(passed.runnerMessage, null);

  const refusal = (message) => summarizeTask(CATALOG[0], [], attempt({ code: 1, stderr: JSON.stringify({ status: "failed", category: "environment.missing", message }) }), { evaluation: null, run: null, liveLlm: null, flowLane: null }).runnerMessage;
  assert.equal(refusal("so FLUXIQ_TEST_SECRET_STOREFRONT_CHECKOUT_BILLING_CARD must be set"), "so FLUXIQ_TEST_SECRET_STOREFRONT_CHECKOUT_BILLING_CARD must be set");
  assert.equal(refusal("key 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08 refused"), "key [redacted] refused");
  assert.equal(refusal(`${"word ".repeat(100)}end`).length, 320);
});

// run-mu5vfd6o-d98abd77: `member-directory` / `member-left` declares
// `target_not_found` / `web.target.not_found`, reported exactly that after the
// wrong-row fix, and still read `failed` in the row, the totals and the table.
test("a run that reports the failure its scenario declared reads as a pass, with the runner's verdict no longer deciding", () => {
  const declared = { category: "target_not_found", code: "web.target.not_found" };
  const bundle = (evaluation) => ({ evaluation, run: null, liveLlm: null, flowLane: null });
  const refusal = {
    verdict: "passed", facilityFailure: null, flowCreated: true, oracleVerdict: "passed",
    automationFailureReported: declared, automationFailureExpected: declared,
    actions: [{ actionType: "web.dom.click" }], extraction: null, llm: { mode: "live", calls: 4 },
  };
  // What the Lab printed is still the runner's own verdict and category.
  const printed = attempt({ code: 1, stdout: resultLine({ verdict: "failed", failureCategory: "action.dispatch" }) });

  const row = summarizeTask(CATALOG[0], [{ attempt: 1, exitCode: 1, ramFault: null }], printed, bundle(refusal));
  assert.equal(row.verdict, "passed", "the evaluation's verdict, not the Lab's printed one");
  assert.equal(row.succeeded, true);
  assert.equal(row.failureCategory, null, "a passed run carries no category, whatever the runner said");
  assert.equal(row.runnerMessage, null);
  assert.deepEqual([row.declaredFailure, row.automationFailure], ["target_not_found/web.target.not_found", "target_not_found/web.target.not_found"]);
  assert.match(renderSummaryMarkdown(summaryOf([row])), /as declared: target_not_found\/web\.target\.not_found/u);

  // A run that refused differently, which the evaluation fails: the row reads it as the failure it is.
  const wrong = { ...refusal, verdict: "failed", failureCategory: "action.dispatch", automationFailureReported: { category: "timeout", code: "web.action.timeout" } };
  const missed = summarizeTask(CATALOG[0], [], printed, bundle(wrong));
  assert.deepEqual([missed.verdict, missed.succeeded, missed.failureCategory], ["failed", false, "action.dispatch"]);
  assert.equal(missed.automationFailure, "timeout/web.action.timeout");
  assert.doesNotMatch(renderSummaryMarkdown(summaryOf([missed])), /as declared/u);

  // An ordinary run, and one with no evaluation at all, still read the Lab's printed verdict.
  const ordinary = summarizeTask(CATALOG[0], [], attempt({ stdout: resultLine({}) }), bundle({ ...refusal, automationFailureExpected: null, automationFailureReported: null, oracleVerdict: "passed", verdict: "passed" }));
  assert.deepEqual([ordinary.verdict, ordinary.declaredFailure], ["passed", null]);
  const unevaluated = summarizeTask(CATALOG[0], [], printed, bundle(null));
  assert.deepEqual([unevaluated.verdict, unevaluated.failureCategory], ["failed", "action.dispatch"]);
});

/** The campaign summary a set of rows renders as, with only the members the Markdown reads. */
function summaryOf(tasks) {
  return {
    campaignId: "campaign-test", startedAt: "2026-09-17T18:00:00.000Z", finishedAt: "2026-09-17T19:00:00.000Z",
    options: { profiles: { create: "create", repair: "repair" }, provider: "deepseek", model: "deepseek-chat", maxAttempts: 2 },
    totals: totalsOf(tasks), tasks,
  };
}
