import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../../failure.js";
import { buildCreatedFlowProposal } from "../build-proposal.js";
import { ADAPTATION_ID, FLOW_ID, PROJECT_ID, fakeCreationCore, type FakeCreationCoreOptions } from "./fake-creation-core.js";
import { permissionRequiredDiagnostic } from "./permission-required-diagnostic.js";
import { parkedProposalConsequences } from "./parked-proposal.js";

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
  assert.deepEqual(core.calls, ["save-flow-generation-instruction", "authorize", "select-context", "generate", "get-adaptation"]);
  assert.deepEqual(core.instructionRequests, [{ projectId: PROJECT_ID, flowId: FLOW_ID, instruction: INSTRUCTION }]);
  assert.deepEqual(authorized, [FLOW_ID]);
  // No start location was named, so the request carries none and Core builds
  // from whatever is in front of it, exactly as it did before t103.
  assert.deepEqual(core.generationRequests, [{ projectId: PROJECT_ID, flowId: FLOW_ID, llmExecutionGrantId: "llm-grant:build", evidenceGuided: true }]);
  assert.deepEqual(record, {
    outcome: "proposed",
    adaptationId: ADAPTATION_ID,
    providerCalls: 4,
    loopProviderCalls: 4,
    providerInvocation: "attempted",
    accounting: { provider: "deepseek", model: "deepseek-chat", inputTokens: 12_000, outputTokens: 2_000, totalTokens: 14_000, estimatedCostUsd: 0.01 },
    // A tool id without an identifier's shape is not kept.
    evidenceLoop: { decisionCount: 4, toolCallCount: 4, evidenceBytes: 18_000, toolIds: ["web.recovery.inspect"], steps: null },
    failure: null,
    recoveredAfterTimeout: false,
    durationMs: 0,
    instructedConsequences: [],
    declaredConsequences: null,
    consequenceCrossCheck: null,
    permissionRequest: null,
  });
  assert.equal(JSON.stringify(record).includes("Scrape"), false, "the record holds no instruction text");
});

test("a proposed build keeps the decisions Core published on the proposal, in the shape a refused build's carry", async () => {
  // Core stores the build's evidence trace on the proposal and does not
  // project it onto `get-flow-adaptation` yet, so `steps` is `null` on every
  // proposed build measured so far. This pins the Lab's half: the moment the
  // created audit detail carries them, the accrual trail of a *successful*
  // build is in the record, filtered exactly as a refused build's is.
  const { record } = await build({
    evidenceLoop: {
      providerCallCount: 4, decisionCount: 4, traceStepCount: 5, iterationCount: 5, toolCallCount: 4, evidenceBytes: 18_000,
      toolIds: ["web.recovery.inspect"],
      steps: [
        { toolId: "web.inspect_current_page", effectApplied: false, resultCode: "web.inspect.succeeded" },
        { toolId: "web.reveal_safe", effectApplied: true },
        { toolId: "core.decision_unusable", resultCode: "web.handle.unknown" },
        { toolId: "WEB.Unrecognized.Tool" },
      ],
    },
  });
  assert.deepEqual(record.evidenceLoop?.steps, [
    { toolId: "web.inspect_current_page", effectApplied: false, resultCode: "web.inspect.succeeded" },
    { toolId: "web.reveal_safe", effectApplied: true },
    { toolId: "core.decision_unusable", resultCode: "web.handle.unknown" },
  ]);
  // `toolIds` stays Core's own list on a proposal, which already excludes its decision steps.
  assert.deepEqual(record.evidenceLoop?.toolIds, ["web.recovery.inspect"]);
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
    loopProviderCalls: 5,
    providerInvocation: "attempted",
    accounting: { provider: "deepseek", model: "deepseek-chat", inputTokens: 7_000, outputTokens: 700, totalTokens: 7_700, estimatedCostUsd: 0.004 },
    evidenceLoop: { decisionCount: 5, toolCallCount: 5, evidenceBytes: 12_000, toolIds: ["web.recovery.inspect"], steps: [{ toolId: "web.recovery.inspect", effectApplied: false, resultCode: "web.evidence.captured" }] },
    failure: { code: "flow_bootstrap.evidence_iteration_limit", stage: "provider_output_validation", httpStatus: 400 },
    recoveredAfterTimeout: false,
    durationMs: 0,
    instructedConsequences: null,
    declaredConsequences: null,
    consequenceCrossCheck: null,
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

test("a proposal that still carries an unanswered question is a permission request, not a build to be reviewed", async () => {
  // Since the gate learned to park, a build can finish, leave a proposal and
  // carry the question on it. Core then refuses to approve or apply it, and
  // that refusal used to be the first anyone heard of it: an HTTP 400 on
  // `review-flow-adaptation`, which a campaign recorded as
  // `environment.missing` (`run-mudt5jr5-92321d8c`). The proposal says so
  // itself, before anything is asked of the review surface.
  const { record } = await build({ consequences: await parkedProposalConsequences() });

  assert.equal(record.outcome, "permission_required");
  assert.deepEqual(record.failure, { code: "flow_bootstrap.permission_required", stage: "review", httpStatus: null });
  assert.equal(record.permissionRequest?.controlName, "Schedule post");
  assert.deepEqual(record.permissionRequest?.missing, ["send_or_publish"]);
  // The proposal is still named: a Flow was built and waits on an answer.
  assert.equal(record.adaptationId, ADAPTATION_ID);
});

test("a build's declarations and Core's cross-check are read from where Core puts them, so a Flow's steps can be read rather than deduced", async () => {
  // They live under `metadata.bootstrap`. The top-level
  // `adaptation.instructedConsequences` this used to read is never populated
  // for a bootstrap proposal, so every build measured before 2026-09-23
  // reported an empty declaration while the stored proposal held a full one.
  const { record } = await build({ consequences: await parkedProposalConsequences() });

  assert.deepEqual(record.declaredConsequences?.map((entry) => [entry.actionKind, entry.verb, entry.controlName, entry.consequences, entry.permitted]), [
    ["exploration_step", "enter", "Post text", [], true],
    ["flow_step", "press", "Schedule post", ["send_or_publish"], false],
  ]);
  assert.equal(record.consequenceCrossCheck?.verdict, "beyond_instruction");
  assert.deepEqual(record.consequenceCrossCheck?.declared, ["send_or_publish"]);
  assert.deepEqual([record.consequenceCrossCheck?.actions, record.consequenceCrossCheck?.declaredNothing], [2, 1]);
});

test("a build's reported calls are every call it made, with the loop's own beside them", async () => {
  // Core spends provider calls outside the evidence loop -- reading what the
  // person's instruction already asks for -- and publishes them separately, so
  // a reader taking the loop count alone under-reports what the grant paid for.
  const { record } = await build({
    evidenceLoop: { providerCallCount: 17, decisionCount: 17, additionalProviderCallCount: 1, totalProviderCallCount: 18, traceStepCount: 18, iterationCount: 18, toolCallCount: 9, evidenceBytes: 18_000, toolIds: ["web.recovery.inspect"] },
  });

  assert.equal(record.providerCalls, 18);
  assert.equal(record.loopProviderCalls, 17);
  assert.equal(record.evidenceLoop?.decisionCount, 17);
});

/**
 * Where the Flow starts, told to Core rather than loaded for the build.
 *
 * No instruction in the catalog names an address -- they are written as a
 * shopper would type them -- and the fixture's origin is a loopback port drawn
 * per run, so nothing written down beforehand could have carried one. This is
 * the only channel it has (`AS/runtime/flow-bootstrap/start-location.ts`), and
 * without it a build that starts on a blank tab has nowhere to go.
 */
test("the build tells Core where the Flow starts, when the run named a start location", async () => {
  const core = fakeCreationCore();
  await buildCreatedFlowProposal(core.control, {
    projectId: PROJECT_ID,
    flowId: FLOW_ID,
    instruction: INSTRUCTION,
    startLocation: "http://127.0.0.1:53017/scenarios/everything-store/",
    authorize: async () => ({ grantId: "llm-grant:build" }),
  }, {}, { now: () => 0, sleep: async () => {} });

  assert.deepEqual(core.generationRequests, [{
    projectId: PROJECT_ID,
    flowId: FLOW_ID,
    llmExecutionGrantId: "llm-grant:build",
    evidenceGuided: true,
    startLocation: "http://127.0.0.1:53017/scenarios/everything-store/",
  }]);
});
