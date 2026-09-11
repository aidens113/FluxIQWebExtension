import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { explorationAdaptationRunIsComplete, requireExactExplorationProposalIdentity, safeRuntimePatchDiagnostics } from "../demo-llm-exploration-adaptation-wait.js";

function run(status: "running" | "failed", interventions: number, adaptationIds: string[] = []) {
  return {
    summary: { runId: "run.one", projectId: "project.one", flowId: "flow.one", status, routeDecisionCount: 1, subflowEntryCount: 1, actionAttemptCount: 1, updatedAt: 1 },
    routeDecisions: [], subflows: [], actionAttempts: [],
    interventions: Array.from({ length: interventions }, (_, index) => ({ interventionId: `i${index}`, kind: index === 0 ? "diagnosis" : "runtime_patch" })),
    adaptationIds, changeProposalIds: adaptationIds, providerCallCount: interventions,
  } as any;
}

test("terminal two-intervention rejection completes without waiting for an adaptation ID", () => {
  const rejected = run("failed", 2);
  rejected.runtimePatchAttempts = [{
    kind: "temporary_target_override", preflightOk: false,
    issueCodes: ["runtime_patch.target_override_rejected"],
    adaptationCreated: false, changeProposalCreated: false,
  }];
  assert.equal(explorationAdaptationRunIsComplete(rejected), true);
  assert.throws(
    () => requireExactExplorationProposalIdentity(rejected),
    (error: any) => error?.details?.reasonCode === "exploration_adaptation_run.proposal_identity_invalid"
      && error.details.runtimePatchDiagnostics[0]?.patchCategory === "target_override"
      && error.details.runtimePatchDiagnostics[0]?.preflightStatus === "failed",
  );
});

test("wait completion remains false until both terminal state and two interventions are durable", () => {
  assert.equal(explorationAdaptationRunIsComplete(run("running", 2)), false);
  assert.equal(explorationAdaptationRunIsComplete(run("failed", 1)), false);
  assert.equal(requireExactExplorationProposalIdentity(run("failed", 2, ["adaptation.one"])), "adaptation.one");
  assert.throws(() => requireExactExplorationProposalIdentity(run("failed", 2, ["a", "b"])), /one exact proposal/u);
});

test("diagnostics project only bounded categories, statuses, and allowlisted issue codes", () => {
  const rejected = run("failed", 2);
  rejected.runtimePatchAttempts = [{
    kind: "selector=secret", preflightOk: false,
    issueCodes: ["raw selector #private", "runtime_patch.policy_rejected", "runtime_patch.policy_rejected"],
    adaptationCreated: false, changeProposalCreated: false,
    selector: "#private", prompt: "private prompt", evidence: { html: "private" }, rawOutput: "private",
  }];
  assert.deepEqual(safeRuntimePatchDiagnostics(rejected), [{
    patchCategory: "unknown",
    preflightStatus: "failed",
    issueCodes: ["runtime_patch.preflight_rejected", "runtime_patch.policy_rejected"],
    adaptationCreated: false,
    changeProposalCreated: false,
  }]);
  assert.doesNotMatch(JSON.stringify(safeRuntimePatchDiagnostics(rejected)), /private|selector|prompt|evidence|rawOutput/u);
});

test("proposal launcher exposes the safe proposal identity reason code", async () => {
  const launcher = await readFile("scripts/run-demo-llm-exploration-adaptation.mjs", "utf8");
  assert.match(launcher, /exploration_adaptation_run/u);
  assert.match(launcher, /reasonCode/u);
  assert.match(launcher, /runtimePatchDiagnostics/u);
  assert.match(launcher, /runtime_patch\.target_override_rejected/u);
  assert.doesNotMatch(launcher, /error\.message|String\(error\)|selector|rawOutput/u);
});
