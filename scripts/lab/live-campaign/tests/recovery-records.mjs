/**
 * Recovery records shaped like the live ones: `run-mu4ovip2-b15551d3`
 * (identity-drift/save-and-exit) had a first diagnosis that did not validate, a
 * validated one, a validated patch reply, and one target override refused at
 * preflight.
 */
export const diagnosed = [{ kind: "diagnosis", validationOk: false, validationCodes: [] }, { kind: "diagnosis", validationOk: true, validationCodes: [] }, { kind: "runtime_patch", validationOk: true, validationCodes: [] }];
export const patch = (fields = {}) => ({ kind: "temporary_target_override", proposalOnly: null, executed: null, preflightOk: true, issueCodes: [], adaptationCreated: false, changeProposalCreated: false, ...fields });
export const recovery = (fields = {}) => ({ attempted: true, interventions: diagnosed, runtimePatchAttempts: [], adaptationIds: [], changeProposalIds: [], ...fields });
export const repairBundle = (harnessRecovery, { oracleVerdict = "failed", calls = 2, labRepair = undefined } = {}) => ({
  evaluation: { flowCreated: true, oracleVerdict, harnessRecovery, automationFailureReported: { category: "target_not_found", code: "web.target.not_found" }, actions: [{ actionType: "web.dom.type" }, { actionType: "web.dom.click" }], llm: { mode: "live", calls } },
  run: null,
  // The Lab's declared-repair judgement, as `flowLaneSnapshot` writes it (`repair`, or null when none was judged).
  flowLane: labRepair === undefined ? null : { harnessRecovery, repair: labRepair },
  liveLlm: { observed: { calls, accounting: { totalTokens: 999999 }, observedCalls: [{ totalTokens: 3662, estimatedCostUsd: 0.00203456, validationCodes: [] }, { totalTokens: 3725, estimatedCostUsd: 0.00203676, validationCodes: [] }].slice(0, calls) } },
});
