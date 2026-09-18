// Replaying a saved Flow, later, with no model anywhere.
//
// `lab run` builds a Flow and runs it in the same invocation, and on the
// isolated target deletes the FluxIQ install the Flow was saved in when the run
// ends. That proves a Flow can be built; it does not prove that what was saved
// is reusable, which is the point of building it. This is the other half: a
// separate invocation, on the persistent workspace the Flow was saved in,
// starts a fresh Core and browser, runs the saved Flow exactly as saved, and
// judges its result the way the task that built it is judged.
//
// "No model" is made true rather than observed. The replay refuses to start
// when its own process holds a provider credential, removes every model
// provider key Core holds before the run, and runs with no execution grant, so
// Core runs it `deterministic` and resolves no provider at all. It then reads
// Core's own accounting of the run and requires zero calls and zero
// interventions.

import { createHash, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import type { PersistentRunAllocation } from "../allocation.js";
import { removeRunOwnedTopologyState, startTopology, type RunningTopology } from "../coordinator.js";
import { classifyRunnerFailure, RunnerFailure } from "../failure.js";
import { createdFlowActionTypes, createdFlowDatasetHolds, createdFlowSecretInputs, executeRecordedFlowRun, judgeCreatedFlowDataset, loadCreatedFlowRequest, readFlowNodes, resetScenarioLab, resolveCreatedFlowSecrets, type FlowRunRoute, type PersistedFlowRunOutcome } from "../flow-lane/index.js";
import { armScenarioVariant } from "../lab-control/index.js";
import { resolveLabPaths } from "../lab-instance/index.js";
import { finalStateFacts } from "../lane-rules/index.js";
import { liveLlmObservedUsage } from "../live-llm/index.js";
import { assertExpectedFacts, playwrightScenarioFactProbe } from "../scenario-assertions.js";
import { loadScenarioManifest } from "../scenarios.js";
import type { FluxIQTargetConfiguration } from "../target-config.js";
import { removeCoreProviderKeys, type CoreProviderKeyRemoval } from "./core-provider-keys.js";
import { providerCredentialVariables } from "./provider-credential-variables.js";
import { openReplayBrowser, type ReplayBrowser } from "./replay-browser.js";
import { savedNavigationOrigins } from "./saved-navigation-origins.js";

export type SavedFlowReplayOptions = {
  repositoryRoot: string;
  fluxiqRepositoryRoot: string;
  runsDirectory: string;
  scenarioId: string;
  /** The saved Flow, by the id Core gave it when the build created it. */
  flowId: string;
  /** The instruction task the Flow was built for, which says how its result is judged; the scenario's first task when absent. */
  taskId?: string;
  seed?: number;
  target: Extract<FluxIQTargetConfiguration, { mode: "persistent-isolated" }>;
  /** The resolved Lab environment: declared secrets are read from it. */
  environment: NodeJS.ProcessEnv;
  /** Every environment a credential could have reached this process through, checked before anything starts. */
  credentialSources: readonly NodeJS.ProcessEnv[];
};

/** Core's own account of what the run spent on a model, beside what was done to make sure it could spend nothing. */
export type ReplayModelAccounting = Readonly<{
  /** Credential variables in the replay process's environment, by name. Always empty: the replay refuses otherwise. */
  environmentCredentialVariables: readonly string[];
  coreProviderKeys: CoreProviderKeyRemoval | null;
  /** Always `null`: the run is issued no execution grant, so Core starts it `deterministic` and finds no provider. */
  executionGrant: null;
  /** The run detail's `providerCallCount`, as Core published it; `null` where it published none. */
  coreProviderCallCount: number | null;
  /** Core's per-run accounting of provider calls, `null` where Core published none. */
  accountedCalls: number | null;
  calls: number | null;
  interventions: number | null;
  harnessActivations: number | null;
  llmGate: Readonly<{ invoked: boolean; reason?: string; code?: string }> | null;
  resultVerification: PersistedFlowRunOutcome["resultVerification"];
}>;

export type SavedFlowReplayResult = Readonly<{
  replayId: string;
  verdict: "passed" | "failed";
  /** Why a failed replay failed, in closed text; empty when it passed. */
  reasons: readonly string[];
  workspace: string;
  projectId: string | null;
  flowId: string;
  /** The saved Flow's content hash before and after: the replay ran what was saved, and changed nothing. */
  flowContentHash: Readonly<{ before: string | null; after: string | null }>;
  task: Readonly<{ taskId: string; scenarioId: string; workflowId: string | null; variantId: string | null; judgeBy: string; stepId: string | null }> | null;
  address: Readonly<{ scenarioOrigin: string | null; scenarioPortRetained: boolean | null; savedNavigationOrigins: readonly string[]; servedAtSavedAddress: boolean | null }>;
  model: ReplayModelAccounting;
  run: Readonly<{ runtimeRunId: string; status: string; actions: readonly Readonly<{ actionType: string; status: string }>[]; failure: Readonly<{ category: string; code?: string }> | null; route: FlowRunRoute | null }> | null;
  /** Counts only, per judged extract step: `matchedRecords` against `expectedRecords` is the answer. */
  extraction: readonly Readonly<Record<string, unknown>>[] | null;
  /**
   * Each dataset the run stored, as its row count and a SHA-256 of its rows in
   * Core's order, keys sorted. Two replays whose digests are equal stored the
   * same rows in the same order: the same answer, not merely as many right.
   */
  datasets: readonly Readonly<{ records: number; sha256: string }>[] | null;
  playbackGoalHeld: boolean | null;
  error: Readonly<{ category: string; message: string }> | null;
  resultPath: string;
}>;

type ReplayState = {
  projectId: string | null; hashBefore: string | null; hashAfter: string | null;
  task: SavedFlowReplayResult["task"]; scenarioOrigin: string | null; scenarioPortRetained: boolean | null;
  origins: string[]; servedAtSavedAddress: boolean | null; keys: CoreProviderKeyRemoval | null;
  run: PersistedFlowRunOutcome | null; usage: ReturnType<typeof liveLlmObservedUsage> | null; coreProviderCallCount: number | null;
  extraction: Record<string, unknown>[] | null; playbackGoalHeld: boolean | null; error: SavedFlowReplayResult["error"];
};

/**
 * Runs the saved Flow once and writes the result to
 * `<runs>/replays/<replay-id>.json`. A wrong result, a model call, or a run
 * that could not complete is a failed verdict with its reasons, never a throw;
 * only a replay refused before it started throws.
 */
export async function replaySavedFlow(options: SavedFlowReplayOptions): Promise<SavedFlowReplayResult> {
  const replayId = `replay-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
  const resultPath = path.join(options.runsDirectory, "replays", `${replayId}.json`);
  const environmentCredentialVariables = providerCredentialVariables(...options.credentialSources);
  // Refused before a Core or a browser exists: a replay that could have reached a model proves nothing about one that could not.
  if (environmentCredentialVariables.length) {
    throw new RunnerFailure("fixture.invalid", `A saved-Flow replay runs with no model provider credential in its environment; unset ${environmentCredentialVariables.join(", ")} and replay again`);
  }
  const reasons: string[] = [];
  const state: ReplayState = { projectId: null, hashBefore: null, hashAfter: null, task: null, scenarioOrigin: null, scenarioPortRetained: null, origins: [], servedAtSavedAddress: null, keys: null, run: null, usage: null, coreProviderCallCount: null, extraction: null, playbackGoalHeld: null, error: null };
  let topology: RunningTopology | undefined;
  let browser: ReplayBrowser | undefined;
  try {
    const labPaths = resolveLabPaths(options.repositoryRoot, options.environment);
    const scenario = await loadScenarioManifest(options.repositoryRoot, options.scenarioId, labPaths.scenarioLabDist);
    const request = await loadCreatedFlowRequest({ repositoryRoot: options.repositoryRoot, scenarioLabDist: labPaths.scenarioLabDist, scenarioId: options.scenarioId, ...(options.taskId ? { taskId: options.taskId } : {}) });
    const workflow = resolveScenarioWorkflow(scenario, { ...(request.workflowId ? { workflowId: request.workflowId } : {}), ...(request.variantId ? { variantId: request.variantId } : {}) });
    const { judgement } = request;
    state.task = { taskId: request.task.id, scenarioId: request.task.scenarioId, workflowId: request.workflowId ?? null, variantId: request.variantId ?? null, judgeBy: judgement.judgeBy, stepId: judgement.judgeBy === "expected-dataset" ? judgement.stepId : null };

    const credentials = options.target.credentials;
    topology = await startTopology({
      repositoryRoot: options.repositoryRoot, fluxiqRepositoryRoot: options.fluxiqRepositoryRoot,
      runsDirectory: options.runsDirectory, runId: replayId,
      seed: options.seed ?? scenario.seed, target: options.target,
      scenarioEntrypoint: labPaths.scenarioEntrypoint, hostModulePath: labPaths.hostModulePath,
      ...(labPaths.hostPrebuilt ? { prepareHost: false } : {}), bootstrapIdentity: true,
      ...(credentials ? { credentials: { username: credentials.username, password: credentials.password, ...(credentials.authorizationPin ? { pin: credentials.authorizationPin } : {}), ...(credentials.totp ? { totp: credentials.totp } : {}) } } : {}),
    });
    const { control, projectId, authorizationPassword, scenarioOrigin } = topology;
    if (!control || !projectId || !authorizationPassword) throw new RunnerFailure("environment.missing", "The persistent workspace's Core did not authenticate, so its saved Flows cannot be read");
    state.projectId = projectId;
    state.scenarioOrigin = scenarioOrigin;
    state.scenarioPortRetained = (topology.allocation as Partial<PersistentRunAllocation>).scenarioPortRetained ?? null;
    if (!(await control.listFlowSummaries(projectId)).some(summary => summary.flowId === options.flowId)) {
      throw new RunnerFailure("fixture.invalid", `The workspace's project holds no Flow ${options.flowId}`);
    }
    state.hashBefore = (await control.getExactFlow(projectId, options.flowId)).contentHash;
    state.keys = await removeCoreProviderKeys(control, { password: authorizationPassword, ...(topology.authorizationPin ? { pin: topology.authorizationPin } : {}) });

    const nodes = await readFlowNodes(control, { projectId, flowId: options.flowId });
    const actionTypes = createdFlowActionTypes(nodes, options.flowId);
    state.origins = savedNavigationOrigins(nodes, actionTypes);
    // A Flow that navigates nowhere starts on the page the run starts on -- which
    // is what a Router deciding on the observed start page needs -- so it has no
    // saved address to be wrong about. The replay loads the fixture's start page
    // before running it, as the lane that built it did.
    state.servedAtSavedAddress = state.origins.every(origin => origin === new URL(scenarioOrigin).origin);
    // Run regardless, so what an unreachable address does to the Flow is observed rather than assumed.
    if (!state.servedAtSavedAddress) reasons.push("the saved Flow navigates to an address this invocation does not serve the fixture at");
    const secretInputs = createdFlowSecretInputs({ scenarioId: request.task.scenarioId, secrets: resolveCreatedFlowSecrets(scenario, workflow, options.environment), workflow, nodes });

    browser = await openReplayBrowser(topology, { extensionPath: labPaths.extensionPath, startPath: scenario.startPath });
    await resetScenarioLab(scenarioOrigin, topology.allocation.controllerToken);
    if (workflow.variant) await armScenarioVariant(scenarioOrigin, topology.allocation.controllerToken, scenario.id, workflow.variant);
    await browser.openStart();
    // No `llmExecution`: `runPersistedFlow` then asks Core for `adaptiveMode: "deterministic"`.
    const run = await executeRecordedFlowRun(control, { projectId, flowId: options.flowId, facilityRunId: replayId, actionTypes, inputs: { ...secretInputs, scenarioId: request.task.scenarioId, facilityRunId: replayId } });
    state.run = run;
    const detail = await control.getRunDetail(projectId, run.runId);
    state.usage = liveLlmObservedUsage(detail);
    state.coreProviderCallCount = detail.providerCallCount ?? null;
    if (judgement.judgeBy === "expected-dataset") {
      const extraction = judgeCreatedFlowDataset({ workflow, stepId: judgement.stepId, run, actionTypes, scenarioOrigin });
      state.extraction = extraction.measurements.map(measurement => ({ ...measurement }));
      if (!createdFlowDatasetHolds(extraction)) reasons.push("the records the Flow stored do not match the task's expected dataset");
    } else {
      state.playbackGoalHeld = await playbackGoalHeld(browser, scenarioOrigin, finalStateFacts(scenario, workflow));
      if (!state.playbackGoalHeld) reasons.push("the scenario's playback goal did not hold after the Flow ran");
    }
    if (run.status !== "succeeded") reasons.push(`Core reported the run ${run.status}`);
    if (state.usage.calls !== 0) reasons.push(`Core accounted ${state.usage.calls} model provider call(s) to the run`);
    if (state.usage.interventions !== 0) reasons.push(`Core recorded ${state.usage.interventions} model intervention(s) in the run`);
    if (run.harnessActivations !== 0) reasons.push(`Core's recovery harness activated ${run.harnessActivations} time(s)`);
    state.hashAfter = (await control.getExactFlow(projectId, options.flowId)).contentHash;
    if (state.hashAfter !== state.hashBefore) reasons.push("the saved Flow's content changed during the replay");
    browser.guard.assertNoViolations();
  } catch (error) {
    state.error = { category: classifyRunnerFailure(error), message: error instanceof Error ? error.message : String(error) };
    reasons.push("the replay did not complete");
  } finally {
    // Cleanup never replaces the replay's result: that is what the caller needs, and a failed close leaves only this invocation's session behind.
    await browser?.close().catch(/* best-effort: the result is already decided */ () => undefined);
    await topology?.close().catch(/* best-effort: the result is already decided */ () => undefined);
    if (topology) await removeRunOwnedTopologyState(topology).catch(/* best-effort: only this invocation's session directory */ () => undefined);
  }
  const result = resultOf({ replayId, resultPath, options, state, environmentCredentialVariables, reasons });
  await mkdir(path.dirname(resultPath), { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return result;
}

function resultOf(input: { replayId: string; resultPath: string; options: SavedFlowReplayOptions; state: ReplayState; environmentCredentialVariables: string[]; reasons: string[] }): SavedFlowReplayResult {
  const { state, reasons } = input;
  const { run, usage } = state;
  return Object.freeze({
    replayId: input.replayId, verdict: reasons.length === 0 ? "passed" : "failed", reasons,
    workspace: input.options.target.workspace, projectId: state.projectId, flowId: input.options.flowId,
    flowContentHash: { before: state.hashBefore, after: state.hashAfter },
    task: state.task,
    address: { scenarioOrigin: state.scenarioOrigin, scenarioPortRetained: state.scenarioPortRetained, savedNavigationOrigins: state.origins, servedAtSavedAddress: state.servedAtSavedAddress },
    model: {
      environmentCredentialVariables: input.environmentCredentialVariables, coreProviderKeys: state.keys, executionGrant: null,
      coreProviderCallCount: state.coreProviderCallCount, accountedCalls: usage?.accounting?.calls ?? null, calls: usage?.calls ?? null, interventions: usage?.interventions ?? null,
      harnessActivations: run?.harnessActivations ?? null, llmGate: usage?.gate ?? null, resultVerification: run?.resultVerification ?? null,
    },
    run: run ? {
      runtimeRunId: run.runId, status: run.status,
      actions: run.actions.map(action => ({ actionType: action.actionType, status: action.status })),
      failure: run.failure ? { category: run.failure.category, ...(run.failure.code === undefined ? {} : { code: run.failure.code }) } : null,
      // Which route the saved Flow's Router took on this rendering, and why: ids and Core's matcher reasons, no observed values.
      route: run.route,
    } : null,
    extraction: state.extraction,
    datasets: run ? run.extracted.map(dataset => ({ records: dataset.records.length, sha256: rowsDigest(dataset.records) })) : null,
    playbackGoalHeld: state.playbackGoalHeld, error: state.error, resultPath: input.resultPath,
  });
}

/** The rows as canonical JSON (each record's keys sorted, rows in order), hashed. */
function rowsDigest(records: readonly Record<string, unknown>[]): string {
  const canonical = records.map(record => Object.fromEntries(Object.keys(record).sort().map(key => [key, record[key]])));
  return createHash("sha256").update(JSON.stringify(canonical), "utf8").digest("hex");
}

/** Whether the playback goal holds on any tab showing the fixture, newest first, as the created-Flow lane judges it. */
async function playbackGoalHeld(browser: ReplayBrowser, scenarioOrigin: string, facts: ReturnType<typeof finalStateFacts>): Promise<boolean> {
  for (const page of browser.context.pages().filter(candidate => !candidate.isClosed() && candidate.url().startsWith(`${scenarioOrigin}/`)).reverse()) {
    try { await assertExpectedFacts(facts, playwrightScenarioFactProbe(page)); return true; }
    catch { /* best-effort: the Flow may have finished on another tab */ }
  }
  return false;
}
