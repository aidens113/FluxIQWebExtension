import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow, type ResolvedScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../../failure.js";
import type { DeclaredSecret } from "../../declared-secrets.js";
import type { LabResetFetch } from "../../reset-scenario-lab.js";
import type { CreatedFlowBuild } from "../build-proposal.js";
import { runCreatedFlowLane, type CreatedFlowLaneEvidence } from "../lane.js";
import { resolveCreatedFlowRequest, type CreatedFlowRequest } from "../request.js";
import { createdFlowLaneSnapshot } from "../snapshot.js";
import { EXTRACTING_NODES, FLOW_ID, PROJECT_ID, fakeCreationCore, type FakeCreationCoreOptions } from "./fake-creation-core.js";
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
  secrets?: readonly DeclaredSecret[];
  settle?: (build: CreatedFlowBuild) => Promise<void>;
};

async function runLane(core: ReturnType<typeof fakeCreationCore>, options: LaneOptions = {}) {
  const request = options.request ?? resolveCreatedFlowRequest(catalogScenario, datasetTask());
  const workflow = options.workflow ?? resolveScenarioWorkflow(catalogScenario, { ...(request.workflowId === undefined ? {} : { workflowId: request.workflowId }), ...(request.variantId === undefined ? {} : { variantId: request.variantId }) });
  const settled: CreatedFlowBuild[] = [];
  const evidence: CreatedFlowLaneEvidence[] = [];
  const fetchLab: LabResetFetch = async (url) => { core.calls.push(`reset:${new URL(url).pathname}`); return { ok: true, status: 200 }; };
  const run = runCreatedFlowLane({
    control: core.control,
    projectId: PROJECT_ID,
    authorizationPin: "test-pin",
    request,
    workflow,
    facilityRunId: "run-lab-1",
    scenarioOrigin: "http://127.0.0.1:4100",
    runToken: "run-token",
    secrets: options.secrets ?? [],
    authorizeBuild: async () => { core.calls.push("authorize"); return { grantId: "llm-grant:build" }; },
    settleBuild: async (build) => { core.calls.push("settle"); settled.push(build); await options.settle?.(build); },
    prepareFlowPage: async () => { core.calls.push("prepare"); },
    recordEvidence: async (published) => { core.calls.push("publish"); evidence.push(published); },
    checkFinalState: async () => { core.calls.push("oracle"); return options.finalStateHolds ?? true; },
    fetchLab,
  });
  return { run, settled, evidence };
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
    "publish",
  ]);
  assert.equal(settled.length, 1);
  assert.equal(settled[0]?.outcome, "proposed");
  assert.deepEqual(outcome.shape, { nodeCount: 3, actionNodeCount: 2, actionTypes: { "web.browser.navigate": 1, "web.dom.extract_list": 1 }, extractNodes: 1, navigationNodes: 1 });
  assert.deepEqual(core.runInputs, [{ scenarioId: "product-catalog", facilityRunId: "run-lab-1" }]);
  assert.equal(outcome.observation.lane, "flow");
  assert.equal(outcome.observation.flowCreated, true);
  assert.equal(outcome.observation.oracleVerdict, "passed", "a dataset task's oracle is its records");
  assert.equal(outcome.observation.reportedVerdict, "passed");
  assert.equal(outcome.observation.extraction?.length, 1);
  assert.equal(outcome.observation.extraction?.[0]?.status, "judged");
  assert.equal(outcome.observation.extraction?.[0]?.stepIndex, 1, "the measurement keeps the step's place in its workflow");
  assert.equal(outcome.observation.extraction?.[0]?.matchedRecords, 2);
  assert.deepEqual(evidence, [outcome]);
  assert.equal(core.calls.includes("oracle"), false, "a dataset task does not consult the page oracle");

  const snapshot = createdFlowLaneSnapshot(outcome);
  assert.equal(snapshot.lane, "created-flow");
  assert.equal(snapshot.flowId, FLOW_ID);
  assert.deepEqual(snapshot.flowShape.actionTypes, { "web.browser.navigate": 1, "web.dom.extract_list": 1 });
  assert.deepEqual(snapshot.actions.map((action) => action.actionType), ["web.browser.navigate", "web.dom.extract_list"]);
  assert.equal(snapshot.extraction?.steps[0]?.matchedRecords, 2);
  const text = JSON.stringify(snapshot);
  for (const leak of ["data-testid", "Scrape the first page", "Lamp", "127.0.0.1"]) assert.equal(text.includes(leak), false, `the snapshot carries ${leak}`);
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

test("a refused build is settled, then fails the run with Core's code, and nothing is applied", async () => {
  const diagnostic = { code: "flow_bootstrap.evidence_repeat_without_progress", stage: "provider_output_validation", retryable: false, providerInvocation: "attempted", providerResponse: "received", evidenceLoop: { iterationCount: 3, decisionCount: 2, toolCallCount: 2, evidenceBytes: 400 } };
  const core = fakeCreationCore({ generation: { kind: "refused", status: 400, payload: { diagnostic } } });
  const { run, settled } = await runLane(core);
  await assert.rejects(run, (error: unknown) => error instanceof RunnerFailure && error.category === "runtime.behavior" && /FluxIQ did not build a Flow from the task's instruction \(flow_bootstrap\.evidence_repeat_without_progress\)/u.test(error.message));
  assert.equal(settled[0]?.outcome, "failed");
  for (const step of ["approve", "apply", "start", "publish"]) assert.equal(core.calls.includes(step), false, `${step} ran after a refused build`);
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
  assert.equal(unchanged.calls.at(-1), "apply", "nothing is read or run after an apply that changed nothing");
});
