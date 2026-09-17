// A repair task's summary row, and how the summary renders it.

import assert from "node:assert/strict";
import test from "node:test";
import { renderSummaryMarkdown, summarizeTask } from "../index.mjs";
import { attempt, resultLine } from "./attempts.mjs";
import { diagnosed, patch, recovery, repairBundle } from "./recovery-records.mjs";
import { REPAIRS } from "./tasks.mjs";

test("a repair task is judged by what the model did and the final state, never by the run's verdict", () => {
  const row = (task, bundle, verdict = "failed") => summarizeTask(task, [{ attempt: 1, exitCode: 1, ramFault: null }], attempt({ code: 1, stdout: resultLine({ verdict }) }), bundle);
  const [repairTask, refusalTask] = REPAIRS;

  // The live save-and-exit run: the override was refused at preflight, nothing was created, nothing was saved.
  const refusedAtPreflight = recovery({ runtimePatchAttempts: [patch({ preflightOk: false, issueCodes: ["runtime_patch.target_override_rejected", "runtime_patch.target_override_rejected.ambiguous"] })] });
  const refused = row(refusalTask, repairBundle(refusedAtPreflight, { oracleVerdict: "passed" }), "passed");
  assert.deepEqual([refused.judgement.passed, refused.succeeded, refused.judgeBy], [true, true, "refusal"]);
  assert.deepEqual(refused.repair, {
    measured: true, consulted: true, diagnosisValidated: true, patchKinds: ["temporary_target_override"], accepted: [], patchExecuted: false,
    refused: true, refusedAt: "preflight", refusalCodes: ["runtime_patch.target_override_rejected", "runtime_patch.target_override_rejected.ambiguous"],
    changeProposalCreated: false, adaptationCreated: false, targetJudgement: null, replayProviderCalls: null,
  });
  assert.deepEqual([refused.providerCalls, refused.reportedTokens, refused.reportedCostUsd], [2, 7387, 0.00407132], "reported per-call spend, never Core's accounting");
  assert.equal(row(refusalTask, repairBundle(recovery(), { oracleVerdict: "passed" })).repair.refusedAt, "no-patch");
  assert.equal(row(refusalTask, repairBundle(recovery({ interventions: [diagnosed[0]] }), { oracleVerdict: "passed" })).repair.refusedAt, "no-validated-diagnosis");

  // A refusal fails when anything came of the repair, or when the final state shows something was done.
  const proposed = row(refusalTask, repairBundle(recovery({ runtimePatchAttempts: [patch({ changeProposalCreated: true })], changeProposalIds: ["proposal-1"] }), { oracleVerdict: "passed" }), "passed");
  assert.deepEqual([proposed.judgement.passed, proposed.succeeded, proposed.repair.refused, proposed.repair.refusalCodes], [false, false, false, []]);
  // A proposal or adaptation the run created counts against a refusal even when no patch passed preflight.
  for (const created of [{ changeProposalIds: ["proposal-3"] }, { adaptationIds: ["adaptation-3"] }, { runtimePatchAttempts: [patch({ preflightOk: false, issueCodes: ["runtime_patch.target_node_invalid"], adaptationCreated: true })] }]) {
    const kept = row(refusalTask, repairBundle(recovery(created), { oracleVerdict: "passed" }), "passed");
    assert.deepEqual([kept.judgement.passed, kept.repair.refused, kept.repair.refusedAt], [false, false, null], JSON.stringify(created));
  }
  assert.equal(row(refusalTask, repairBundle(recovery({ runtimePatchAttempts: [patch({ preflightOk: false, issueCodes: ["runtime_patch.target_node_invalid"], executed: true })] }), { oracleVerdict: "passed" })).judgement.passed, false);
  assert.equal(row(refusalTask, repairBundle(recovery({ runtimePatchAttempts: [patch({ preflightOk: false, issueCodes: ["runtime_patch.target_node_invalid"] })] }), { oracleVerdict: "failed" })).judgement.reason, "the declared final state does not hold");
  // ...and says nothing about the model when the model was never asked.
  const unasked = row(refusalTask, repairBundle(recovery({ attempted: false, interventions: [] }), { oracleVerdict: "passed", calls: 0 }), "passed");
  assert.deepEqual([unasked.judgement.passed, unasked.succeeded, unasked.repair.consulted, unasked.repair.refused], [null, false, false, false]);

  // A repair passes on a validated diagnosis and an accepted override that became a proposal, whatever the verdict.
  const proposal = row(repairTask, repairBundle(recovery({ runtimePatchAttempts: [patch({ proposalOnly: true, executed: false, changeProposalCreated: true, adaptationCreated: true })], adaptationIds: ["adaptation-1"], changeProposalIds: ["proposal-1"] })));
  assert.deepEqual([proposal.verdict, proposal.judgement.passed, proposal.succeeded, proposal.judgement.targetVerified, proposal.judgeBy], ["failed", true, true, null, "repair"]);
  assert.deepEqual([proposal.repair.changeProposalCreated, proposal.repair.adaptationCreated, proposal.repair.refused, proposal.repair.replayProviderCalls], [true, true, false, null]);
  // An executed override must reach the final state, which is what shows it pressed the right control.
  const executedRight = row(repairTask, repairBundle(recovery({ runtimePatchAttempts: [patch({ executed: true })] }), { oracleVerdict: "passed" }), "passed");
  assert.deepEqual([executedRight.judgement.passed, executedRight.judgement.targetVerified], [true, true]);
  const executedWrong = row(repairTask, repairBundle(recovery({ runtimePatchAttempts: [patch({ executed: true, adaptationCreated: true })] }), { oracleVerdict: "failed" }));
  assert.deepEqual([executedWrong.judgement.passed, executedWrong.judgement.targetVerified], [false, false]);

  // Where the Lab judged the declared repair, its verdict decides whether the proposal named the right control.
  const proposedOverride = recovery({ runtimePatchAttempts: [patch({ proposalOnly: true, adaptationCreated: true, changeProposalCreated: true })], adaptationIds: ["adaptation-1"], changeProposalIds: ["proposal-1"] });
  const labJudged = (labRepair, options = {}) => row(repairTask, repairBundle(proposedOverride, { labRepair, ...options }), "passed");
  const named = labJudged({ verdict: "repaired", patchKind: "temporary_target_override", proposals: 1, mismatchedFields: [], refusalCodes: [] });
  assert.deepEqual([named.judgement.passed, named.judgement.targetVerified, named.judgement.reason, named.repair.targetJudgement], [true, true, "repair proposed, naming the declared control", { verdict: "repaired", mismatchedFields: [] }]);
  const discard = labJudged({ verdict: "wrong_target", patchKind: "temporary_target_override", proposals: 1, mismatchedFields: ["accessibleName", "Discard changes"], refusalCodes: [] });
  assert.deepEqual([discard.judgement.passed, discard.judgement.targetVerified, discard.judgement.reason], [false, false, "the proposal named a different control (accessibleName differ)"], "a field name outside the closed set is dropped");
  assert.equal(labJudged({ verdict: "proposal_unreadable", mismatchedFields: [] }).judgement.reason, "the Lab judged the declared repair proposal_unreadable");
  assert.equal(labJudged({ verdict: "Apply changes" }).repair.targetJudgement, null, "a verdict outside the closed set is not read");
  assert.equal(labJudged(null).judgement.targetVerified, null, "no Lab judgement: the target is not checked");
  const rendered = renderSummaryMarkdown({ campaignId: "c", startedAt: "s", finishedAt: "f", options: { profiles: { create: "a", repair: "b" }, provider: "p", model: "m", maxAttempts: 1 }, totals: { tasks: 2, passed: 2, succeeded: 1, failed: 0, noResult: 0, judgementsPassed: 1, providerCalls: 4, reportedTokens: 0, reportedCostUsd: 0 }, tasks: [named, discard] });
  assert.match(rendered, /\| yes \| yes \| yes \(repaired\) \| not replayed \|/u);
  assert.match(rendered, /\| yes \| yes \| no \(wrong_target\) \| not replayed \|/u);

  // The live renamed-redesign shape: the override was refused at preflight, so there was no repair.
  const rejected = row(repairTask, repairBundle(refusedAtPreflight));
  assert.deepEqual([rejected.judgement.passed, rejected.judgement.reason, rejected.repair.refused], [false, "no patch was accepted", true]);
  const wrongKind = row(repairTask, repairBundle(recovery({ runtimePatchAttempts: [patch({ kind: "wait_retry", changeProposalCreated: true })] })));
  assert.equal(wrongKind.judgement.reason, "accepted wait_retry, not temporary_target_override");
  assert.equal(row(repairTask, repairBundle(recovery({ runtimePatchAttempts: [patch()] }))).judgement.reason, "the accepted temporary_target_override created no proposal or adaptation");
  assert.equal(row(repairTask, repairBundle(recovery({ interventions: [diagnosed[0]], runtimePatchAttempts: [patch({ changeProposalCreated: true })] }))).judgement.reason, "no diagnosis validated");
  assert.equal(row(repairTask, repairBundle(recovery({ attempted: false, interventions: [] }), { calls: 0 })).judgement.passed, false);

  // No recovery record: no Flow ran, so neither kind is measured.
  for (const task of REPAIRS) {
    const none = row(task, { evaluation: null, run: null, liveLlm: null, flowLane: null });
    assert.deepEqual([none.verdict, none.judgement.passed, none.succeeded, none.repair.measured, none.repair.patchKinds], ["failed", null, false, false, []]);
  }
});
