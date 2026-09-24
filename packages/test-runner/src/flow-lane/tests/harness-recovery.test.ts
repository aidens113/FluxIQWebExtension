import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { DEFAULT_LLM_MODEL, type RunHarnessRecovery, validateRunHarnessRecovery } from "@fluxiq-web-extension/test-contracts";
import { ExistingFluxIQControlClient, type ExistingRunDetail } from "../../existing-fluxiq-control.js";
import { RunnerFailure } from "../../failure.js";
import { flowLaneObservation } from "../lane-observation.js";
import { executeRecordedFlowRun, type PersistedFlowRunControl, type PersistedFlowRunOutcome } from "../persisted-flow-run.js";
import { flowLaneSnapshot, type FlowLaneEvidence } from "../run-flow-lane.js";

/**
 * What Core's run detail carries and a recovery record must never hold: a
 * prompt, a response, a selector, page text and issue sentences, plus the
 * request id, model and prompt version the parser keeps and the record leaves
 * behind.
 */
const MUST_NOT_TRAVEL = ["PRIVATE-PROMPT", "PRIVATE-RESPONSE", "#private-selector", "PRIVATE-PAGE-TEXT", "PRIVATE-ISSUE", "llm.request.private", DEFAULT_LLM_MODEL, "runtime-diagnosis.v1"];

const ADAPTATION_ID = "adaptation.run.one.temporary_wait_retry.1700";
const PROPOSAL_ID = "proposal.adaptation.run.one.temporary_target_override.1600";
const summary = { runId: "run.one", projectId: "project.web", flowId: "flow.new", status: "succeeded", updatedAt: 2_000, actionAttemptCount: 1, routeDecisionCount: 0, subflowEntryCount: 0, interventionCount: 2, adaptationCount: 1 };
const attempt = { attemptId: "attempt.one", nodeId: "node.one", definitionId: "web.dom.type", order: 0, status: "succeeded", startedAt: 1_000, finishedAt: 1_030 };

/**
 * A run Core recovered, shaped as `annotate.ts` and `patches.ts` write it: a
 * diagnosis, then a patch response whose three patches were a proposal-only
 * target override that created a change proposal, an executed wait-retry that
 * created an adaptation, and a reroute refused at preflight.
 */
function recoveredDetail(): Record<string, unknown> {
  return {
    summary, routeDecisions: [], subflows: [], actionAttempts: [attempt],
    interventions: [
      {
        interventionId: "intervention.diagnosis", kind: "diagnosis",
        promptVersion: "automation-studio.runtime-diagnosis.v1+stage.gather", provider: "deepseek", model: DEFAULT_LLM_MODEL,
        validation: { ok: true, issues: ["diagnosis.evidence_partial: PRIVATE-ISSUE about PRIVATE-PAGE-TEXT"] },
        tokenUsage: { inputTokens: 900, outputTokens: 120, totalTokens: 1_020, estimatedCostUsd: 0.001 },
        createdAt: 1_100, metadata: { requestId: "llm.request.private" },
        reason: "PRIVATE-ISSUE", prompt: "PRIVATE-PROMPT", response: { text: "PRIVATE-RESPONSE" },
      },
      {
        interventionId: "intervention.patch", kind: "runtime_patch", provider: "deepseek", model: DEFAULT_LLM_MODEL,
        validation: { ok: true, issues: ["PRIVATE-ISSUE: a sentence is not a code"] },
        createdAt: 1_200, response: { patches: [{ selector: "#private-selector" }] },
      },
    ],
    adaptationIds: [ADAPTATION_ID],
    changeProposalIds: [PROPOSAL_ID],
    metadata: {
      runtimePatchAttempts: [
        { kind: "temporary_target_override", proposalOnly: true, executed: false, preflightOk: true, issues: [], changeProposalId: PROPOSAL_ID, targetResolution: { selector: "#private-selector" }, traceStatus: "not-run" },
        { kind: "temporary_wait_retry", proposalOnly: false, executed: true, preflightOk: true, issues: [], adaptationId: ADAPTATION_ID, verification: { text: "PRIVATE-PAGE-TEXT" }, traceStatus: "passed" },
        { kind: "temporary_reroute", proposalOnly: false, executed: false, preflightOk: false, issues: ["Unknown target node PRIVATE-PAGE-TEXT"], traceStatus: "not-run" },
      ],
    },
  };
}

const RECOVERED: RunHarnessRecovery = {
  attempted: true,
  interventions: [
    { kind: "diagnosis", validationOk: true, validationCodes: ["diagnosis.evidence_partial"] },
    { kind: "runtime_patch", validationOk: true, validationCodes: [] },
  ],
  runtimePatchAttempts: [
    { kind: "temporary_target_override", proposalOnly: true, executed: false, preflightOk: true, issueCodes: [], adaptationCreated: false, changeProposalCreated: true },
    { kind: "temporary_wait_retry", proposalOnly: false, executed: true, preflightOk: true, issueCodes: [], adaptationCreated: true, changeProposalCreated: false },
    { kind: "temporary_reroute", proposalOnly: false, executed: false, preflightOk: false, issueCodes: ["runtime_patch.target_node_invalid"], adaptationCreated: false, changeProposalCreated: false },
  ],
  adaptationIds: [ADAPTATION_ID],
  changeProposalIds: [PROPOSAL_ID],
  refusalCode: null,
  refusalRung: null,
};

const NO_RECOVERY: RunHarnessRecovery = { attempted: false, interventions: [], runtimePatchAttempts: [], adaptationIds: [], changeProposalIds: [], refusalCode: null, refusalRung: null };

function json(payload: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json", ...headers } });
}

/**
 * Core as the Flow lane meets it, serving whichever detail `serve` last named.
 * The lane's own calls are fakes. `getRunDetail` is the real control client
 * parsing that same detail through a stubbed `fetch`: the parser is what this
 * reader reuses, so it is not faked. One per test, so `fetch` is stubbed and
 * restored exactly once.
 */
async function core(t: TestContext) {
  const calls: string[] = [];
  let detail: () => Record<string, unknown> = recoveredDetail;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname === "/api/auth/login") return json({ ok: true }, { "set-cookie": "fluxiq_session=opaque; Max-Age=3600" });
    if (url.pathname.endsWith("/get-flow-run-detail")) return json({ ok: true, payload: { runDetail: detail() } });
    throw new Error(`unexpected ${url.pathname}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });
  const parser = new ExistingFluxIQControlClient("https://panel.example.test");
  await parser.login({ username: "runner", password: "password-value", totp: "123456", pin: "654321" });
  const control: PersistedFlowRunControl = {
    selectExistingContext: async () => { calls.push("select"); },
    startPersistedFlow: async () => { calls.push("start"); return { runId: "run.one" }; },
    runPersistedFlow: async () => { calls.push("run"); return { session: { runId: "run.one", status: "succeeded" } }; },
    automationStudioCall: async (endpoint) => { calls.push(endpoint); return { runDetail: detail() }; },
    getRunDetail: async (projectId, runId, bounds) => { calls.push("getRunDetail"); return parser.getRunDetail(projectId, runId, bounds); },
  };
  const serve = (next: () => Record<string, unknown>) => { detail = next; calls.length = 0; };
  return { control, calls, serve };
}

const run = (control: PersistedFlowRunControl) => executeRecordedFlowRun(control, { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab" });

/** The snapshot the runner writes for `run`, with nothing else in the evidence worth reading. */
function snapshotOf(outcome: PersistedFlowRunOutcome) {
  return flowLaneSnapshot({
    recording: { recordingId: "recording.one", entryCount: 1, entriesAppendedWhileWaiting: 0, waitedMs: 0, polls: 1 },
    proposal: { proposalId: "proposal.one", mapperId: "web-recording-actions", candidateCount: 1, issues: [] },
    flowId: "flow.new",
    run: outcome,
    observation: flowLaneObservation({ flowCreated: true, oracleVerdict: "passed", run: outcome, automationFailureExpected: null }),
    extraction: { expectation: "not_expected", extractNodes: 0, unpairedDatasets: 0, nonStringValues: 0, steps: [] },
    startCandidateIndex: 0,
  } as unknown as FlowLaneEvidence);
}

test("a recovered run is recorded in full: the diagnosis, the proposal-only override and its change proposal, the executed patch and its adaptation", async (t) => {
  const { control, calls } = await core(t);
  const outcome = await run(control);
  assert.deepEqual(outcome.harnessRecovery, RECOVERED);
  assert.equal(outcome.harnessActivations, 2);
  // The record is read once the detail is terminal, through the control client's own parser.
  assert.deepEqual(calls, ["select", "start", "run", "get-flow-run-detail", "getRunDetail"]);
  assert.deepEqual(validateRunHarnessRecovery(outcome.harnessRecovery), { valid: true, value: outcome.harnessRecovery });
  // Written into `snapshots/flow-lane.json`, and carried to the evaluation by the lane's observation.
  assert.deepEqual(snapshotOf(outcome).harnessRecovery, RECOVERED);
  assert.deepEqual(flowLaneObservation({ flowCreated: true, oracleVerdict: "passed", run: outcome, automationFailureExpected: null }).harnessRecovery, RECOVERED);
});

// Core has written this summary on every run since the recovery context
// existed -- section names, byte counts and reasons, never a section's contents,
// built exactly so a test could require a section was carried without holding
// page data -- and nothing here read it. So "was the model told what it should
// have been told" was a question a run could not answer. Live run
// `run-muexhp0k-73172f73` (2026-09-24) is where that bit: its repair never ran,
// and no artifact could say which evidence the repair would have been given.
test("the recovery context's sections are recorded by name, with Core's reason for each one left out", async (t) => {
  const { control, serve } = await core(t);
  serve(() => {
    const detail = recoveredDetail();
    (detail.metadata as Record<string, unknown>).llmGate = {
      recoveryContext: {
        byteCount: 4_010,
        included: [{ section: "failure", byteCount: 900 }, { section: "recovered_failures", byteCount: 610 }],
        omitted: [{ section: "state_diff", reason: "absent", byteCount: 0 }, { section: "recent_nodes", reason: "byte_budget", byteCount: 220 }, { section: "step_parameters", reason: "withheld", byteCount: 0 }],
      },
    };
    return detail;
  });
  const outcome = await run(control);

  assert.deepEqual(outcome.harnessRecovery?.contextSections, {
    included: ["failure", "recovered_failures"],
    omitted: [{ section: "state_diff", reason: "absent" }, { section: "recent_nodes", reason: "byte_budget" }, { section: "step_parameters", reason: "withheld" }],
  });
  assert.deepEqual(validateRunHarnessRecovery(outcome.harnessRecovery), { valid: true, value: outcome.harnessRecovery });
  // Byte counts are Core's, not this lane's business, and carrying them would be
  // one more number a fixture has to keep stable for nothing.
  assert.equal(JSON.stringify(outcome.harnessRecovery?.contextSections).includes("610"), false);
});

// Absent, not null: a run whose Core never wrote a recovery context says nothing
// either way, and a reader must not take that for "Core carried no sections".
test("a run with no recovery context leaves the member absent", async (t) => {
  const { control } = await core(t);
  const outcome = await run(control);

  assert.equal("contextSections" in (outcome.harnessRecovery ?? {}), false);
  assert.deepEqual(outcome.harnessRecovery, RECOVERED);
});

test("nothing free-text reaches the recovery record or the snapshot written from it", async (t) => {
  const { control } = await core(t);
  const outcome = await run(control);
  const raw = JSON.stringify(recoveredDetail());
  for (const text of MUST_NOT_TRAVEL) assert.ok(raw.includes(text), `the fixture carries ${text}, so its absence below means something`);
  // An empty record holds no text either; this one must hold the recovery.
  assert.deepEqual(outcome.harnessRecovery, RECOVERED);
  for (const [name, serialized] of [["record", JSON.stringify(outcome.harnessRecovery)], ["snapshot", JSON.stringify(snapshotOf(outcome))]] as const) {
    for (const text of MUST_NOT_TRAVEL) assert.equal(serialized.includes(text), false, `the ${name} carries ${text}`);
  }
});

test("a run with no recovery records no recovery, as attempted: false, without a second read", async (t) => {
  const quiet = (extra: Record<string, unknown>) => () => ({ summary: { ...summary, interventionCount: 0, adaptationCount: 0 }, routeDecisions: [], subflows: [], actionAttempts: [attempt], ...extra });
  const { control, calls, serve } = await core(t);
  for (const [name, extra] of Object.entries({
    "lists absent": {},
    "lists empty": { interventions: [], adaptationIds: [], changeProposalIds: [], metadata: { runtimePatchAttempts: [] } },
    "lists null": { interventions: null, adaptationIds: null, changeProposalIds: null, metadata: null },
    "metadata without attempts": { interventions: [], metadata: { llmGate: { invoked: false } } },
  })) {
    serve(quiet(extra));
    const outcome = await run(control);
    assert.deepEqual(outcome.harnessRecovery, NO_RECOVERY, name);
    assert.deepEqual(calls, ["select", "start", "run", "get-flow-run-detail"], `${name}: a provider-free run costs no second read`);
    const observation = flowLaneObservation({ flowCreated: true, oracleVerdict: "passed", run: outcome, automationFailureExpected: null });
    assert.deepEqual(observation.harnessRecovery, NO_RECOVERY, `${name}: no recovery is stated, not left unmeasured`);
    assert.equal(observation.reportedVerdict, "passed", `${name}: and it is not a failed one`);
    assert.deepEqual(snapshotOf(outcome).harnessRecovery, NO_RECOVERY, name);
  }
});

test("a recovery field Core wrote malformed fails the reader, naming its path", async (t) => {
  type Detail = Record<string, unknown>;
  const patched = (mutate: (detail: Detail) => void) => () => { const detail = recoveredDetail(); mutate(detail); return detail; };
  const patchAttempts = (detail: Detail) => (detail.metadata as { runtimePatchAttempts: Detail[] }).runtimePatchAttempts;
  const interventions = (detail: Detail) => detail.interventions as Detail[];
  const cases: ReadonlyArray<readonly [path: string, mutate: (detail: Detail) => void]> = [
    ["runDetail.metadata.runtimePatchAttempts[1].issues", (detail) => { patchAttempts(detail)[1]!.issues = "Unknown target node PRIVATE-PAGE-TEXT"; }],
    ["runDetail.metadata.runtimePatchAttempts", (detail) => { detail.metadata = { runtimePatchAttempts: "PRIVATE-PAGE-TEXT" }; }],
    ["runDetail.metadata", (detail) => { detail.metadata = "PRIVATE-PAGE-TEXT"; }],
    ["interventions[0].kind", (detail) => { interventions(detail)[0]!.kind = "PRIVATE-PAGE-TEXT"; }],
    ["interventions[1].validation.issues[0]", (detail) => { interventions(detail)[1]!.validation = { ok: false, issues: [{ text: "PRIVATE-ISSUE" }] }; }],
    ["runDetail.adaptationIds[0]", (detail) => { detail.adaptationIds = ["PRIVATE-PAGE-TEXT with spaces"]; }],
    ["runDetail.changeProposalIds", (detail) => { detail.changeProposalIds = PROPOSAL_ID; }],
    ["runDetail.changeProposalIds[0]", (detail) => { detail.changeProposalIds = [""]; }],
  ];
  const { control, serve } = await core(t);
  for (const [path, mutate] of cases) {
    serve(patched(mutate));
    await assert.rejects(
      () => run(control),
      (error: unknown) => error instanceof RunnerFailure && error.message.startsWith(`Malformed FluxIQ API response: ${path} `) && !error.message.includes("PRIVATE"),
      path,
    );
  }
});

// `run-mu4rpka7-845d919a` recorded only `runtime_patch.target_override_rejected`,
// which reads the same whether the domain could not repair the action at all,
// the model invented a parameter, or it named a handle it was never shown.
// Core now records why, in its own closed words; the code carries the case.
test("a refused target override says which case it was, by Core's closed reason, never by its sentence", async (t) => {
  const refused = (refusal: unknown) => () => {
    const detail = recoveredDetail();
    const attempts = (detail.metadata as { runtimePatchAttempts: Array<Record<string, unknown>> }).runtimePatchAttempts;
    attempts[0] = { kind: "temporary_target_override", proposalOnly: true, executed: false, preflightOk: false, issues: ["Target override is absent from current sanitized evidence: PRIVATE-ISSUE"], targetOverrideRefusal: refusal, traceStatus: "not-run" };
    return detail;
  };
  const { control, serve } = await core(t);
  const codesFor = async (refusal: unknown) => {
    serve(refused(refusal));
    return (await run(control)).harnessRecovery.runtimePatchAttempts[0]?.issueCodes;
  };
  assert.deepEqual(await codesFor({ status: "absent", reason: "action_not_repairable" }), ["runtime_patch.target_override_rejected", "runtime_patch.target_override_rejected.action_not_repairable"]);
  assert.deepEqual(await codesFor({ status: "ambiguous", reason: "handle_not_issued" }), ["runtime_patch.target_override_rejected", "runtime_patch.target_override_rejected.handle_not_issued"]);
  // No reason: the domain's status is the case.
  assert.deepEqual(await codesFor({ status: "absent" }), ["runtime_patch.target_override_rejected", "runtime_patch.target_override_rejected.absent"]);
  // Anything that is not one of Core's words adds nothing, and nothing of it travels.
  for (const malformed of [{ status: "absent", reason: "PRIVATE-PAGE-TEXT with spaces" }, { status: "PRIVATE-PAGE-TEXT" }, "PRIVATE-PAGE-TEXT", null]) {
    const codes = await codesFor(malformed);
    assert.deepEqual(codes, ["runtime_patch.target_override_rejected"], JSON.stringify(malformed));
  }
  serve(refused({ status: "absent", reason: "action_not_repairable" }));
  const outcome = await run(control);
  assert.deepEqual(validateRunHarnessRecovery(outcome.harnessRecovery), { valid: true, value: outcome.harnessRecovery });
  assert.equal(JSON.stringify(snapshotOf(outcome)).includes("PRIVATE"), false);
});

test("a recovery the parser admits but the contract refuses fails before it reaches the bundle", async () => {
  // The parser's kinds and codes are closed today; this pins what happens if the two ever drift apart.
  const control = {
    selectExistingContext: async () => {},
    startPersistedFlow: async () => ({ runId: "run.one" }),
    runPersistedFlow: async () => ({ session: { runId: "run.one", status: "succeeded" } }),
    automationStudioCall: async () => ({ runDetail: { summary: { runId: "run.one", status: "succeeded" }, actionAttempts: [attempt], interventions: [{}] } }),
    getRunDetail: async () => ({ interventions: [{ interventionId: "one", kind: "diagnosis" as const, validationCodes: ["Not A Code"] }] }),
  } satisfies PersistedFlowRunControl;
  await assert.rejects(
    () => run(control),
    (error: unknown) => error instanceof RunnerFailure
      && error.message.includes("harnessRecovery.interventions[0].validationCodes[0]")
      && !error.message.includes("Not A Code"),
  );
});

// A failed run whose recovery never started used to read exactly like a run
// that needed none: `attempted: false` and nothing else. Core's gate says why at
// each early return (`annotate.ts`), as a sentence and as a code; the record
// keeps the code, which the contract checks is a code, and never the sentence.
test("a recovery Core's gate refused says why, by the gate's code and never its sentence", async (t) => {
  const refused = (gate: Record<string, unknown>) => () => ({ summary: { ...summary, status: "failed", interventionCount: 0, adaptationCount: 0 }, routeDecisions: [], subflows: [], actionAttempts: [attempt], interventions: [], metadata: { llmGate: gate } });
  const { control, calls, serve } = await core(t);
  for (const code of ["llm.gate.training_mode", "llm.gate.training_budget_exhausted", "llm.gate.manual_intervention"]) {
    serve(refused({ invoked: false, code, reason: "PRIVATE-ISSUE: Core's sentence for why" }));
    const outcome = await run(control);
    assert.deepEqual(outcome.harnessRecovery, { ...NO_RECOVERY, refusalCode: code, refusalRung: "gate" }, code);
    assert.deepEqual(calls, ["select", "start", "run", "get-flow-run-detail"], `${code}: a refused recovery costs no second read`);
    assert.equal(JSON.stringify(snapshotOf(outcome).harnessRecovery).includes("PRIVATE-ISSUE"), false, `${code}: the sentence stays behind`);
    assert.deepEqual(validateRunHarnessRecovery(outcome.harnessRecovery), { valid: true, value: outcome.harnessRecovery });
  }
  // A gate that ran the model states no refusal, whatever else it recorded.
  serve(refused({ invoked: true, code: "llm.gate.training_mode" }));
  assert.equal((await run(control)).harnessRecovery?.refusalCode, null);
  // A sentence where the code belongs fails the read by its path.
  serve(refused({ invoked: false, code: "Current training mode or settings do not allow LLM intervention." }));
  await assert.rejects(run(control), (error: unknown) => error instanceof RunnerFailure && error.message.includes("harnessRecovery.refusalCode"));
});

// A repair the recovery's permission gate held back (Week 2 exit, L5): the
// patch call was made, the model wrote a repair that would lastingly act, and
// nobody had allowed its classes. It was read as `runtime_patch.preflight_rejected`
// and the gate's code, classes and the request itself were dropped, so a live
// proof had to read Core's store. They travel now, each through the reader
// that owns its shape.
test("a repair held for permission carries the gate's outcome, its codes and the request Core built", async (t) => {
  const REQUEST = {
    schemaVersion: "automation-studio.action-permission-request.v1",
    requestId: "permission-request:repair",
    requestedAtMs: 1_300,
    action: { kind: "flow_step", id: "builtin.policy.action", ref: "node.one", verb: "press" },
    control: { name: "Add to queue", kind: "button" },
    consequences: ["send_or_publish", "create_new"],
    missing: ["send_or_publish", "create_new"],
    reason: { stage: "recovery", instructionIds: [] },
    authority: { granted: [], instructed: [] },
    sentence: "To repair the step that failed, the Flow would press \"Add to queue\" (button) each time it runs, which would send or publish something that others will receive or see and create something new that stays. Neither its instruction nor a grant allows that, so the repair stopped to ask."
  };
  const held = (request: unknown) => () => ({
    summary: { ...summary, status: "failed", interventionCount: 2, adaptationCount: 0 }, routeDecisions: [], subflows: [], actionAttempts: [attempt],
    interventions: [
      { interventionId: "intervention.diagnosis", kind: "diagnosis", validation: { ok: true, issues: [] }, createdAt: 1_100 },
      { interventionId: "intervention.patch", kind: "runtime_patch", validation: { ok: true, issues: [] }, createdAt: 1_200 },
    ],
    metadata: {
      llmGate: { invoked: true, ok: true, patchHeldCode: "llm.runtime_patch_permission_required", permissions: { granted: [], instructed: [], lapsed: [] } },
      permissionRequest: request,
      runtimePatchAttempts: [{ kind: "temporary_target_override", executed: false, preflightOk: false, permissionOutcome: "required", permissionRequired: true, requestId: "permission-request:repair", missing: ["send_or_publish", "create_new"], issues: [`Permission required: ${REQUEST.sentence}`], traceStatus: "not-run" }],
    },
  });
  const { control, serve } = await core(t);
  serve(held(REQUEST));
  const outcome = await run(control);
  assert.deepEqual(outcome.harnessRecovery?.runtimePatchAttempts, [
    { kind: "temporary_target_override", proposalOnly: null, executed: false, preflightOk: false, issueCodes: ["runtime_patch.permission_required"], adaptationCreated: false, changeProposalCreated: false, permissionOutcome: "required", permissionRequired: true },
  ]);
  assert.equal(validateRunHarnessRecovery(outcome.harnessRecovery).valid, true);
  // The evaluation carries closed words only: the control's name and Core's sentence stay behind.
  assert.equal(JSON.stringify(outcome.harnessRecovery).includes("Add to queue"), false);

  const detail = await control.getRunDetail("project.web", "run.one") as unknown as ExistingRunDetail;
  assert.deepEqual(detail.llmGate, { invoked: true, patchHeldCode: "llm.runtime_patch_permission_required", permissions: { granted: [], instructed: [], lapsed: [] } });
  assert.deepEqual(detail.permissionRequest, REQUEST);

  // A request Core's own parser refuses fails the read by its path rather than travelling half-read.
  serve(held({ ...REQUEST, control: { name: "<b>Add</b>", kind: "button" } }));
  await assert.rejects(control.getRunDetail("project.web", "run.one"), (error: unknown) => error instanceof RunnerFailure && error.message.includes("runDetail.metadata.permissionRequest"));
});

// A model that answers "there is nothing to repair" leaves Core's declined
// receipt: `kind: "no_repair"`, a closed `declinedReason`, and Core's sentence as
// its issue. It was read as `runtime_patch.preflight_rejected` -- Core refusing
// a repair the model proposed -- which is the opposite of what happened.
test("a repair the model declined reads as a decline with its reason, never as a preflight rejection", async (t) => {
  const declined = (declinedReason: unknown) => () => ({
    summary: { ...summary, status: "failed", interventionCount: 2, adaptationCount: 0 }, routeDecisions: [], subflows: [], actionAttempts: [attempt],
    interventions: [
      { interventionId: "intervention.diagnosis", kind: "diagnosis", validation: { ok: true, issues: [] }, createdAt: 1_100 },
      { interventionId: "intervention.patch", kind: "runtime_patch", validation: { ok: true, issues: [] }, createdAt: 1_200 },
    ],
    metadata: { runtimePatchAttempts: [{ kind: "no_repair", executed: false, preflightOk: false, declinedReason, issues: ["The model was asked for a repair and declined: what the step acted on is gone, and nothing takes its place (control_gone)."], traceStatus: "not-run" }] },
  });
  const { control, serve } = await core(t);
  serve(declined("control_gone"));
  const outcome = await run(control);
  assert.deepEqual(outcome.harnessRecovery?.runtimePatchAttempts, [
    { kind: "no_repair", proposalOnly: null, executed: false, preflightOk: false, issueCodes: ["runtime_patch.declined.control_gone"], adaptationCreated: false, changeProposalCreated: false },
  ]);
  assert.equal(outcome.harnessRecovery?.attempted, true, "the model was asked, so recovery was attempted");
  assert.equal(JSON.stringify(outcome.harnessRecovery).includes("nothing takes its place"), false, "Core's sentence stays behind");
  // A reason that is not one of Core's words still reads as a decline, and carries nothing of itself.
  serve(declined("Nothing Here Could Be Repaired"));
  assert.deepEqual((await run(control)).harnessRecovery?.runtimePatchAttempts[0]?.issueCodes, ["runtime_patch.declined"]);
});

// The silence of live run `run-muesyox4-930bef98` (2026-09-23). Its Flow failed
// on `target_not_found`, Core's recovery engaged, two diagnosis interventions
// were filed and the second validated -- and then no patch was attempted, no
// adaptation or proposal was recorded, and `refusalCode` was `null`, because
// the reader computed it only for a recovery that never started. A loop that
// engaged and declined was therefore indistinguishable from one switched off.
// Core stated its reason all along, in `llmGate.patchSkippedCode`; nothing read
// it. The mutation this is written against: making the refusal conditional on
// `attempted` again, or dropping the rung.
test("a recovery that engaged and then repaired nothing states the rung that declined and why", async (t) => {
  const engaged = (gate: Record<string, unknown>) => () => ({
    summary: { ...summary, status: "failed", interventionCount: 2, adaptationCount: 0 }, routeDecisions: [], subflows: [], actionAttempts: [attempt],
    interventions: [
      // The ladder's own rung, recorded by the executor and answered by nobody.
      { interventionId: "attempt.one.recovery.diagnosis", kind: "diagnosis", validation: { ok: false, issues: ["recovery.ladder_diagnosis_unanswered: PRIVATE-ISSUE about the rung"] }, createdAt: 1_050 },
      { interventionId: "intervention.diagnosis", kind: "diagnosis", validation: { ok: true, issues: [] }, createdAt: 1_100 },
    ],
    adaptationIds: [], changeProposalIds: [],
    metadata: { llmGate: gate },
  });
  const { control, serve } = await core(t);
  const cases = [
    [{ invoked: true, patchSkippedCode: "llm.runtime_patch_goal_unachievable", patchSkippedRung: "plan", patchSkipped: "PRIVATE-ISSUE: Core's sentence for why" }, "llm.runtime_patch_goal_unachievable", "plan"],
    [{ invoked: true, patchSkippedCode: "llm.runtime_patch_policy_allows_no_kind", patchSkippedRung: "plan" }, "llm.runtime_patch_policy_allows_no_kind", "plan"],
    [{ invoked: true, patchSkippedCode: "llm.runtime_patch_permission_required", patchSkippedRung: "exploration" }, "llm.runtime_patch_permission_required", "exploration"],
    // An older Core names the reason and no rung: stated, unattributed.
    [{ invoked: true, patchSkippedCode: "llm.runtime_patch_not_requested" }, "llm.runtime_patch_not_requested", null],
    // A rung word Core does not own is not carried into the bundle.
    [{ invoked: true, patchSkippedCode: "llm.runtime_patch_not_requested", patchSkippedRung: "PRIVATE-ISSUE" }, "llm.runtime_patch_not_requested", null],
  ] as const;
  for (const [gate, refusalCode, refusalRung] of cases) {
    serve(engaged(gate));
    const outcome = await run(control);
    assert.equal(outcome.harnessRecovery?.attempted, true, refusalCode);
    assert.deepEqual(outcome.harnessRecovery?.runtimePatchAttempts, [], refusalCode);
    assert.equal(outcome.harnessRecovery?.refusalCode, refusalCode, refusalCode);
    assert.equal(outcome.harnessRecovery?.refusalRung, refusalRung, refusalCode);
    // The ladder's intervention now reduces to a code, where it once reduced to nothing.
    assert.deepEqual(outcome.harnessRecovery?.interventions, [
      { kind: "diagnosis", validationOk: false, validationCodes: ["recovery.ladder_diagnosis_unanswered"] },
      { kind: "diagnosis", validationOk: true, validationCodes: [] },
    ], refusalCode);
    assert.deepEqual(validateRunHarnessRecovery(outcome.harnessRecovery), { valid: true, value: outcome.harnessRecovery }, refusalCode);
    const snapshot = JSON.stringify(snapshotOf(outcome).harnessRecovery);
    assert.equal(snapshot.includes("PRIVATE"), false, `${refusalCode}: Core's sentence stays behind`);
  }
});
