import assert from "node:assert/strict";
import test from "node:test";
import { WEB_LLM_DENIED_EVIDENCE_KEYS } from "@fluxiq-web-extension/domain/node";
import { resolveScenarioWorkflow, validateAuthoredFlowNodes, type LlmActionConsequence, type ResolvedScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../../failure.js";
import type { DeclaredSecret } from "../../declared-secrets.js";
import type { PersistedFlowLlmExecution } from "../../persisted-flow-run.js";
import type { LabResetFetch } from "../../reset-scenario-lab.js";
import type { CreatedFlowBuild } from "../build-proposal.js";
import { runCreatedFlowLane, withSettledBuild, type CreatedFlowLaneEntry, type CreatedFlowLaneEvidence, type CreatedFlowLaneIncomplete, type CreatedFlowSettledBuild } from "../lane.js";
import { resolveCreatedFlowRequest, type CreatedFlowRequest } from "../request.js";
import type { UnheldFact } from "../final-state-facts.js";
import { createdFlowLaneSnapshot } from "../snapshot.js";
import { ADAPTATION_ID, EXTRACTING_NODES, FLOW_ID, PROJECT_ID, fakeCreationCore, type FakeCreationCoreOptions } from "./fake-creation-core.js";
import { permissionRequiredDiagnostic } from "./permission-required-diagnostic.js";
import { catalogScenario, datasetTask, goalTask } from "./scenario-fixture.js";

/**
 * The created-Flow lane end to end against a fake Core: a Flow is built from
 * an instruction, settled, applied, run and judged -- by its stored records
 * for a dataset task, by the fixture oracle for a goal task -- and each way it
 * can fail closed does so before the step it would otherwise corrupt.
 */

type LaneOptions = {
  request?: CreatedFlowRequest;
  workflow?: ResolvedScenarioWorkflow;
  finalStateHolds?: boolean;
  /** What the oracle names when the final state did not hold. */
  unheldFacts?: readonly UnheldFact[];
  secrets?: readonly DeclaredSecret[];
  /** The settlement's own work; what it answers replaces the build, as a live run's settlement does. */
  settle?: (build: CreatedFlowBuild) => Promise<CreatedFlowSettledBuild | void>;
  authorizeRun?: (flowId: string) => Promise<PersistedFlowLlmExecution>;
  settleRun?: (runId: string | undefined) => Promise<void>;
  /** What the operator permitted the build (`--llm-permit`). */
  permitted?: readonly LlmActionConsequence[];
  /** How the build starts; the direct build unless a test says otherwise. */
  entry?: CreatedFlowLaneEntry;
};

async function runLane(core: ReturnType<typeof fakeCreationCore>, options: LaneOptions = {}) {
  const request = options.request ?? resolveCreatedFlowRequest(catalogScenario, datasetTask());
  const workflow = options.workflow ?? resolveScenarioWorkflow(catalogScenario, { ...(request.workflowId === undefined ? {} : { workflowId: request.workflowId }), ...(request.variantId === undefined ? {} : { variantId: request.variantId }) });
  const settled: CreatedFlowBuild[] = [];
  const evidence: CreatedFlowLaneEvidence[] = [];
  const incomplete: CreatedFlowLaneIncomplete[] = [];
  const fetchLab: LabResetFetch = async (url) => { core.calls.push(`reset:${new URL(url).pathname}`); return { ok: true, status: 200 }; };
  const raw = runCreatedFlowLane({
    control: core.control,
    projectId: PROJECT_ID,
    authorizationPin: "test-pin",
    request,
    workflow,
    facilityRunId: "run-lab-1",
    scenarioOrigin: "http://127.0.0.1:4100",
    startLocation: "http://127.0.0.1:4100/scenarios/catalog/",
    runToken: "run-token",
    secrets: options.secrets ?? [],
    entry: options.entry ?? { kind: "direct-api" },
    authorizeBuild: async () => { core.calls.push("authorize"); return { permittedConsequences: options.permitted ?? [] }; },
    settleBuild: async (build) => {
      core.calls.push("settle");
      settled.push(build);
      return await options.settle?.(build) ?? { build, instructedConsequencesFrom: build.instructedConsequences === null ? null : "proposal" };
    },
    ...(options.authorizeRun ? { authorizeRun: options.authorizeRun } : {}),
    ...(options.settleRun ? { settleRun: options.settleRun } : {}),
    prepareFlowPage: async () => { core.calls.push("prepare"); },
    recordEvidence: async (published) => { core.calls.push("publish"); evidence.push(published); },
    recordIncompleteEvidence: async (published) => { core.calls.push("publish-incomplete"); incomplete.push(published); },
    judgeFinalState: async () => { core.calls.push("oracle"); return options.finalStateHolds ?? true ? { held: true, unheldFacts: [] } : { held: false, unheldFacts: options.unheldFacts ?? [] }; },
    fetchLab,
  });
  // Every test but the permission-point ones reads a lane that ran a Flow; a stop reaching them is a failure of its own.
  const run = raw.then((lane) => {
    if ("permissionStop" in lane) throw new Error("the lane stopped at a permission point instead of running a Flow");
    return lane;
  });
  void run.catch(() => undefined);
  return { raw, run, settled, evidence, incomplete };
}

test("a dataset task is built, settled, applied, run on a freshly presented page, and passes on the records it stored", async () => {
  const core = fakeCreationCore();
  const { run, settled, evidence } = await runLane(core);
  const outcome = await run;
  assert.deepEqual(core.calls, [
    "create-flow", "get-flow", "list-flow-subflows", "get-flow-router",
    "prepare",
    "save-flow-generation-instruction", "authorize", "select-context", "generate", "get-adaptation",
    "settle",
    "approve", "apply",
    "get-flow", "list-flow-subflows", "get-flow",
    "reset:/__control/reset", "prepare",
    "select-context", "start", "run", "get-flow-run-detail", "get-run-dataset-page",
    // Its workflow declares a final state, so the page is held to it as well as the records to theirs.
    "oracle",
    "publish",
  ]);
  assert.equal(settled.length, 1);
  assert.equal(settled[0]?.outcome, "proposed");
  assert.deepEqual(outcome.shape, { nodeCount: 3, actionNodeCount: 2, actionTypes: { "web.browser.navigate": 1, "web.dom.extract_list": 1 }, extractNodes: 1, navigationNodes: 1 });
  assert.deepEqual(core.runInputs, [{ scenarioId: "product-catalog", facilityRunId: "run-lab-1" }]);
  assert.equal(outcome.observation.lane, "flow");
  assert.equal(outcome.observation.flowCreated, true);
  assert.equal(outcome.observation.oracleVerdict, "passed", "a dataset task's oracles are its records and its declared final state");
  assert.deepEqual(outcome.oracles, { records: "held", finalState: "held" });
  assert.equal(outcome.observation.reportedVerdict, "passed");
  assert.equal(outcome.observation.extraction?.length, 1);
  assert.equal(outcome.observation.extraction?.[0]?.status, "judged");
  assert.equal(outcome.observation.extraction?.[0]?.stepIndex, 1, "the measurement keeps the step's place in its workflow");
  assert.equal(outcome.observation.extraction?.[0]?.matchedRecords, 2);
  assert.deepEqual(evidence, [outcome]);
  assert.equal(core.calls.filter((call) => call === "oracle").length, 1, "a dataset task whose workflow declares a final state consults the page oracle once");

  assert.deepEqual(outcome.ownPage, { required: false, navigationNodes: 1, reached: true }, "an extract task works on the page it was given");

  const snapshot = createdFlowLaneSnapshot(outcome);
  assert.equal(snapshot.lane, "created-flow");
  assert.deepEqual(snapshot.ownPage, { required: false, navigationNodes: 1, reached: true });
  assert.deepEqual(snapshot.recoveredFailures, [], "a run that absorbed nothing says so, rather than leaving the field out");
  assert.equal(snapshot.flowId, FLOW_ID);
  assert.deepEqual(snapshot.flowShape.actionTypes, { "web.browser.navigate": 1, "web.dom.extract_list": 1 });
  // The shape's counts, and beside them what each counted node was told to do.
  // Six live `product-catalog` runs failed with `expectedRecords 8,
  // observedRecords 23` and could not be diagnosed, because the counts were
  // all a bundle held: nothing said whether the extraction had been authored to
  // paginate. The extraction's selector is withheld by name, its column id
  // keeps its place with `null`, and the navigation's URL is carried as its
  // origin alone.
  assert.deepEqual(snapshot.authoredNodes, [
    { nodeId: "node.open", definitionId: "web.output.browser-navigate", outputId: "web.browser.navigate", parameters: { url: "http://127.0.0.1" }, parametersWithheld: ["url"] },
    { nodeId: "node.extract", definitionId: "web.output.dom-extract_list", outputId: "web.dom.extract_list", parameters: { fields: { name: null } }, parametersWithheld: ["selector", "fields.name"] },
  ]);
  assert.deepEqual(validateAuthoredFlowNodes(snapshot.authoredNodes, WEB_LLM_DENIED_EVIDENCE_KEYS), { valid: true, value: snapshot.authoredNodes });
  assert.deepEqual(snapshot.actions.map((action) => action.actionType), ["web.browser.navigate", "web.dom.extract_list"]);
  assert.equal(snapshot.extraction?.steps[0]?.matchedRecords, 2);
  const text = JSON.stringify(snapshot);
  // The fixture's selector, the instruction, and a record the page held. The
  // loopback host left this list when `authoredNodes` arrived: a navigation
  // parameter is now carried as its origin, deliberately and by Core's own
  // rule, because where a step was pointed is a fact about the Flow. What must
  // still never appear is the rest of that URL -- the path and the query are
  // where a page number, a search term and a session token live, and reading a
  // Flow's page number out of a bundle is half of what this member exists for.
  for (const leak of ["data-testid", "Scrape the first page", "Lamp", "/scenarios/", "product-catalog/"]) assert.equal(text.includes(leak), false, `the snapshot carries ${leak}`);
});

test("a dataset task whose Flow stored the wrong records fails, after publishing what it measured", async () => {
  const core = fakeCreationCore({ datasets: [{ datasetId: "dataset.one", nodeIds: ["node.extract"], rows: [{ name: "Lamp", price: "$10" }] }] });
  const { run, evidence } = await runLane(core);
  await assert.rejects(run, (error: unknown) => error instanceof RunnerFailure && error.category === "runtime.behavior" && /Extract step extract-page-one yielded 1 record\(s\), expected 2/u.test(error.message));
  assert.equal(evidence.length, 1);
  assert.equal(evidence[0]?.observation.oracleVerdict, "failed");
  assert.equal(evidence[0]?.observation.extraction?.[0]?.observedRecords, 1);
});

test("a dataset task whose Flow has no extract node fails as exactly that", async () => {
  const core = fakeCreationCore({ graphNodes: EXTRACTING_NODES.slice(0, 2), attempts: [{ nodeId: "node.open", status: "succeeded" }], datasets: [] });
  const { run, evidence } = await runLane(core);
  await assert.rejects(run, (error: unknown) => error instanceof RunnerFailure && error.category === "runtime.behavior" && /The created Flow has no extract node, so it could not collect the records the task asks for/u.test(error.message));
  assert.equal(evidence[0]?.observation.extraction?.[0]?.status, "not_run");
});

/**
 * `run-mudwci8d-de88aa32`, 2026-09-23. The lane resets the fixture and then
 * called `prepareFlowPage("playback")`, which loaded the scenario's start page
 * before the Flow ran -- so a Flow with no navigation node played back as
 * though it had one. This run's records were right and it still cannot reach
 * the page they came from, which is the point: the harness's page is not the
 * Flow's achievement. t101 stopped the harness loading it for such a task
 * (`lane-rules/flow-start-page.ts`); this judgement stays, because it must hold
 * whatever the caller's hook does.
 */
test("a navigate-and-extract Flow that holds no navigation node fails on that, ahead of what its records said", async () => {
  const core = fakeCreationCore({ graphNodes: [EXTRACTING_NODES[0], EXTRACTING_NODES[2]], attempts: [{ nodeId: "node.extract", status: "succeeded" }] });
  const request = resolveCreatedFlowRequest(catalogScenario, datasetTask({ kind: "navigate-and-extract" }));
  const { run, evidence } = await runLane(core, { request });
  await assert.rejects(run, (error: unknown) => error instanceof RunnerFailure
    && error.category === "runtime.behavior"
    && /holds no node that reaches its own page/u.test(error.message)
    && error.details?.code === "flow_lane.flow_does_not_reach_its_page");
  // Published first, as every judgement here is: the run states what it did.
  assert.equal(evidence.length, 1);
  assert.deepEqual(evidence[0]?.ownPage, { required: true, navigationNodes: 0, reached: false });
  assert.deepEqual(createdFlowLaneSnapshot(evidence[0]!).ownPage, { required: true, navigationNodes: 0, reached: false });
  // Its records matched, and that is not the same as the Flow having worked.
  assert.equal(evidence[0]?.observation.extraction?.[0]?.matchedRecords, 2);
  assert.equal(evidence[0]?.observation.oracleVerdict, "passed");
});

test("a goal task is judged by the fixture oracle, and fails when the goal did not hold", async () => {
  const request = resolveCreatedFlowRequest(catalogScenario, goalTask());
  const held = await runLane(fakeCreationCore(), { request });
  const outcome = await held.run;
  assert.equal(outcome.extraction, null);
  assert.deepEqual(outcome.observation.extraction, []);
  assert.equal(outcome.observation.oracleVerdict, "passed");
  const core = fakeCreationCore();
  const missed = await runLane(core, { request, finalStateHolds: false });
  await assert.rejects(missed.run, /The created Flow ran, but the scenario's playback goal did not hold afterwards/u);
  assert.equal(missed.evidence[0]?.observation.oracleVerdict, "failed");
  assert.ok(core.calls.indexOf("oracle") < core.calls.indexOf("publish"), "the oracle is consulted before the run is published");
});

// run-muqiho5c-e830ce01: a playback whose goal did not hold was reported as
// "step unknown", though the goal is a list of concrete facts. The failure now
// names each fact, and its details carry what each expected and what the page showed.
test("a goal task whose goal did not hold names each fact that did not, with its expected and observed value", async () => {
  const unheldFacts: UnheldFact[] = [
    { factId: "cart-line", subject: "mini-cart-line", predicate: "text", expected: "Voltbay hub x3", observed: null },
    { factId: "coupons-held", subject: "coupon-wallet", predicate: "contains", expected: "OFFICIAL5", observed: "" },
  ];
  const missed = await runLane(fakeCreationCore(), { request: resolveCreatedFlowRequest(catalogScenario, goalTask()), finalStateHolds: false, unheldFacts });
  await assert.rejects(missed.run, (error: unknown) => error instanceof RunnerFailure
    && error.message === "The created Flow ran, but the scenario's playback goal did not hold afterwards (facts not held: cart-line, coupons-held)"
    && JSON.stringify(error.details?.oracles) === JSON.stringify({ records: "not_declared", finalState: "failed", unheldFacts }));
  assert.deepEqual(createdFlowLaneSnapshot(missed.evidence[0]!).oracles, { records: "not_declared", finalState: "failed", unheldFacts });
});

test("a refused build is settled, then fails the run with Core's code, and nothing is applied", async () => {
  const diagnostic = { code: "flow_bootstrap.evidence_repeat_without_progress", stage: "provider_output_validation", retryable: false, providerInvocation: "attempted", providerResponse: "received", evidenceLoop: { iterationCount: 3, decisionCount: 2, toolCallCount: 2, evidenceBytes: 400 } };
  const core = fakeCreationCore({ generation: { kind: "refused", status: 400, payload: { diagnostic } } });
  const { run, settled } = await runLane(core);
  await assert.rejects(run, (error: unknown) => error instanceof RunnerFailure && error.category === "runtime.behavior" && /FluxIQ did not build a Flow from the task's instruction \(flow_bootstrap\.evidence_repeat_without_progress\)/u.test(error.message));
  assert.equal(settled[0]?.outcome, "failed");
  for (const step of ["approve", "apply", "start", "publish"]) assert.equal(core.calls.includes(step), false, `${step} ran after a refused build`);
});

test("a build that stopped to ask a person reports permission.required with the missing classes, and nothing is applied", async () => {
  const core = fakeCreationCore({ generation: { kind: "refused", status: 400, payload: { diagnostic: await permissionRequiredDiagnostic() } } });
  const { run, settled } = await runLane(core);
  await assert.rejects(run, (error: unknown) => error instanceof RunnerFailure && error.category === "runtime.behavior"
    && /FluxIQ asked for permission before building a Flow from the task's instruction \(permission\.required: delete\)/u.test(error.message)
    && !/generation_http/u.test(error.message)
    && (error.details?.outcome === "permission.required")
    && JSON.stringify(error.details?.missing) === JSON.stringify(["delete"])
    // Codes only: the control's name stays on the build record.
    && !JSON.stringify(error.details).includes("Delete post"));
  // The build is settled -- what it spent is published -- before the lane stops.
  assert.equal(settled[0]?.outcome, "permission_required");
  assert.deepEqual(settled[0]?.permissionRequest?.missing, ["delete"]);
  for (const step of ["approve", "apply", "start", "publish"]) assert.equal(core.calls.includes(step), false, `${step} ran after a build that asked for permission`);
});

test("a settlement that refuses -- no provider reached, or a budget breached -- stops the lane before anything is applied", async () => {
  const core = fakeCreationCore();
  const refusal = new RunnerFailure("runtime.behavior", "Live LLM run reached no provider");
  const { run } = await runLane(core, { settle: async () => { throw refusal; } });
  await assert.rejects(run, (error: unknown) => error === refusal);
  assert.equal(core.calls.includes("approve"), false);
});

test("a created Flow's secret request is answered by the declared secret, and one that does not pair fails before the run", async () => {
  const secret: DeclaredSecret = { id: "catalog-password", step: "enter-password", value: "s3cret-created-flow-value" };
  const typing = { id: "node.password", definitionId: "web.output.dom-type", parameterValues: { selector: "[data-testid=\"password\"]", text: { $state: { path: "web.secret.password" } } }, metadata: { outputActionId: "web.dom.type" } };
  const request = resolveCreatedFlowRequest(catalogScenario, goalTask());
  const answered = fakeCreationCore({ graphNodes: [...EXTRACTING_NODES, typing] });
  const outcome = await (await runLane(answered, { request, secrets: [secret] })).run;
  assert.deepEqual(answered.runInputs, [{ "web.secret.password": secret.value, scenarioId: "product-catalog", facilityRunId: "run-lab-1" }]);
  assert.equal(JSON.stringify(createdFlowLaneSnapshot(outcome)).includes(secret.value), false);

  const cases: Array<[FakeCreationCoreOptions, RegExp]> = [
    // The node names the control some other way than the declaration can prove.
    [{ graphNodes: [...EXTRACTING_NODES, { ...typing, parameterValues: { ...typing.parameterValues, selector: "#password" } }] }, /could not be given its secret values.*do not pair one-to-one/u],
    // The Flow never asked for the declared secret.
    [{}, /could not be given its secret values.*catalog-password for the step enter-password \(paired with 0 requests\)/u],
  ];
  for (const [options, message] of cases) {
    const core = fakeCreationCore(options);
    const { run } = await runLane(core, { request, secrets: [secret] });
    await assert.rejects(run, (error: unknown) => error instanceof RunnerFailure && error.category === "runtime.behavior" && message.test(error.message) && !error.message.includes(secret.value));
    assert.equal(core.calls.includes("start"), false);
  }
  // A Flow asking for a secret nothing declares fails the same way.
  const undeclared = fakeCreationCore({ graphNodes: [...EXTRACTING_NODES, typing] });
  await assert.rejects((await runLane(undeclared, { request })).run, /could not be given its secret values/u);
  // A Flow asking for a file is refused outright.
  const uploading = fakeCreationCore({ graphNodes: [...EXTRACTING_NODES, { id: "node.upload", definitionId: "web.output.dom-upload", parameterValues: { selector: "#file", upload: { $state: { path: "web.upload.file" } } }, metadata: { outputActionId: "web.dom.upload" } }] });
  await assert.rejects((await runLane(uploading, { request })).run, /asks the run for files on 1 node\(s\)/u);
});

test("the lane refuses what it cannot build or run honestly, before the step it would corrupt", async () => {
  // A workflow other than the one the task resolved to.
  const mismatched = fakeCreationCore();
  const request = resolveCreatedFlowRequest(catalogScenario, datasetTask({ variantId: "text-variant" }));
  await assert.rejects((await runLane(mismatched, { request, workflow: resolveScenarioWorkflow(catalogScenario) })).run, /handed a workflow other than the one its task resolved to/u);
  assert.deepEqual(mismatched.calls, []);
  // A new Flow Core did not leave blank.
  const seeded = fakeCreationCore({ blankFlow: { flowId: FLOW_ID, nodes: [{ id: "node.seed" }], edges: [] } });
  await assert.rejects((await runLane(seeded)).run, /Core created a Flow a live build cannot fill: it is not an empty orchestration Flow/u);
  assert.equal(seeded.calls.includes("authorize"), false);
  // A created Flow with no node that dispatches anything.
  const inert = fakeCreationCore({ graphNodes: [EXTRACTING_NODES[0]] });
  await assert.rejects((await runLane(inert)).run, /The created Flow has no node that dispatches a web action/u);
  assert.equal(inert.calls.includes("start"), false);
  // An apply that changed nothing.
  const unchanged = fakeCreationCore({ appliedMutationCount: 0 });
  await assert.rejects((await runLane(unchanged)).run, /reported no change to the Flow/u);
  // Nothing is read or run after an apply that changed nothing; the lane writes down what it knew and stops there.
  assert.deepEqual(unchanged.calls.slice(-2), ["apply", "publish-incomplete"]);
});

// Readied for the model, the created Flow's playback is a live run: it starts
// its own session with its intent and permitted consequences, and what it spent is settled
// before anything is judged. Without it it is the deterministic run the first
// test pins, "start" and all, which is what keeps a replay exactly as it was.
test("a created Flow's playback runs with the intent it was given, and its spend is settled before anything is judged", async () => {
  const core = fakeCreationCore();
  const sent: unknown[] = [];
  const named: string[] = [];
  const call = core.control.automationStudioCall.bind(core.control);
  // A live run is its own session, under an id the runner names first (`runLiveFlow`).
  core.control.automationStudioCall = async (endpoint, payload, ...rest) => {
    // The fake's reads describe `run.created`; served here as the run the runner named.
    if (endpoint !== "run-runtime-session") {
      const answer = await call(endpoint, payload, ...rest);
      return named[0] ? JSON.parse(JSON.stringify(answer).replaceAll('"run.created"', JSON.stringify(named[0]))) : answer;
    }
    core.calls.push("run");
    sent.push({ intent: payload.runIntent, permittedConsequences: payload.permittedConsequences });
    named.push(String(payload.newRunId));
    return { runtimeSession: { runId: payload.newRunId, status: "succeeded", flowId: FLOW_ID } };
  };
  const settledRuns: Array<string | undefined> = [];
  const { run } = await runLane(core, {
    authorizeRun: async (flowId) => { core.calls.push(`authorize-run:${flowId}`); return { intent: "explore_and_adapt", permittedConsequences: ["create_new"] }; },
    settleRun: async (runId) => { core.calls.push("settle-run"); settledRuns.push(runId); },
  });
  await run;
  assert.deepEqual(sent, [{ intent: "explore_and_adapt", permittedConsequences: ["create_new"] }]);
  assert.deepEqual(settledRuns, named, "the repair is settled from the run it ran as");
  // Readied once the page is presented and immediately before the run; a live run starts no session of its own beforehand.
  assert.deepEqual(core.calls.slice(core.calls.indexOf("reset:/__control/reset")), [
    "reset:/__control/reset", "prepare", `authorize-run:${FLOW_ID}`, "select-context", "run", "get-flow-run-detail", "get-run-dataset-page", "settle-run", "oracle", "publish",
  ]);
});

test("a repair run that throws is still settled, and an overspend outranks the run's own failure", async () => {
  const failing = () => {
    const core = fakeCreationCore();
    const call = core.control.automationStudioCall.bind(core.control);
    core.control.automationStudioCall = async (endpoint, payload, ...rest) => {
      if (endpoint === "run-runtime-session") throw new Error("the run broke");
      return await call(endpoint, payload, ...rest);
    };
    return core;
  };
  const settledRuns: Array<string | undefined> = [];
  const ready = async (): Promise<PersistedFlowLlmExecution> => ({ intent: "explore_and_adapt", permittedConsequences: [] });
  const plain = await runLane(failing(), { authorizeRun: ready, settleRun: async (runId) => { settledRuns.push(runId); } });
  await assert.rejects(plain.run, /the run broke/u);
  assert.equal(settledRuns.length, 1);
  assert.equal(typeof settledRuns[0], "string", "the run was named before the call failed, so its spend is read from that run");
  const breach = new RunnerFailure("runtime.behavior", "the repair spent past its budget");
  const breached = await runLane(failing(), { authorizeRun: ready, settleRun: async () => { throw breach; } });
  await assert.rejects(breached.run, (error: unknown) => error === breach);
  const unwritable = await runLane(failing(), { authorizeRun: ready, settleRun: async () => { throw new Error("disk full"); } });
  await assert.rejects(unwritable.run, /the run broke/u, "a settlement that could not write its record does not hide why the lane failed");
});

/**
 * The runs that most need reading are the ones that stop before the judgement,
 * and until this they were the ones with nothing written down: `flow-lane.json`
 * was published from `recordEvidence` alone, which a failed build never
 * reaches. The failure itself is unchanged -- the artifact is added to the
 * run's record, not taken out of its verdict.
 */
test("a build that proposed no Flow is written down with what the lane knew, and still fails the run", async () => {
  const diagnostic = { code: "flow_bootstrap.evidence_repeat_without_progress", stage: "provider_output_validation", retryable: false, providerInvocation: "attempted", providerResponse: "received", evidenceLoop: { iterationCount: 3, decisionCount: 2, toolCallCount: 2, evidenceBytes: 400 } };
  const core = fakeCreationCore({ generation: { kind: "refused", status: 400, payload: { diagnostic } } });
  const { run, incomplete } = await runLane(core);
  await assert.rejects(run, (error: unknown) => error instanceof RunnerFailure && error.category === "runtime.behavior" && /FluxIQ did not build a Flow from the task's instruction/u.test(error.message));
  assert.equal(incomplete.length, 1);
  const written = incomplete[0]!;
  assert.equal(written.lane, "created-flow");
  assert.equal(written.complete, false);
  assert.equal(written.stoppedAt, "build");
  assert.equal(written.failure?.category, "runtime.behavior");
  assert.match(written.failure?.message ?? "", /FluxIQ did not build a Flow/u);
  assert.equal(written.flowId, FLOW_ID);
  assert.equal(written.task.taskId, "catalog-first-page");
  // The build's own record: its outcome, Core's code and what it spent, which is the whole of what a refused build can be diagnosed from.
  assert.equal(written.build?.outcome, "failed");
  assert.equal(written.build?.failure?.code, "flow_bootstrap.evidence_repeat_without_progress");
  // Nothing was built, so nothing is claimed about it.
  assert.deepEqual([written.review, written.flowShape, written.authoredNodes, written.ownPage, written.runtimeRunId, written.status, written.route], [null, null, null, null, null, null, null]);
  assert.deepEqual(written.actions, []);
  // The same screen the complete snapshot writes under: the instruction is counted and hashed, never quoted.
  assert.equal(JSON.stringify(written).includes("Scrape the first page"), false);
});

/**
 * `run-murdouox-c5294247` was typed into the chat and stopped at its build, and
 * its `flow-lane.json` could not say how it was started: only the complete
 * snapshot carried `buildEntry`. The incomplete one says it too, from the lane's
 * own entry, whether or not the build left a chat record.
 */
test("an incomplete snapshot says how the build was started, as the complete one does", async () => {
  const diagnostic = { code: "flow_bootstrap.evidence_repeat_without_progress", stage: "provider_output_validation", retryable: false, providerInvocation: "attempted", providerResponse: "received" };
  const direct = await runLane(fakeCreationCore({ generation: { kind: "refused", status: 400, payload: { diagnostic } } }));
  await assert.rejects(direct.run);
  assert.equal(direct.incomplete[0]?.buildEntry, "direct-api");

  // Typed into the chat, built, and then refused at its settlement: the build is held, and so is how it was started.
  const refused = new RunnerFailure("runtime.behavior", "Live LLM run reached no provider");
  const { core, entry } = chatCore();
  const chat = await runLane(core, { entry, settle: async () => { throw refused; } });
  await assert.rejects(chat.run, (error: unknown) => error === refused);
  assert.equal(chat.incomplete[0]?.stoppedAt, "build");
  assert.equal(chat.incomplete[0]?.buildEntry, "chat");
});

test("a settlement that refuses after the build still carries the build, and a failure after the publish leaves the complete snapshot alone", async () => {
  const refusal = new RunnerFailure("runtime.behavior", "Live LLM run reached no provider");
  const unsettled = await runLane(fakeCreationCore(), { settle: async () => { throw refusal; } });
  await assert.rejects(unsettled.run, (error: unknown) => error === refusal);
  assert.equal(unsettled.incomplete[0]?.stoppedAt, "build");
  assert.equal(unsettled.incomplete[0]?.build?.outcome, "proposed", "the build is held before it is settled, so the settlement's refusal does not lose it");

  const core = fakeCreationCore();
  const judged = await runLane(core, { request: resolveCreatedFlowRequest(catalogScenario, goalTask()), finalStateHolds: false });
  await assert.rejects(judged.run, /playback goal did not hold/u);
  assert.equal(judged.evidence.length, 1);
  assert.deepEqual(judged.incomplete, [], "the complete snapshot is already on disk and must not be overwritten by a partial one");
  assert.equal(core.calls.includes("publish-incomplete"), false);
});

// Lane t184: a dataset task was judged by its records alone, so a run that
// stored the right rows by the wrong route -- the soap deleted rather than
// saved for later -- passed. Both oracles now decide, and the failure says which.
test("a dataset task whose records are right but whose declared final state did not hold fails, naming the final state", async () => {
  const core = fakeCreationCore();
  const { run, evidence } = await runLane(core, { finalStateHolds: false });
  await assert.rejects(run, (error: unknown) => error instanceof RunnerFailure && error.category === "runtime.behavior"
    && /stored the expected records, but the scenario's final state did not hold afterwards/u.test(error.message)
    && JSON.stringify(error.details?.oracles) === JSON.stringify({ records: "held", finalState: "failed" }));
  assert.equal(evidence[0]?.observation.oracleVerdict, "failed");
  assert.deepEqual(evidence[0]?.oracles, { records: "held", finalState: "failed" });
  assert.deepEqual(createdFlowLaneSnapshot(evidence[0]!).oracles, { records: "held", finalState: "failed" });
});

test("a dataset task that fails both oracles names both, keeping the records' own account", async () => {
  const core = fakeCreationCore({ datasets: [{ datasetId: "dataset.one", nodeIds: ["node.extract"], rows: [{ name: "Lamp", price: "$10" }] }] });
  const { run } = await runLane(core, { finalStateHolds: false });
  await assert.rejects(run, (error: unknown) => error instanceof RunnerFailure
    && /Extract step extract-page-one yielded 1 record\(s\), expected 2.*; and the scenario's final state did not hold afterwards/su.test(error.message)
    && JSON.stringify(error.details?.oracles) === JSON.stringify({ records: "failed", finalState: "failed" }));
});

test("a dataset task whose workflow declares no final state is judged by its records alone, and the page oracle is not asked", async () => {
  const core = fakeCreationCore();
  const request = resolveCreatedFlowRequest(catalogScenario, datasetTask());
  const declared = resolveScenarioWorkflow(catalogScenario, {});
  const workflow = { ...declared, expected: { ...declared.expected, finalState: [] } };
  const { run } = await runLane(core, { request, workflow, finalStateHolds: false });
  assert.deepEqual((await run).oracles, { records: "held", finalState: "not_declared" });
  assert.equal(core.calls.includes("oracle"), false);
});

// A consequential task not permitted its act passes by stopping to ask
// at its declared point: the fixture's build asks for `delete` on "Delete post".
test("a build that stops to ask at the task's declared permission point is the pass: nothing is applied or run, and the stop is written down", async () => {
  const core = fakeCreationCore({ generation: { kind: "refused", status: 400, payload: { diagnostic: await permissionRequiredDiagnostic() } } });
  const request = resolveCreatedFlowRequest(catalogScenario, goalTask({ permissionPoint: { consequence: "delete", control: "Delete post" } }));
  const { raw, incomplete } = await runLane(core, { request });
  const outcome = await raw;
  assert.ok("permissionStop" in outcome);
  assert.deepEqual(outcome.permissionStop, { verdict: "at_declared_point", consequence: "delete", control: "matched" });
  for (const step of ["approve", "apply", "start", "run", "publish"]) assert.equal(core.calls.includes(step), false, `${step} ran after the build stopped where the task says it must`);
  assert.equal(incomplete.length, 1);
  assert.equal(incomplete[0]?.failure, null);
  assert.equal(incomplete[0]?.stoppedAt, "build");
  assert.deepEqual(incomplete[0]?.permissionStop, outcome.permissionStop);
});

test("a build that stops to ask about another control than the declared one fails, saying why it is not the declared stop", async () => {
  const core = fakeCreationCore({ generation: { kind: "refused", status: 400, payload: { diagnostic: await permissionRequiredDiagnostic() } } });
  const request = resolveCreatedFlowRequest(catalogScenario, goalTask({ permissionPoint: { consequence: "delete", control: "Move" } }));
  const { raw } = await runLane(core, { request });
  await assert.rejects(raw, (error: unknown) => error instanceof RunnerFailure && error.details?.outcome === "permission.required" && error.details?.permissionPoint === "control_differs");
});

// t184: `job-board-apply-quillmark-check-first` says to check before
// submitting, and the lane scored a run that submitted without asking as a pass
// on its record. The stop is that task's only passing ending.
test("a task that says to ask first fails when FluxIQ builds a Flow without asking, and nothing is applied", async () => {
  const core = fakeCreationCore();
  const request = resolveCreatedFlowRequest(catalogScenario, datasetTask({ permissionPoint: { consequence: "send_or_publish", control: "Submit application", askFirst: true } }));
  const { raw } = await runLane(core, { request });
  await assert.rejects(raw, (error: unknown) => error instanceof RunnerFailure && error.category === "runtime.behavior"
    && /says to ask before its lasting act, and FluxIQ built a Flow without asking/u.test(error.message) && error.details?.permissionPoint === "not_asked");
  for (const step of ["approve", "apply", "start", "run"]) assert.equal(core.calls.includes(step), false, `${step} ran for a Flow built without asking`);
});

test("a task that says to ask first passes on the stop at its point", async () => {
  const core = fakeCreationCore({ generation: { kind: "refused", status: 400, payload: { diagnostic: await permissionRequiredDiagnostic() } } });
  const request = resolveCreatedFlowRequest(catalogScenario, goalTask({ permissionPoint: { consequence: "delete", control: "Delete post", askFirst: true } }));
  const outcome = await (await runLane(core, { request })).raw;
  assert.ok("permissionStop" in outcome);
});

// L1: a consequential task not permitted its act gets a Flow one honest way.
// The build asks at the act, the person allows it there, and the build goes
// on; Core records the answer on the Flow's thread, which the lane reads back.
const DELETE_POST = { consequence: "delete", control: "Delete post" } as const;
const permissionAsk = (askId: string, answer: "grant" | "deny", control: string | null, missing = ["delete"]) => ({ askId, kind: "permission", status: "answered", answer: { kind: answer, value: null }, missing, control: { name: control, kind: "button" }, createdAt: 10 });

test("a consequential task whose build proposed a Flow with nobody allowing the act at its point fails as not asked, before anything is applied", async () => {
  const request = resolveCreatedFlowRequest(catalogScenario, goalTask({ permissionPoint: DELETE_POST }));
  const silent = fakeCreationCore();
  await assert.rejects((await runLane(silent, { request })).raw, (error: unknown) => error instanceof RunnerFailure && error.category === "runtime.behavior"
    && /without a person allowing it at the task's permission point/u.test(error.message) && error.details?.permissionPoint === "not_asked" && error.details?.consequence === "delete"
    && JSON.stringify(error.details?.permissionAsks) === "[]");
  for (const step of ["approve", "apply", "start", "run"]) assert.equal(silent.calls.includes(step), false, `${step} ran for a Flow nobody allowed`);

  // Asked about another control and refused, then granted a class the task's act is not: neither is the person allowing the act.
  const elsewhere = fakeCreationCore({ flowThreadAsks: [permissionAsk("request-move", "deny", "Move"), permissionAsk("request-new", "grant", "Delete post", ["create_new"])] });
  await assert.rejects((await runLane(elsewhere, { request })).raw, (error: unknown) => error instanceof RunnerFailure && error.details?.permissionPoint === "not_asked"
    && JSON.stringify(error.details?.permissionAsks) === JSON.stringify([
      { askId: "request-move", status: "answered", answer: "deny", verdict: "elsewhere", reason: "control_differs" },
      { askId: "request-new", status: "answered", answer: "grant", verdict: "elsewhere", reason: "class_not_missing" },
    ]));
  assert.equal(elsewhere.calls.includes("apply"), false);

  // Asked at the point and refused is no more a pass than never asking.
  const refused = fakeCreationCore({ flowThreadAsks: [permissionAsk("request-delete", "deny", "Delete post")] });
  await assert.rejects((await runLane(refused, { request })).raw, (error: unknown) => error instanceof RunnerFailure && error.details?.permissionPoint === "not_asked");

  // Allowed on a control Core left unnamed: nobody could tell that was the task's act (run-munzbfbj-2fb8947d asked for money on the cart page).
  const unnamed = fakeCreationCore({ flowThreadAsks: [permissionAsk("request-unnamed", "grant", null)] });
  await assert.rejects((await runLane(unnamed, { request })).raw, (error: unknown) => error instanceof RunnerFailure && error.details?.permissionPoint === "not_asked");
  assert.equal(unnamed.calls.includes("apply"), false);
});

test("a consequential task whose build was allowed its act at the point is applied, run and judged", async () => {
  const core = fakeCreationCore({ flowThreadAsks: [permissionAsk("request-delete", "grant", " delete POST ")] });
  const request = resolveCreatedFlowRequest(catalogScenario, goalTask({ permissionPoint: DELETE_POST }));
  const outcome = await (await runLane(core, { request })).run;
  assert.equal(outcome.observation.oracleVerdict, "passed");
  const readBack = core.calls.indexOf("get-conversation");
  assert.ok(readBack >= 0 && readBack < core.calls.indexOf("approve"), "the grant is read back from Core before the proposal is applied");
  assert.ok(core.calls.includes("run"));
});

test("a task whose act the operator permitted had nothing to ask, so no grant is required", async () => {
  const core = fakeCreationCore();
  const request = resolveCreatedFlowRequest(catalogScenario, goalTask({ permissionPoint: DELETE_POST }));
  const outcome = await (await runLane(core, { request, permitted: ["delete"] })).run;
  assert.equal(outcome.observation.oracleVerdict, "passed");
  assert.equal(core.calls.includes("list-conversations"), false);
});

/**
 * The chat entry, against the same fake Core with a chat in front of it: the
 * instruction is typed, Core's chat makes the Flow, builds it and applies its
 * own proposal, and the lane then reads, runs and judges that Flow exactly as
 * it does any other. The lane itself creates no Flow, calls no build endpoint
 * and approves nothing.
 */
test("a build started from the extension's chat runs and is judged like any other, and the lane builds and reviews nothing itself", async () => {
  const { core, entry, typed } = chatCore();
  const { run, settled } = await runLane(core, { entry });
  const outcome = await run;
  assert.deepEqual(typed, [resolveCreatedFlowRequest(catalogScenario, datasetTask()).task.instruction], "the task's own instruction, typed once");
  for (const call of ["create-flow", "save-flow-generation-instruction", "authorize", "generate", "approve", "apply"]) assert.equal(core.calls.includes(call), false, `the lane made no ${call} call of its own`);
  assert.deepEqual(core.calls.slice(0, 3), ["prepare", "authorize-chat", "select-context"], "the page is presented and the key installed before anything is typed");
  assert.equal(settled.length, 1);
  assert.equal(settled[0]?.chat?.ending, "created");
  assert.deepEqual(outcome.review, { adaptationId: ADAPTATION_ID, appliedMutationCount: 2 });
  assert.equal(outcome.observation.reportedVerdict, "passed");
  assert.equal(createdFlowLaneSnapshot(outcome).buildEntry, "chat");
});

/** A fake Core with a chat in front of it: the typed instruction makes, builds and applies the Flow, as Core's chat command does. */
function chatCore(): { core: ReturnType<typeof fakeCreationCore>; entry: CreatedFlowLaneEntry; typed: string[] } {
  const core = fakeCreationCore({ adaptationStatus: "applied" });
  const base = core.control;
  const turns: Array<Record<string, unknown>> = [];
  let made = false;
  const typed: string[] = [];
  core.control = {
    ...base,
    automationStudioCall: async (endpoint, payload, bounds, domainId) => {
      if (endpoint === "list-flows") { core.calls.push(endpoint); return { flows: made ? [{ flow: { flowId: FLOW_ID, metadata: {} } }] : [] }; }
      if (endpoint === "list-conversations") return { conversations: [{ conversationId: "conversation.chat", pendingAskCount: 0, subject: { kind: "project", id: PROJECT_ID } }] };
      if (endpoint === "get-conversation") return { conversation: { turns, hasMore: false } };
      return base.automationStudioCall(endpoint, payload, bounds, domainId);
    },
    listFlowAdaptations: async (projectId, flowId) => (made ? [{ adaptationId: ADAPTATION_ID, projectId, flowId, status: "applied" }] : []),
    getFlowAdaptation: async (projectId, flowId, adaptationId) => ({ ...await base.getFlowAdaptation(projectId, flowId, adaptationId), appliedMutationCount: 2 }),
  };
  const entry: CreatedFlowLaneEntry = {
    kind: "chat",
    authorizeChat: async () => { core.calls.push("authorize-chat"); },
    chat: {
      panelInput: "view-dom",
      type: async (text) => {
        typed.push(text);
        turns.push({ turnId: "t1", ordinal: 1, author: "person", text, ask: null, attachment: null });
        turns.push({ turnId: "t2", ordinal: 2, author: "automation", text: 'Doing "Create an automation here".', ask: null, attachment: null });
        // Core's own apply, made inside the chat's command, which the fake records as a call; it is not one the lane made.
        await base.applyFlowAdaptation({ projectId: PROJECT_ID, flowId: FLOW_ID, adaptationId: ADAPTATION_ID, authorizationPin: "" });
        core.calls.splice(core.calls.lastIndexOf("apply"), 1);
        made = true;
        turns.push({ turnId: "t3", ordinal: 3, author: "automation", text: 'Created the Flow "x".', ask: null, attachment: { kind: "panel-capability-result", ref: "flow.createHere" } });
      },
      shows: async () => "",
    },
    wait: { pollMs: 1 },
  };
  return { core, entry, typed };
}

/** `run-murzln6g-11debe1d`, `S/0015/decision.json`: the reading its build made before any page evidence. */
const MURZLN6G_READ = [
  { consequence: "modify_existing", quote: "Switch my pickup store to Millbrook Crossing Supercenter" },
  { consequence: "create_new", quote: "add two packs of the ValueRidge Essentials Select-A-Size Paper Towels in the 12 Double Rolls size and one pack of the ValueRidge Everyday Dinner Napkins in the 250 Count size to my cart, both for pickup" },
] as const;

// `run-murzln6g-11debe1d`: Core publishes a build's instructed consequences
// only on its proposal, so the build that left none read `null` in both
// snapshots. The live settlement now fills them from the step log, and the lane
// keeps the build the settlement answered with, so `flow-lane.json` carries
// the same record as `live-llm.json` rather than its own unsettled copy.
test("a build that left no proposal keeps the instructed consequences its settlement read, and where they came from", async () => {
  const diagnostic = { code: "flow_bootstrap.evidence_repeat_without_progress", stage: "provider_output_validation", retryable: false, providerInvocation: "attempted", providerResponse: "received" };
  const fromStepLog = async (build: CreatedFlowBuild): Promise<CreatedFlowSettledBuild> => ({ build: { ...build, instructedConsequences: MURZLN6G_READ }, instructedConsequencesFrom: "step_log" });
  const { run, settled, incomplete } = await runLane(fakeCreationCore({ generation: { kind: "refused", status: 400, payload: { diagnostic } } }), { settle: fromStepLog });
  await assert.rejects(run, /FluxIQ did not build a Flow/u);
  assert.equal(settled[0]?.instructedConsequences, null, "Core's record had none");
  assert.deepEqual(incomplete[0]?.build?.instructedConsequences, MURZLN6G_READ);
  assert.equal(incomplete[0]?.instructedConsequencesFrom, "step_log");

  // A settlement that refused answered nothing: the build is Core's own, and nothing is claimed about where its consequences came from.
  const refusal = new RunnerFailure("runtime.behavior", "Live LLM run reached no provider");
  const unsettled = await runLane(fakeCreationCore(), { settle: async () => { throw refusal; } });
  await assert.rejects(unsettled.run, (error: unknown) => error === refusal);
  assert.equal(unsettled.incomplete[0]?.instructedConsequencesFrom, null);
});

test("a chat build, and a direct build that proposed a Flow, are judged and published on the build their settlement answered with", async () => {
  const { core, entry } = chatCore();
  const chat = await runLane(core, { entry, settle: async (build) => ({ build: { ...build, instructedConsequences: MURZLN6G_READ }, instructedConsequencesFrom: "step_log" }) });
  const outcome = await chat.run;
  assert.deepEqual(outcome.build.instructedConsequences, MURZLN6G_READ);
  assert.deepEqual(createdFlowLaneSnapshot(outcome).build.instructedConsequences, MURZLN6G_READ);
  assert.equal(createdFlowLaneSnapshot(outcome).instructedConsequencesFrom, "step_log");

  const direct = await runLane(fakeCreationCore());
  const proposed = await direct.run;
  assert.equal(proposed.build, direct.settled[0], "a settlement that changed nothing hands back Core's own record");
  assert.equal(createdFlowLaneSnapshot(proposed).instructedConsequencesFrom, "proposal");
});

// The settlement that throws -- a Lab budget breach, a build that reached no
// provider -- ends the run that most needs reading. It had already filled the
// record from the step log and written it to live-llm.json, and it carries that
// answer on the error, so the incomplete flow-lane.json says the same.
test("a settlement that throws still hands the lane the build it filled from the step log, and the error is unchanged", async () => {
  const fromStepLog = (build: CreatedFlowBuild): CreatedFlowSettledBuild => ({ build: { ...build, instructedConsequences: MURZLN6G_READ }, instructedConsequencesFrom: "step_log" });
  const breach = (build: CreatedFlowBuild) => withSettledBuild(new RunnerFailure("performance.budget", "Live LLM run exceeded its budget", { details: { calls: 34 } }), fromStepLog(build));

  const diagnostic = { code: "flow_bootstrap.evidence_budget_exhausted", stage: "provider_output_validation", retryable: false, providerInvocation: "attempted", providerResponse: "received" };
  let thrown: unknown;
  const direct = await runLane(fakeCreationCore({ generation: { kind: "refused", status: 400, payload: { diagnostic } } }), { settle: async (build) => { thrown = breach(build); throw thrown; } });
  await assert.rejects(direct.run, (error: unknown) => error === thrown && error instanceof RunnerFailure && error.category === "performance.budget");
  assert.equal(direct.settled[0]?.instructedConsequences, null, "Core's record had none");
  assert.deepEqual(direct.incomplete[0]?.build?.instructedConsequences, MURZLN6G_READ);
  assert.equal(direct.incomplete[0]?.instructedConsequencesFrom, "step_log");
  assert.deepEqual(direct.incomplete[0]?.build?.failure, direct.settled[0]?.failure, "the rest of the record is Core's own");
  // The answer rides on the error unseen: nothing that serializes the failure writes it a second time.
  assert.equal(JSON.stringify(thrown).includes("Millbrook"), false);
  assert.deepEqual(Object.keys(thrown as object).includes("build"), false);

  // A chat build the settlement refused carries the filled record the same way.
  const { core, entry } = chatCore();
  const chat = await runLane(core, { entry, settle: async (build) => { throw withSettledBuild(new RunnerFailure("runtime.behavior", "Live LLM run reached no provider"), fromStepLog(build)); } });
  await assert.rejects(chat.run, /reached no provider/u);
  assert.deepEqual(chat.incomplete[0]?.build?.instructedConsequences, MURZLN6G_READ);
  assert.equal(chat.incomplete[0]?.instructedConsequencesFrom, "step_log");
});

test("created-lane snapshots preserve terminal evidence without copying Core's trace message", async () => {
  const core = fakeCreationCore();
  const original = core.control.automationStudioCall;
  core.control.automationStudioCall = async (...args) => {
    const payload = await original(...args);
    if (args[0] !== "get-flow-run-detail") return payload;
    const record = payload as { runDetail: Record<string, unknown> };
    return { ...record, runDetail: { ...record.runDetail, metadata: { currentNodeId: "node.extract", terminalFailureReason: "Run failed after recovery was selected.", message: "private recorded page text" } } };
  };
  const { run } = await runLane(core);
  const outcome = await run;
  const snapshot = createdFlowLaneSnapshot(outcome) as ReturnType<typeof createdFlowLaneSnapshot> & { terminalEvidence?: unknown };
  assert.equal(snapshot.status, "succeeded", "terminal evidence never overrides status or oracles");
  assert.equal(snapshot.oracleVerdict, "passed");
  assert.deepEqual(snapshot.terminalEvidence, { terminalFailureReason: "recovery.selected", currentNodeId: "node.extract", messagePresent: true });
  assert.equal(JSON.stringify(snapshot).includes("private recorded page text"), false);
});
