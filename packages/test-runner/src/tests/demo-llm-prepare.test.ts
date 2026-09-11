import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  assertBlankLlmPreparationStateDoesNotContainSecrets,
  assertGenuinelyBlankFlow,
  assertRecordingSetUnchanged,
  BLANK_LLM_INSTRUCTION_BODY,
  BLANK_LLM_SCENARIO_PATH,
  parseBlankLlmPreparationState,
  hierarchyDialogFieldControl,
} from "../demo-llm-blank-workspace.js";
import { loadAllowlistedTestEnvironment } from "../target-config.js";

const repositoryRoot = path.resolve(import.meta.dirname, "../../../..");

test("hierarchy dialog field lookup is candidate-relative, direct-child, unique, and visible", async () => {
  for (const [label, control] of [["Name", "input"], ["Flow preset", "select"], ["Location", "select"], ["Security PIN", "input"]] as const) {
    const direct = { count: async () => 1, isVisible: async () => true };
    const fields = {
      filter(options: { hasText?: RegExp; has?: unknown }) {
        assert.equal(options.has, undefined);
        assert.ok(options.hasText instanceof RegExp);
        assert.equal(options.hasText.test(`${label}nested option text`), true);
        return { locator: (selector: string) => { assert.equal(selector, `:scope > ${control}`); return direct; } };
      },
    };
    const form = { locator: (selector: string) => { assert.equal(selector, "label.field"); return fields; } };
    assert.equal(await hierarchyDialogFieldControl(form as any, label, control), direct);
  }
  const fake = (count: number, visible: boolean) => ({ locator: () => ({ filter: () => ({ locator: () => ({ count: async () => count, isVisible: async () => visible }) }) }) });
  await assert.rejects(() => hierarchyDialogFieldControl(fake(0, false) as any, "Name", "input"), /exact visible hierarchy dialog field/);
  await assert.rejects(() => hierarchyDialogFieldControl(fake(2, true) as any, "Name", "input"), /exact visible hierarchy dialog field/);
  await assert.rejects(() => hierarchyDialogFieldControl(fake(1, false) as any, "Name", "input"), /exact visible hierarchy dialog field/);
});
test("blank preparation persists only project and Flow identity", () => {
  const state = { schemaVersion: "0.1", projectId: "project.opaque", flowId: "flow.opaque" } as const;
  assert.deepEqual(parseBlankLlmPreparationState(state), state);
  for (const extra of ["subflowId", "graphFlowId", "routerId", "recordingId", "password", "pin", "providerKey"]) {
    assert.throws(() => parseBlankLlmPreparationState({ ...state, [extra]: "forbidden" }), /unsupported schema/);
  }
  assert.throws(() => parseBlankLlmPreparationState({ ...state, flowId: "" }), /invalid flowId/);
  assert.throws(() => assertBlankLlmPreparationStateDoesNotContainSecrets({ ...state, flowId: "SENTINEL_PASSWORD" }, ["SENTINEL_PASSWORD"]), /credential material/);
});

test("blank invariant rejects nodes, Subflows, Router routes, and recording identity", async () => {
  const state = { schemaVersion: "0.1", projectId: "project.one", flowId: "flow.one" } as const;
  const document = { projectId: state.projectId, flowId: state.flowId, name: "Blank", nodes: [], edges: [], metadata: { flowRepresentationKind: "orchestration" } };
  const fake = (overrides: Record<string, unknown> = {}) => ({
    getExactFlow: async () => ({ document: { ...document, ...overrides } }),
    listFlowSubflows: async () => [],
    getFlowRouter: async () => ({ routerId: "router.one", rules: [], fallback: { kind: "stop" } }),
  }) as any;
  await assert.doesNotReject(() => assertGenuinelyBlankFlow(fake(), state));
  await assert.rejects(() => assertGenuinelyBlankFlow(fake({ nodes: [{}] }), state), /genuinely blank/);
  await assert.rejects(() => assertGenuinelyBlankFlow(fake({ metadata: { flowRepresentationKind: "orchestration", lastRecordingId: "recording.one" } }), state), /genuinely blank/);
  await assert.rejects(() => assertGenuinelyBlankFlow({ ...fake(), listFlowSubflows: async () => [{ subflowId: "subflow.one" }] } as any, state), /owns a Subflow/);
  await assert.rejects(() => assertGenuinelyBlankFlow({ ...fake(), getFlowRouter: async () => ({ rules: [], fallback: { kind: "subflow", subflowId: "subflow.one" } }) } as any, state), /Router Subflow route/);
});

test("instruction-only preparation requires project recordings to remain unchanged", () => {
  const before = new Set(["recording.one"]);
  assert.doesNotThrow(() => assertRecordingSetUnchanged(before, { payload: { recordings: [{ recordingId: "recording.one" }] } }));
  assert.throws(() => assertRecordingSetUnchanged(before, { payload: { recordings: [{ recordingId: "recording.one" }, { recordingId: "recording.two" }] } }), /changed project recordings/);
});

test("allowlisted preparation environment never imports provider secrets", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "fluxiq-llm-blank-prepare-"));
  const sentinel = "SENTINEL_DEEPSEEK_KEY_DO_NOT_COPY";
  try {
    await writeFile(path.join(directory, ".env.local"), `FLUXIQ_TEST_USERNAME=runner\nFLUXIQ_TEST_PASSWORD=password\nFLUXIQ_TEST_PIN=123456\nDEEPSEEK_API_KEY=${sentinel}\n`, "utf8");
    const environment = await loadAllowlistedTestEnvironment(directory, { DEEPSEEK_API_KEY: sentinel, FLUXIQ_DEMO_HEADLESS: "true" }, ["FLUXIQ_TEST_USERNAME", "FLUXIQ_TEST_PASSWORD", "FLUXIQ_TEST_PIN", "FLUXIQ_DEMO_HEADLESS"]);
    assert.deepEqual(environment, { FLUXIQ_TEST_USERNAME: "runner", FLUXIQ_TEST_PASSWORD: "password", FLUXIQ_TEST_PIN: "123456", FLUXIQ_DEMO_HEADLESS: "true" });
    assert.equal(JSON.stringify(environment).includes(sentinel), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("demo:llm:prepare is a provider-free real-UI blank Flow lane", async () => {
  const packageJson = JSON.parse(await readFile(path.join(repositoryRoot, "package.json"), "utf8")) as { scripts?: Record<string, string> };
  assert.equal(packageJson.scripts?.["demo:llm:prepare"], "node scripts/prepare-demo-llm-workspace.mjs");
  const launcher = await readFile(path.join(repositoryRoot, "scripts/prepare-demo-llm-workspace.mjs"), "utf8");
  assert.match(launcher, /prepareDemoLlmBlankWorkspace/u);
  assert.match(launcher, /withoutProviderSecrets\(process\.env\)/u);
  assert.doesNotMatch(launcher, /DEEPSEEK_API_KEY|setupDemoWorkspaceDeepSeekKey|ensureDeepSeekKeyViaUi/u);

  const host = await readFile(path.join(repositoryRoot, "packages/test-runner/src/demo-workspace.ts"), "utf8");
  const start = host.indexOf("export async function prepareDemoLlmBlankWorkspace");
  const end = host.indexOf("export async function prepareDemoLlmWorkspace", start);
  const lane = host.slice(start, end);
  for (const required of ["withWorkspaceLock", "withPersistentDemoCore", "authenticatedControl", "withDemoBrowser", "prepareBlankLlmFlowViaUi", "connectExtension", "blank-recorder-status", "assertRecordingSetUnchanged", "assertGenuinelyBlankFlow", "saveBlankLlmPreparationState"]) assert.match(lane, new RegExp(required));
  assert.match(lane, /recordingState !== "idle"/u);
  assert.match(lane, /BLANK_LLM_SCENARIO_PATH/u);
  assert.doesNotMatch(lane, /Start recording|Stop recording|generateDemoSubflowFromRecording|runDemoFlowFromPanel|DEEPSEEK_API_KEY|runDemoLlmDiagnosis/u);

  const module = await readFile(path.join(repositoryRoot, "packages/test-runner/src/demo-llm-blank-workspace.ts"), "utf8");
  assert.match(module, /hierarchyDialogFieldControl\(form, "Flow preset", "select"\)/u);
  assert.match(module, /preset\.inputValue\(\) !== "blank"[\s\S]*preset\.selectOption\("blank"\)/u);
  assert.match(module, /hierarchyDialogFieldControl\(form, "Name", "input"\)/u);
  assert.match(module, /hierarchyDialogFieldControl\(form, "Location", "select"\)/u);
  assert.match(module, /hierarchyDialogFieldControl\(form, "Security PIN", "input"\)/u);
  assert.match(module, /location\.inputValue\(\) !== ""/u);
  assert.doesNotMatch(module, /form\.getByLabel\("(?:Name|Flow preset|Location|Security PIN)"/u);
  assert.match(module, /getByRole\("dialog", \{ name: "Create project" \}\)/u);
  assert.match(module, /getByRole\("button", \{ name: "Add Flow", exact: true \}\)/u);
  assert.match(module, /\/programs\/automation-studio\?domainId=web-automation/u);
  assert.match(module, /getByRole\("heading", \{ name: "Projects", exact: true \}\)\.waitFor/u);
  assert.match(module, /getByLabel\("Search projects"\)\.fill\(projectName\)/u);
  assert.match(module, /locator\("\.automation-project-row"\)[\s\S]*locator\("\.automation-project-row-main"\)/u);
  assert.doesNotMatch(module, /\/programs\/automation-studio`,|name: "Automation Studio", exact: true|\.automation-project-card|name: "Open project"/u);
  assert.match(module, /getByLabel\("Instruction", \{ exact: true \}\)/u);
  assert.match(module, /Authorize Instruction Save[\s\S]*sensitive: true/u);
  assert.match(module, /listFlowSubflows[\s\S]*getFlowRouter/u);
  assert.match(module, /lastRecordingId/u);
  assert.match(module, new RegExp(BLANK_LLM_INSTRUCTION_BODY.slice(0, 40).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")));
  assert.doesNotMatch(module, /Start recording|Stop recording|generateDemoSubflowFromRecording|review-recording-flow-proposal|deepSeekSecretFromDriverEnvironment/u);
});
