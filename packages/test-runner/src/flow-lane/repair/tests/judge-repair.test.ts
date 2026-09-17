import assert from "node:assert/strict";
import test from "node:test";
import type { RunHarnessPatchAttempt, RunHarnessRecovery } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../../failure.js";
import type { FlowRepairExpectation } from "../declared-repair.js";
import { assertFlowRepair, judgeFlowRepair, type FlowRepairJudgement } from "../judge-repair.js";

// Whether a live run proposed the repair its scenario declared. The adaptation
// Core saved is the only place the proposal's target is written, and the
// target is page data, so the judgement is made here and only its verdict,
// field names and codes leave.

const EXPECTATION: FlowRepairExpectation = { patchKind: "temporary_target_override", target: { tagName: "button", accessibleName: "Apply changes", controlType: "submit" } };
const ADAPTATION_ID = "adaptation.run.lab.temporary-target-override.1";
const PROPOSAL_ID = `proposal.${ADAPTATION_ID}`;
/** The domain's resolution of the renamed Save, as `renamed-save-override.test.ts` pins it. */
const RENAMED_SAVE = { handles: { element: "target.2" }, handleResolution: "named", tagName: "button", accessibleName: "Apply changes", selector: "main > form > section:nth-of-type(1) > div > button:nth-of-type(1)", metadata: { controlType: "submit", formId: "settings-form" } };
const DISCARD = { handles: { element: "target.1" }, handleResolution: "named", tagName: "button", accessibleName: "Discard changes", selector: "#discard-settings", metadata: { controlType: "reset", formId: "settings-form" } };
const PAGE_DATA = ["Apply changes", "Discard changes", "#discard-settings", "main > form", "target.2"];

const proposed: RunHarnessPatchAttempt = { kind: "temporary_target_override", proposalOnly: true, executed: false, preflightOk: true, issueCodes: [], adaptationCreated: true, changeProposalCreated: true };
const recovered = (attempts: RunHarnessPatchAttempt[], ids: { adaptationIds?: string[]; changeProposalIds?: string[] } = {}): RunHarnessRecovery => ({
  attempted: true,
  interventions: [{ kind: "diagnosis", validationOk: true, validationCodes: [] }, { kind: "runtime_patch", validationOk: true, validationCodes: [] }],
  runtimePatchAttempts: attempts,
  adaptationIds: ids.adaptationIds ?? (attempts.some((attempt) => attempt.adaptationCreated) ? [ADAPTATION_ID] : []),
  changeProposalIds: ids.changeProposalIds ?? (attempts.some((attempt) => attempt.changeProposalCreated) ? [PROPOSAL_ID] : []),
});

function core(adaptation: (adaptationId: string) => unknown) {
  const reads: Array<Record<string, unknown>> = [];
  return {
    reads,
    control: {
      automationStudioCall: async (endpoint: string, payload: Record<string, unknown>) => {
        assert.equal(endpoint, "get-flow-adaptation");
        reads.push(payload);
        return { adaptation: adaptation(String(payload.adaptationId)) };
      },
    },
  };
}

const saved = (target: unknown, extra: Record<string, unknown> = {}) => () => ({
  adaptationId: ADAPTATION_ID, proposalId: PROPOSAL_ID, status: "proposed",
  patch: [{ kind: "edit_action_target", targetId: "recorded.save", summary: "Save was renamed.", after: target, metadata: { externalSideEffect: true } }],
  ...extra,
});

async function judge(recovery: RunHarnessRecovery, adaptation: (adaptationId: string) => unknown = saved(RENAMED_SAVE)) {
  const fake = core(adaptation);
  const judgement = await judgeFlowRepair(fake.control, { projectId: "project.lab", flowId: "flow.lab", run: { harnessRecovery: recovery }, expectation: EXPECTATION });
  for (const text of PAGE_DATA) assert.equal(JSON.stringify(judgement).includes(text), false, `the judgement carries ${text}`);
  return { judgement, reads: fake.reads };
}

test("a proposal naming the renamed Save is the declared repair", async () => {
  const { judgement, reads } = await judge(recovered([proposed]));
  assert.deepEqual(judgement, { verdict: "repaired", patchKind: "temporary_target_override", proposals: 1, mismatchedFields: [], refusalCodes: [] });
  assert.deepEqual(reads, [{ projectId: "project.lab", flowId: "flow.lab", adaptationId: ADAPTATION_ID }]);
  assert.doesNotThrow(() => assertFlowRepair(judgement));
});

test("a proposal naming Discard is a wrong target, named by the fields that differ and never by their values", async () => {
  const { judgement } = await judge(recovered([proposed]), saved(DISCARD));
  assert.deepEqual(judgement, { verdict: "wrong_target", patchKind: "temporary_target_override", proposals: 1, mismatchedFields: ["accessibleName", "controlType"], refusalCodes: [] });
  assert.throws(() => assertFlowRepair(judgement), (error: unknown) => error instanceof RunnerFailure && error.category === "runtime.behavior"
    && error.message === "The live repair was not the declared one: its proposal named a different control (accessibleName, controlType differ)");
});

test("an element with no separate accessible name is judged by its visible text", async () => {
  const { accessibleName: _name, ...unnamed } = RENAMED_SAVE;
  const { judgement } = await judge(recovered([proposed]), saved({ ...unnamed, visibleText: "Apply changes" }));
  assert.equal(judgement.verdict, "repaired");
});

test("an override Core refused is judged refused, with the recovery record's codes", async () => {
  const refused: RunHarnessPatchAttempt = { ...proposed, preflightOk: false, adaptationCreated: false, changeProposalCreated: false, issueCodes: ["runtime_patch.target_override_rejected", "runtime_patch.target_override_rejected.action_not_repairable"] };
  const { judgement, reads } = await judge(recovered([refused]));
  assert.deepEqual(judgement, { verdict: "refused", patchKind: "temporary_target_override", proposals: 0, mismatchedFields: [], refusalCodes: refused.issueCodes });
  assert.deepEqual(reads, [], "a refused override saved nothing to read");
  assert.throws(() => assertFlowRepair(judgement), /The live repair was not the declared one: Core refused it \(runtime_patch\.target_override_rejected, runtime_patch\.target_override_rejected\.action_not_repairable\)/u);
});

test("a recovery that proposed something else, or nothing, is judged not proposed; one that never ran, not attempted", async () => {
  const waited: RunHarnessPatchAttempt = { ...proposed, kind: "temporary_wait_retry", adaptationCreated: false, changeProposalCreated: false };
  assert.equal((await judge(recovered([waited]))).judgement.verdict, "not_proposed");
  assert.equal((await judge(recovered([]))).judgement.verdict, "not_proposed");
  const quiet: RunHarnessRecovery = { attempted: false, interventions: [], runtimePatchAttempts: [], adaptationIds: [], changeProposalIds: [] };
  const { judgement } = await judge(quiet);
  assert.equal(judgement.verdict, "not_attempted");
  assert.throws(() => assertFlowRepair(judgement), /Core attempted no recovery/u);
  assert.throws(() => assertFlowRepair({ ...judgement, verdict: "not_proposed" }), /no temporary_target_override was proposed/u);
});

test("a proposal that cannot be read back, or that no change proposal of the run owns, is not taken on trust", async () => {
  assert.equal((await judge(recovered([proposed]), () => { throw new Error("adaptation store unavailable"); })).judgement.verdict, "proposal_unreadable");
  assert.equal((await judge(recovered([proposed]), () => null)).judgement.verdict, "proposal_unreadable");
  assert.equal((await judge(recovered([proposed]), saved(RENAMED_SAVE, { proposalId: "proposal.of.another.run" }))).judgement.verdict, "proposal_unreadable");
  assert.equal((await judge(recovered([proposed]), saved(RENAMED_SAVE, { patch: [{ kind: "edit_expectation", after: RENAMED_SAVE }] }))).judgement.verdict, "proposal_unreadable");
  assert.throws(() => assertFlowRepair({ verdict: "proposal_unreadable", patchKind: "temporary_target_override", proposals: 0, mismatchedFields: [], refusalCodes: [] }), /the proposal it saved could not be read back/u);
});

test("of several proposals, one naming the declared target is enough", async () => {
  const second = "adaptation.run.lab.temporary-target-override.2";
  const targets: Record<string, unknown> = { [ADAPTATION_ID]: DISCARD, [second]: RENAMED_SAVE };
  const { judgement } = await judge(
    recovered([proposed, proposed], { adaptationIds: [ADAPTATION_ID, second], changeProposalIds: [PROPOSAL_ID, `proposal.${second}`] }),
    (adaptationId) => ({ ...saved(targets[adaptationId])(), adaptationId, proposalId: `proposal.${adaptationId}` }),
  );
  assert.deepEqual(judgement, { verdict: "repaired", patchKind: "temporary_target_override", proposals: 2, mismatchedFields: [], refusalCodes: [] } satisfies FlowRepairJudgement);
});

test("no judgement is no assertion", () => {
  assert.doesNotThrow(() => assertFlowRepair(undefined));
});
