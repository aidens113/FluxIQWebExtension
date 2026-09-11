import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { FIRST_LIVE_DIAGNOSIS_PROFILE, evaluateDemoLlmDiagnosis } from "../demo-llm-live.js";

const root = path.resolve(import.meta.dirname, "../../../..");
const summary = (runId: string, status: "failed" | "succeeded", interventions: number) => ({
  runId, projectId: "project.one", flowId: "flow.one", status,
  routeDecisionCount: 1, subflowEntryCount: 1, actionAttemptCount: 1,
  interventionCount: interventions, adaptationCount: 0, startedAt: 10, finishedAt: 20, updatedAt: 20,
});
const action = (status: "failed" | "succeeded") => ({ attemptId: "attempt.one", nodeId: "node.one", definitionId: "builtin.policy.action", order: 0, status, startedAt: 10, finishedAt: 15 });

test("first live profile is stricter than the global ceilings", () => {
  assert.deepEqual(FIRST_LIVE_DIAGNOSIS_PROFILE.budget, {
    maxInputTokens: 2_000, maxOutputTokens: 512, maxTotalTokensPerRequest: 3_000,
    maxCallsPerRun: 1, timeoutMs: 20_000, maxRetries: 0, maxEstimatedCostUsd: 0.25,
  });
  assert.equal(FIRST_LIVE_DIAGNOSIS_PROFILE.externalSideEffects, false);
  assert.equal(FIRST_LIVE_DIAGNOSIS_PROFILE.retainRawPrompts, false);
  assert.equal(FIRST_LIVE_DIAGNOSIS_PROFILE.retainRawResponses, false);
});

test("certifies one diagnosis only after the failed action and a zero-call replay", () => {
  const result = evaluateDemoLlmDiagnosis({
    diagnosis: {
      summary: summary("run.diagnosis", "failed", 1), routeDecisions: [], subflows: [], actionAttempts: [action("failed")],
      interventions: [{ interventionId: "intervention.one", kind: "diagnosis", promptVersion: "automation-studio.runtime-diagnosis.v1", provider: "deepseek", model: "deepseek-chat", validationOk: true, inputTokens: 100, outputTokens: 50, totalTokens: 150, estimatedCostUsd: 0.01 }],
      adaptationIds: [], changeProposalIds: [], providerCallCount: 1,
    },
    diagnosisEvents: [
      { sequence: 1, eventId: "event.action", eventKind: "action_attempt", timestampMs: 15, title: "Action", status: "failed" },
      { sequence: 2, eventId: "event.llm", eventKind: "intervention", timestampMs: 20, title: "Diagnosis", status: "created" },
    ],
    replay: { summary: summary("run.replay", "succeeded", 0), routeDecisions: [], subflows: [], actionAttempts: [action("succeeded")], interventions: [], adaptationIds: [], changeProposalIds: [], providerCallCount: 0 },
  });
  assert.equal(result.providerCallCount, 1);
  assert.equal(result.replayProviderCallCount, 0);
  assert.equal(result.evaluation.applyOutcome, "not-attempted");
});

test("fails closed on provider, prompt, usage, mutation, ordering, and replay violations", () => {
  const source = {
    summary: summary("run.diagnosis", "failed", 1), routeDecisions: [], subflows: [], actionAttempts: [action("failed")],
    interventions: [{ interventionId: "intervention.one", kind: "diagnosis" as const, promptVersion: "automation-studio.runtime-diagnosis.v1", provider: "deepseek", model: "deepseek-chat", validationOk: true, inputTokens: 100, outputTokens: 50, totalTokens: 150, estimatedCostUsd: 0.01 }],
    adaptationIds: [], changeProposalIds: [], providerCallCount: 1,
  };
  const events = [{ sequence: 1, eventId: "event.action", eventKind: "action_attempt" as const, timestampMs: 15, title: "Action", status: "failed" }, { sequence: 2, eventId: "event.llm", eventKind: "intervention" as const, timestampMs: 20, title: "Diagnosis" }];
  const replay = { summary: summary("run.replay", "succeeded", 0), routeDecisions: [], subflows: [], actionAttempts: [action("succeeded")], interventions: [], adaptationIds: [], changeProposalIds: [], providerCallCount: 0 };
  assert.throws(() => evaluateDemoLlmDiagnosis({ diagnosis: { ...source, interventions: [{ ...source.interventions[0]!, provider: "other" }] }, diagnosisEvents: events, replay }), /violated/);
  assert.throws(() => evaluateDemoLlmDiagnosis({ diagnosis: { ...source, interventions: [{ ...source.interventions[0]!, promptVersion: "unexpected" }] }, diagnosisEvents: events, replay }), /violated/);
  assert.throws(() => evaluateDemoLlmDiagnosis({ diagnosis: { ...source, interventions: [{ ...source.interventions[0]!, totalTokens: 3001 }] }, diagnosisEvents: events, replay }), /budget/);
  assert.throws(() => evaluateDemoLlmDiagnosis({ diagnosis: { ...source, interventions: [{ ...source.interventions[0]!, inputTokens: -1, totalTokens: 49 }] }, diagnosisEvents: events, replay }), /budget/);
  assert.throws(() => evaluateDemoLlmDiagnosis({ diagnosis: { ...source, interventions: [{ ...source.interventions[0]!, estimatedCostUsd: Number.NaN }] }, diagnosisEvents: events, replay }), /budget/);
  assert.throws(() => evaluateDemoLlmDiagnosis({ diagnosis: { ...source, adaptationIds: ["adaptation.one"] }, diagnosisEvents: events, replay }), /violated/);
  assert.throws(() => evaluateDemoLlmDiagnosis({ diagnosis: source, diagnosisEvents: [...events].reverse().map((event, index) => ({ ...event, sequence: index + 1 })), replay }), /violated/);
  assert.throws(() => evaluateDemoLlmDiagnosis({ diagnosis: source, diagnosisEvents: events, replay: { ...replay, interventions: [source.interventions[0]!] } }), /replay/);
  assert.throws(() => evaluateDemoLlmDiagnosis({ diagnosis: source, diagnosisEvents: events, replay: { ...replay, actionAttempts: [action("failed")] } }), /replay/);
});

test("live command is real-UI, credential-boundary safe, and provider-secret free", async () => {
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  assert.equal(packageJson.scripts["demo:llm:diagnose"], "node scripts/run-demo-llm-diagnosis.mjs");
  const launcher = await readFile(path.join(root, "scripts/run-demo-llm-diagnosis.mjs"), "utf8");
  assert.equal(launcher.includes("withoutProviderSecrets(process.env)"), true);
  assert.doesNotMatch(launcher, /DEEPSEEK_API_KEY|setupDemoWorkspaceDeepSeekKey|deepSeekSecretFromDriverEnvironment/u);
  const source = await readFile(path.join(root, "packages/test-runner/src/demo-workspace.ts"), "utf8");
  const start = source.indexOf("export async function runDemoLlmDiagnosis");
  const end = source.indexOf("export async function runDemoWorkspaceFlow", start);
  const lane = source.slice(start, end);
  for (const required of ["withWorkspaceLock", "withPersistentDemoCore", "withDemoBrowser", "configureFirstLiveDiagnosisViaUi", "connectExtension", "introduce-missing-target", "runDiagnosisFromPanel", "restoreDiagnosisScenario", "runDemoFlowFromPanel", "authenticated session", "Encrypted API key", "TESTING_LAB_DEEPSEEK_KEY_NAME"]) assert.equal(lane.includes(required), true);
  assert.doesNotMatch(lane, /Authorize One Diagnosis|llm-runtime-password|llm-runtime-pin/u);
  assert.match(lane, /const provider = llmSection\.getByLabel\("Provider", \{ exact: true \}\)/u);
  assert.match(lane, /provider\.waitFor\(\{ state: "visible", timeout: 10_000 \}\)[\s\S]*provider\.selectOption\("deepseek"\)/u);
  assert.match(lane, /const model = llmSection\.getByLabel\("Model", \{ exact: true \}\)/u);
  assert.match(lane, /const input = llmSection\.getByLabel\(label, \{ exact: true \}\)/u);
  assert.doesNotMatch(lane, /exactWrappedSettingsControl|label:has\(> span:text-is/u);
  const settingsLoaded = lane.indexOf('getByText("Loading saved Flow settings..."');
  const sectionResolved = lane.indexOf('button[aria-controls="flow-settings-llm"]');
  const sectionActivated = lane.indexOf('getAttribute("aria-current")');
  const providerVisible = lane.indexOf('provider.waitFor({ state: "visible"');
  assert.ok(settingsLoaded >= 0 && sectionResolved > settingsLoaded && sectionActivated > sectionResolved && providerVisible > sectionActivated);
  assert.doesNotMatch(lane, /if \(await sectionButton\.count\(\)\)/u);
  assert.ok(lane.indexOf("introduce-missing-target") < lane.indexOf("runDiagnosisFromPanel"));
  assert.ok(lane.indexOf("runDiagnosisFromPanel") < lane.indexOf("restoreDiagnosisScenario"));
  const runtimeStart = lane.indexOf("async function runDiagnosisFromPanel");
  const runtimeEnd = lane.indexOf("export async function runDemoWorkspaceFlow", runtimeStart);
  const runtime = lane.slice(runtimeStart, runtimeEnd);
  assert.match(runtime, /Checking Flow readiness[\s\S]*const runButton[\s\S]*initialRunEnabled[\s\S]*missingActiveInstruction[\s\S]*llm-runtime-not-ready/u);
  assert.ok(runtime.indexOf("initialRunEnabled") < runtime.indexOf('"llm-runtime-run-request"'));
  assert.match(runtime, /llm-runtime-mode-not-ready[\s\S]*Diagnosis-only mode did not remain ready to run/u);
  assert.doesNotMatch(lane, /deepSeekSecretFromDriverEnvironment|ensureDeepSeekKeyViaUi|rawMetadata/u);
});
