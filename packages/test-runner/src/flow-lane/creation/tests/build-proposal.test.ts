import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../../failure.js";
import { buildCreatedFlowProposal } from "../build-proposal.js";
import { ADAPTATION_ID, FLOW_ID, PROJECT_ID, fakeCreationCore, type FakeCreationCoreOptions } from "./fake-creation-core.js";
import { permissionRequiredDiagnostic } from "./permission-required-diagnostic.js";

/**
 * The build is the one paid step of a created-Flow run, and whatever Core
 * answers must become a record the run can publish before it judges anything:
 * a proposal, a refusal read through Core's own diagnostic parser, or a build
 * that outlived its request. These pin the order the web panel uses, each
 * outcome, and that nothing but identifiers, codes and counts is kept.
 */

const INSTRUCTION = "Scrape the first page with columns name and price.";

async function build(options: FakeCreationCoreOptions = {}, wait: { deadlineMs?: number } = {}) {
  const core = fakeCreationCore(options);
  const authorized: string[] = [];
  let clock = 0;
  const record = await buildCreatedFlowProposal(core.control, {
    projectId: PROJECT_ID,
    flowId: FLOW_ID,
    instruction: INSTRUCTION,
    authorize: async (flowId) => { core.calls.push("authorize"); authorized.push(flowId); return { grantId: "llm-grant:build" }; },
  }, {}, { now: () => clock, sleep: async (ms) => { clock += ms; }, pollMs: 1_000, ...(wait.deadlineMs === undefined ? {} : { deadlineMs: wait.deadlineMs }) });
  return { core, authorized, record };
}

test("the build saves the instruction, then authorizes, selects the context and explores, as the web panel does", async () => {
  const { core, authorized, record } = await build();
  assert.deepEqual(core.calls, ["save-flow-generation-instruction", "authorize", "select-context", "generate", "get-adaptation", "get-flow-adaptation"]);
  assert.deepEqual(core.instructionRequests, [{ projectId: PROJECT_ID, flowId: FLOW_ID, instruction: INSTRUCTION }]);
  assert.deepEqual(authorized, [FLOW_ID]);
  assert.deepEqual(core.generationRequests, [{ projectId: PROJECT_ID, flowId: FLOW_ID, llmExecutionGrantId: "llm-grant:build", evidenceGuided: true }]);
  assert.deepEqual(record, {
    outcome: "proposed",
    adaptationId: ADAPTATION_ID,
    providerCalls: 4,
    providerInvocation: "attempted",
    accounting: { provider: "deepseek", model: "deepseek-chat", inputTokens: 12_000, outputTokens: 2_000, totalTokens: 14_000, estimatedCostUsd: 0.01 },
    // A tool id without an identifier's shape is not kept.
    evidenceLoop: { decisionCount: 4, toolCallCount: 4, evidenceBytes: 18_000, toolIds: ["web.recovery.inspect"], steps: null },
    failure: null,
    recoveredAfterTimeout: false,
    durationMs: 0,
    instructedConsequences: [],
    permissionRequest: null,
  });
  assert.equal(JSON.stringify(record).includes("Scrape"), false, "the record holds no instruction text");
});

test("an instruction Core did not activate refuses before any grant is taken", async () => {
  await assert.rejects(build({ instructionStatus: "draft" }), /Core did not make the task's instruction the Flow's active instruction/u);
});

test("a refusal is read through Core's diagnostic parser, keeping its code, stage, counts and only well-formed tool ids", async () => {
  const diagnostic = {
    code: "flow_bootstrap.evidence_iteration_limit",
    stage: "provider_output_validation",
    retryable: false,
    providerInvocation: "attempted",
    providerResponse: "received",
    accounting: { requestId: "evidence.one", estimatedInputTokens: 900, provider: "deepseek", model: "deepseek-chat", inputTokens: 7_000, outputTokens: 700, totalTokens: 7_700, estimatedCostUsd: 0.004 },
    evidenceLoop: { iterationCount: 6, decisionCount: 5, toolCallCount: 5, evidenceBytes: 12_000, steps: [{ toolId: "web.recovery.inspect", effectApplied: false, resultCode: "web.evidence.captured" }, { toolId: "WEB.Recovery.Shout" }] },
  };
  const { core, record } = await build({ generation: { kind: "refused", status: 400, payload: { diagnostic } } });
  assert.equal(core.calls.includes("get-adaptation"), false);
  assert.deepEqual(record, {
    outcome: "failed",
    adaptationId: null,
    providerCalls: 5,
    providerInvocation: "attempted",
    accounting: { provider: "deepseek", model: "deepseek-chat", inputTokens: 7_000, outputTokens: 700, totalTokens: 7_700, estimatedCostUsd: 0.004 },
    evidenceLoop: { decisionCount: 5, toolCallCount: 5, evidenceBytes: 12_000, toolIds: ["web.recovery.inspect"], steps: [{ toolId: "web.recovery.inspect", effectApplied: false, resultCode: "web.evidence.captured" }] },
    failure: { code: "flow_bootstrap.evidence_iteration_limit", stage: "provider_output_validation", httpStatus: 400 },
    recoveredAfterTimeout: false,
    durationMs: 0,
    instructedConsequences: null,
    permissionRequest: null,
  });
  // A refusal before any request is a build that made no call.
  const early = await build({ generation: { kind: "refused", status: 400, payload: { diagnostic: { code: "flow_bootstrap.provider_resolution_failed", stage: "provider_resolution", retryable: false, providerInvocation: "not_attempted", providerResponse: "not_received" } } } });
  assert.equal(early.record.providerCalls, 0);
  assert.equal(early.record.providerInvocation, "not_attempted");
  assert.deepEqual(early.record.failure, { code: "flow_bootstrap.provider_resolution_failed", stage: "provider_resolution", httpStatus: 400 });
});

test("a build Core stopped to ask a person is a permission request naming the missing classes, not an HTTP failure", async () => {
  const diagnostic = await permissionRequiredDiagnostic();
  const { core, record } = await build({ generation: { kind: "refused", status: 400, payload: { diagnostic } } });
  assert.equal(record.outcome, "permission_required");
  assert.deepEqual(record.failure, { code: "flow_bootstrap.permission_required", stage: "provider_output_validation", httpStatus: 400 });
  assert.deepEqual(record.permissionRequest, {
    actionKind: "exploration_step",
    verb: "press",
    controlName: "Schedule post",
    controlKind: "button",
    consequences: ["send_or_publish"],
    missing: ["send_or_publish"],
    instructed: [],
  });
  assert.equal(record.providerCalls, 2);
  assert.equal(record.adaptationId, null);
  // Core built nothing, so there is no proposal to read back.
  assert.equal(core.calls.includes("get-adaptation"), false);
  // A request only ever travels on its own ending: the same request on another code is no diagnostic at all.
  const other = await build({ generation: { kind: "refused", status: 400, payload: { diagnostic: { ...(diagnostic as Record<string, unknown>), code: "flow_bootstrap.evidence_cancelled" } } } });
  assert.equal(other.record.outcome, "failed");
  assert.equal(other.record.failure?.code, "lab.generation_http_400");
  assert.equal(other.record.permissionRequest, null);
});

test("a build stopped on refused plans keeps what refused them, decision by decision, and no tool list of Core's own steps", async () => {
  const diagnostic = {
    code: "flow_bootstrap.evidence_unusable_decision",
    stage: "provider_output_validation",
    retryable: false,
    providerInvocation: "attempted",
    providerResponse: "received",
    accounting: { requestId: "evidence.two", estimatedInputTokens: 9_000, provider: "deepseek", model: "deepseek-chat", inputTokens: 13_000, outputTokens: 1_500, totalTokens: 14_500, estimatedCostUsd: 0.008 },
    evidenceLoop: {
      iterationCount: 3,
      decisionCount: 4,
      toolCallCount: 1,
      evidenceBytes: 4_300,
      steps: [
        { toolId: "web.inspect_current_page", resultCode: "web.inspect.succeeded" },
        { toolId: "core.decision_unusable", resultCode: "web.handle.unknown" },
        { toolId: "core.decision_unusable", resultCode: "bootstrap.invalid_parameter_value" },
        { toolId: "core.decision_unusable" },
      ],
    },
    issueCodes: ["bootstrap.invalid_parameter_value", "web.handle.unknown"],
  };
  const { record } = await build({ generation: { kind: "refused", status: 400, payload: { diagnostic } } });
  assert.deepEqual(record.failure, { code: "flow_bootstrap.evidence_unusable_decision", stage: "provider_output_validation", httpStatus: 400, issueCodes: ["bootstrap.invalid_parameter_value", "web.handle.unknown"] });
  assert.deepEqual(record.evidenceLoop, {
    decisionCount: 4,
    toolCallCount: 1,
    evidenceBytes: 4_300,
    // Core's own decision steps are decisions, not tools the build called.
    toolIds: ["web.inspect_current_page"],
    steps: [
      { toolId: "web.inspect_current_page", resultCode: "web.inspect.succeeded" },
      { toolId: "core.decision_unusable", resultCode: "web.handle.unknown" },
      { toolId: "core.decision_unusable", resultCode: "bootstrap.invalid_parameter_value" },
      { toolId: "core.decision_unusable" },
    ],
  });
});

test("a refusal Core's parser does not accept keeps only its HTTP status, and a malformed success is a refusal too", async () => {
  const unparsed = await build({ generation: { kind: "refused", status: 400, payload: { diagnostic: { code: "made.up", detail: "page text that must not travel" } } } });
  assert.deepEqual(unparsed.record.failure, { code: "lab.generation_http_400", stage: null, httpStatus: 400 });
  assert.equal(unparsed.record.providerInvocation, "unknown");
  assert.equal(JSON.stringify(unparsed.record).includes("page text"), false);
  const core = fakeCreationCore();
  const original = core.control.generateFlowBootstrapAdaptation;
  core.control.generateFlowBootstrapAdaptation = async (input) => { await original(input); return { status: 200, ok: true, payload: { adaptation: { projectId: PROJECT_ID, flowId: "another.flow", adaptationId: ADAPTATION_ID, status: "proposed" } } }; };
  const escaped = await buildCreatedFlowProposal(core.control, { projectId: PROJECT_ID, flowId: FLOW_ID, instruction: INSTRUCTION, authorize: async () => ({ grantId: "llm-grant:build" }) });
  assert.deepEqual(escaped.failure, { code: "lab.generation_answer_invalid", stage: null, httpStatus: 200 });
});

test("a build that outlives its request is found by polling for its proposal, within the run lease and no longer", async () => {
  const recovered = await build({ generation: { kind: "timeout", proposalAfterPolls: 3 } });
  assert.equal(recovered.record.outcome, "proposed");
  assert.equal(recovered.record.recoveredAfterTimeout, true);
  assert.equal(recovered.record.durationMs, 2_000);
  assert.deepEqual(recovered.core.calls.filter((call) => call === "list-adaptations"), ["list-adaptations", "list-adaptations", "list-adaptations"]);
  const unfinished = await build({ generation: { kind: "timeout" } }, { deadlineMs: 5_000 });
  assert.deepEqual(unfinished.record.failure, { code: "lab.generation_unfinished", stage: null, httpStatus: null });
  assert.equal(unfinished.record.providerInvocation, "unknown");
  assert.equal(unfinished.core.calls.filter((call) => call === "list-adaptations").length, 5);
});

test("a transport failure that is not a bounded wait is not mistaken for a build still running", async () => {
  await assert.rejects(build({ generation: { kind: "transport" } }), (error: unknown) => error instanceof RunnerFailure && /transport failed/u.test(error.message));
});

test("a proposal that cannot be shown to be what was paid for is a failed build, not a Flow", async () => {
  const cases: Array<[FakeCreationCoreOptions, string]> = [
    [{ adaptationStatus: "validated" }, "lab.proposal_not_pending_bootstrap"],
    [{ evidenceLoop: null }, "lab.proposal_without_evidence_audit"],
    [{ evidenceLoop: { iterationCount: 3, toolCallCount: 2, evidenceBytes: 10, toolIds: [] } }, "lab.proposal_without_call_count"],
    [{ evidenceLoop: { providerCallCount: 2, iterationCount: 3, toolCallCount: 0, evidenceBytes: 0, toolIds: [] } }, "lab.proposal_without_page_evidence"],
  ];
  for (const [options, code] of cases) {
    const { record } = await build(options);
    assert.equal(record.outcome, "failed", code);
    assert.equal(record.failure?.code, code);
    assert.equal(record.providerInvocation, "attempted", `${code}: a proposal exists, so a provider answered`);
  }
});
