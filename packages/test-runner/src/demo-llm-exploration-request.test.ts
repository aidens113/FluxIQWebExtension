import assert from "node:assert/strict";
import test from "node:test";
import { BLANK_LLM_INSTRUCTION_BODY } from "./demo-llm-blank-workspace.js";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { assertDemoLlmExplorationBindingScenario, createDemoLlmExplorationRequestBinding, inspectDemoLlmExplorationRequestReadiness, loadDemoLlmExplorationRequestBinding, parseDemoLlmExplorationRequestBinding, resolveDemoLlmExplorationRequest, saveDemoLlmExplorationRequestBinding, validateBoundExplorationRun } from "./demo-llm-exploration-request.js";

test("defaults to the certified instruction-only fixture and emits content-free readiness", async () => {
  const request = await resolveDemoLlmExplorationRequest(process.cwd(), {});
  assert.deepEqual(request, {
    scenarioId: "instruction-only-form",
    scenarioPath: "/scenarios/instruction-only-form/",
    instruction: BLANK_LLM_INSTRUCTION_BODY,
  });
  const readiness = inspectDemoLlmExplorationRequestReadiness(request);
  assert.equal(readiness.status, "ready");
  assert.equal(readiness.providerCallCount, 0);
  assert.equal(readiness.exactOriginRequired, true);
  assert.equal(readiness.recorderRequiredIdle, true);
  assert.equal(readiness.manualReviewRequired, true);
  assert.equal(readiness.providerBudget.maxCalls, 4);
  assert.equal(readiness.providerBudget.maxTotalEstimatedCostUsd, 1);
  assert.equal(JSON.stringify(readiness).includes(BLANK_LLM_INSTRUCTION_BODY), false);
});

test("accepts a bounded scenario and simple instruction without placing text in readiness output", async () => {
  const request = await resolveDemoLlmExplorationRequest(process.cwd(), {
    FLUXIQ_LLM_SCENARIO_ID: "delayed-ui",
    FLUXIQ_LLM_INSTRUCTION: "Open the form and create a reviewable flow.",
  });
  assert.deepEqual(request, {
    scenarioId: "delayed-ui",
    scenarioPath: "/scenarios/delayed-ui/",
    instruction: "Open the form and create a reviewable flow.",
  });
  const readiness = inspectDemoLlmExplorationRequestReadiness(request);
  assert.equal(readiness.instructionCharacters, request.instruction.length);
  assert.equal(readiness.instructionBytes, Buffer.byteLength(request.instruction));
  assert.match(readiness.instructionDigest, /^[a-f0-9]{64}$/u);
  assert.equal(JSON.stringify(readiness).includes(request.instruction), false);
});

test("rejects path injection, unknown IDs, unsafe text, and mismatched paths", async () => {
  await assert.rejects(resolveDemoLlmExplorationRequest(process.cwd(), { FLUXIQ_LLM_SCENARIO_ID: "../sensitive-input" }), /Scenario ID/u);
  await assert.rejects(resolveDemoLlmExplorationRequest(process.cwd(), { FLUXIQ_LLM_SCENARIO_ID: "UPPER" }), /Scenario ID/u);
  await assert.rejects(resolveDemoLlmExplorationRequest(process.cwd(), { FLUXIQ_LLM_SCENARIO_ID: "not-registered" }), /Unknown scenario/u);
  await assert.rejects(resolveDemoLlmExplorationRequest(process.cwd(), { FLUXIQ_LLM_INSTRUCTION: "unsafe\u0000text" }), /safe text/u);
  await assert.rejects(resolveDemoLlmExplorationRequest(process.cwd(), { FLUXIQ_LLM_INSTRUCTION: "x".repeat(4_001) }), /4,000/u);
  assert.throws(() => inspectDemoLlmExplorationRequestReadiness({ scenarioId: "basic-form", scenarioPath: "/scenarios/other/", instruction: "Build a flow" }), /bounded scenario ID/u);
});

test("uses the manifest's noncanonical start path and revalidates it on continuation", async () => {
  const request = await resolveDemoLlmExplorationRequest(process.cwd(), { FLUXIQ_LLM_SCENARIO_ID: "navigation", FLUXIQ_LLM_INSTRUCTION: "Navigate and build a flow." });
  assert.equal(request.scenarioPath, "/scenarios/navigation/start");
  const binding = createDemoLlmExplorationRequestBinding(request, { projectId: "project.one", flowId: "flow.one", adaptationId: "adaptation.one" });
  assert.doesNotThrow(() => assertDemoLlmExplorationBindingScenario(binding, { id: "navigation", startPath: "/scenarios/navigation/start" } as never));
  assert.throws(() => assertDemoLlmExplorationBindingScenario(binding, { id: "navigation", startPath: "/scenarios/navigation/second" } as never), /no longer matches/u);
});

test("persists only an exact secret-free proposal binding", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-exploration-binding-"));
  const request = await resolveDemoLlmExplorationRequest(process.cwd(), { FLUXIQ_LLM_SCENARIO_ID: "basic-form", FLUXIQ_LLM_INSTRUCTION: "Complete and submit the basic form." });
  const binding = createDemoLlmExplorationRequestBinding(request, { projectId: "project.one", flowId: "flow.one", adaptationId: "adaptation.one" });
  await saveDemoLlmExplorationRequestBinding(root, binding, ["private-secret"]);
  assert.deepEqual(await loadDemoLlmExplorationRequestBinding(root), binding);
  const serialized = await readFile(path.join(root, "llm-exploration-request-binding.json"), "utf8");
  assert.equal(serialized.includes(request.instruction), false);
  assert.equal(serialized.includes("private-secret"), false);
  assert.throws(() => parseDemoLlmExplorationRequestBinding({ ...binding, scenarioPath: "/scenarios/other/" }), /scenario path/u);
  await assert.rejects(saveDemoLlmExplorationRequestBinding(root, { ...binding, adaptationId: "private-secret" }, ["private-secret"]), /credential material/u);
});

test("bound continuation commands are provider-free and separate from legacy checkpoint commands", async () => {
  const manifest = JSON.parse(await readFile("package.json", "utf8")) as { scripts: Record<string, string> };
  assert.equal(manifest.scripts["demo:llm:explore:apply"], "node scripts/apply-demo-llm-exploration-proposal.mjs");
  assert.equal(manifest.scripts["demo:llm:explore:request:apply"], "node scripts/apply-demo-llm-exploration-request.mjs");
  assert.equal(manifest.scripts["demo:llm:explore:request:run"], "node scripts/run-demo-llm-exploration-request-flow.mjs");
  for (const script of ["scripts/apply-demo-llm-exploration-request.mjs", "scripts/run-demo-llm-exploration-request-flow.mjs"]) {
    const source = await readFile(script, "utf8");
    assert.doesNotMatch(source, /DEEPSEEK_API_KEY|runDemoLlmExplorationCheckpoint|generate-flow-bootstrap-adaptation/u);
    assert.match(source, /providerCallCount: 0/u);
  }
});

test("validates deterministic terminal execution, exact owned routing, and unchanged recordings", () => {
  const valid = {
    runId: "run.one", dispatchStatus: "succeeded", detailStatus: "succeeded", providerCallCount: 0,
    interventionCount: 0, actionStatuses: ["succeeded", "succeeded"], selectedSubflowIds: ["subflow.one"],
    subflows: [{ subflowId: "subflow.one", status: "succeeded", graphFlowId: "flow.graph" }],
    ownedSubflowId: "subflow.one", graphFlowId: "flow.graph", recordingIdsBefore: [], recordingIdsAfter: [],
  } as const;
  assert.deepEqual(validateBoundExplorationRun(valid), { runId: "run.one", actionAttemptCount: 2, succeededActionCount: 2, routedOwnedSubflow: true, recordingCount: 0 });
  assert.throws(() => validateBoundExplorationRun({ ...valid, providerCallCount: 1 }), /without LLM/u);
  assert.throws(() => validateBoundExplorationRun({ ...valid, interventionCount: 1 }), /without LLM/u);
  assert.throws(() => validateBoundExplorationRun({ ...valid, selectedSubflowIds: ["subflow.other"] }), /owned Subflow/u);
  assert.throws(() => validateBoundExplorationRun({ ...valid, recordingIdsAfter: ["recording.new"] }), /recordings/u);
});
