// One matrix case, start to verdict, provider-free and headed.
//
// 1. A fresh persistent workspace is opened once and closed, so its Core sets
//    up storage, the Lab identity and the workspace's project and records the
//    fixture's port, exactly as `lab replay`'s workspaces are made.
// 2. With that Core stopped, the case's candidate script is saved into the
//    project as a Flow through Core's own path (`../compile/`).
// 3. The workspace is opened again: the fixture is reset, the case's variant
//    armed and its perturbation started, the extension paired in a visible
//    browser, and the saved Flow run deterministically, with no model wiring
//    and no run intent, as a replay runs.
// 4. The run's own records, the site's state and Core's accounting are read
//    and the case's check judges them (`../checks/`).
//
// The workspace is this case's alone and is removed afterwards, so nothing a
// case saved can reach another case or another lane. A case that cannot start
// throws; a case that ran is a verdict, never a throw.

import { randomBytes } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";
import type { Page } from "@playwright/test";
import { resolveScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { removeRunOwnedTopologyState, startTopology, type RunningTopology } from "../../coordinator.js";
import { classifyRunnerFailure, RunnerFailure } from "../../failure.js";
import { executeRecordedFlowRun, readFlowNodes, createdFlowActionTypes, resetScenarioLab, type PersistedFlowRunOutcome } from "../../flow-lane/index.js";
import { armScenarioVariant } from "../../lab-control/index.js";
import { resolveLabPaths } from "../../lab-instance/index.js";
import { finalStateFacts } from "../../lane-rules/index.js";
import { startRunPerturbation, type PerturbationReport, type RunPerturbationSession } from "../../perturbations/index.js";
import { openReplayBrowser, providerCredentialVariables, type ReplayBrowser } from "../../saved-flow-replay/index.js";
import { assertExpectedFacts, playwrightScenarioFactProbe } from "../../scenario-assertions.js";
import { loadScenarioManifest } from "../../scenarios.js";
import { MATRIX_CHECKS, matrixRunStopCode, stepOfNode, type MatrixCaseEvidence, type MatrixCheckResult } from "../checks/index.js";
import { compileMatrixFlow, MatrixAuthoringGap, type CompiledMatrixFlow } from "../compile/index.js";
import * as flows from "../flows/index.js";
import type { RecoveryMatrixCase, RecoveryMatrixRow } from "../matrix-row.js";
import { requirementRefusal } from "./requirement-refusal.js";
import { matrixCaseMeasures, type MatrixCaseMeasures } from "../measures.js";
import { judgeSiteState, matrixAttemptRecords, matrixModelCalls, readSiteState, type MatrixModelCalls } from "../records/index.js";

export type MatrixCaseOptions = {
  repositoryRoot: string;
  fluxiqRepositoryRoot: string;
  runsDirectory: string;
  /** The matrix invocation this case belongs to, which names its workspace and its result. */
  matrixRunId: string;
  environment: NodeJS.ProcessEnv;
  /** Every environment a credential could reach this process through, refused before anything starts. */
  credentialSources: readonly NodeJS.ProcessEnv[];
};

export type MatrixCaseResult = Readonly<{
  caseId: string;
  row: number;
  title: string;
  scenarioId: string;
  variantId: string | null;
  perturbation: string | null;
  verdict: MatrixCheckResult["verdict"] | "blocked" | "error";
  reasons: readonly string[];
  missingRecords: readonly string[];
  observed: Readonly<Record<string, unknown>>;
  compiled: CompiledMatrixFlow | null;
  run: Readonly<{ runtimeRunId: string; status: string; failure: Readonly<{ category: string; code: string | null }> | null; attempts: number }> | null;
  /** Every attempt in Core's order, by step key: what a failed case is debugged from. */
  attempts: readonly Readonly<{ order: number; step: string | null; status: string; retry: boolean; failure: string | null; lifecycle: string | null; entry: string | null; stateRouting: string | null }>[];
  /** Core's own account of the run's model calls, and where it came from (`../records/model-calls.ts`). */
  accounting: MatrixModelCalls | null;
  /** A case that did not pass keeps its workspace (Core's store and logs) here for debugging; `null` once removed. */
  retainedWorkspace: string | null;
  measures: MatrixCaseMeasures | null;
  perturbationReport: PerturbationReport | null;
  workspace: string;
  startedAt: string;
  finishedAt: string;
}>;

/** Runs one case of `row` and answers its verdict. Throws only when the case is refused before it starts. */
export async function runMatrixCase(row: RecoveryMatrixRow, matrixCase: RecoveryMatrixCase, options: MatrixCaseOptions): Promise<MatrixCaseResult> {
  const credentialVariables = providerCredentialVariables(...options.credentialSources);
  if (credentialVariables.length) throw new RunnerFailure("fixture.invalid", `A recovery-matrix case runs with no model provider credential in its environment; unset ${credentialVariables.join(", ")} and run it again`);
  const script = (flows as Readonly<Record<string, string>>)[matrixCase.flow];
  if (typeof script !== "string") throw new RunnerFailure("fixture.invalid", `Matrix case ${matrixCase.caseId} names no Flow ${matrixCase.flow}`);
  const startedAt = new Date().toISOString();
  const workspace = `rmx-${matrixCase.caseId}-${randomBytes(4).toString("hex")}`;
  const labPaths = resolveLabPaths(options.repositoryRoot, options.environment);
  const scenario = await loadScenarioManifest(options.repositoryRoot, matrixCase.scenarioId, labPaths.scenarioLabDist);
  const workflow = resolveScenarioWorkflow(scenario, { ...(matrixCase.workflowId ? { workflowId: matrixCase.workflowId } : {}), ...(matrixCase.variantId ? { variantId: matrixCase.variantId } : {}) });
  const topologyOptions = {
    repositoryRoot: options.repositoryRoot, fluxiqRepositoryRoot: options.fluxiqRepositoryRoot, runsDirectory: options.runsDirectory,
    seed: scenario.seed, target: { mode: "persistent-isolated" as const, workspace },
    scenarioEntrypoint: labPaths.scenarioEntrypoint, hostModulePath: labPaths.hostModulePath,
    ...(labPaths.hostPrebuilt ? { prepareHost: false } : {}), bootstrapIdentity: true, modelProvidersEnabled: false,
  };
  const base = { caseId: matrixCase.caseId, row: row.row, title: matrixCase.title, scenarioId: matrixCase.scenarioId, variantId: matrixCase.variantId ?? null, perturbation: matrixCase.perturbation?.kind ?? null, workspace, startedAt };
  let compiled: CompiledMatrixFlow | null = null;
  let topology: RunningTopology | undefined;
  let browser: ReplayBrowser | undefined;
  let perturbation: RunPerturbationSession | undefined;
  let perturbationReport: PerturbationReport | null = null;
  let run: PersistedFlowRunOutcome | undefined;
  let outcome: { -readonly [Key in keyof MatrixCaseResult]: MatrixCaseResult[Key] } | undefined;
  try {
    const setup = await startTopology({ ...topologyOptions, runId: `${options.matrixRunId}-${matrixCase.caseId}-setup` });
    const projectId = setup.projectId;
    await setup.close();
    await removeRunOwnedTopologyState(setup).catch(/* best-effort: only the setup session's own directory */ () => undefined);
    if (!projectId) throw new RunnerFailure("environment.missing", "The matrix workspace's Core created no project");
    try {
      compiled = await compileMatrixFlow({ fluxiqRoot: setup.allocation.fluxiqRoot, projectId, flowId: `flow.recovery-matrix.${matrixCase.caseId}`, flowName: `Recovery matrix ${matrixCase.caseId}: ${matrixCase.title}`.slice(0, 120), script });
    } catch (error) {
      if (error instanceof MatrixAuthoringGap) return (outcome = finish({ ...base, verdict: "blocked", reasons: [error.message], missingRecords: [], observed: { handles: error.handles.map(item => item.path) }, compiled: null, run: null, attempts: [], accounting: null, measures: null, perturbationReport: null }));
      // A library with no Call Subflow node cannot save a Flow that calls a part: the capability, not the script, is missing.
      if (callUnavailable(error)) return (outcome = finish({ ...base, verdict: "not-proven", reasons: [], missingRecords: ["call-subflow"], observed: { refusal: "flow_script.call_unavailable" }, compiled: null, run: null, attempts: [], accounting: null, measures: null, perturbationReport: null }));
      throw error;
    }
    const started = await startTopology({ ...topologyOptions, runId: `${options.matrixRunId}-${matrixCase.caseId}-run` });
    topology = started;
    const control = started.control;
    if (!control) throw new RunnerFailure("environment.missing", "The matrix workspace's Core did not authenticate");
    let runTopology: RunningTopology = started;
    if (matrixCase.perturbation) {
      const opened = await startRunPerturbation(matrixCase.perturbation, started);
      perturbation = opened.session;
      runTopology = opened.topology;
    }
    browser = await openReplayBrowser(runTopology, { extensionPath: labPaths.extensionPath, startPath: scenario.startPath });
    if (perturbation) await perturbation.armBrowser({ context: browser.context, cdpPage: extensionPage(browser), scenarioOrigins: [started.scenarioOrigin], readers: {} });
    await resetScenarioLab(started.scenarioOrigin, started.allocation.controllerToken);
    if (workflow.variant) await armScenarioVariant(started.scenarioOrigin, started.allocation.controllerToken, scenario.id, workflow.variant);
    await browser.openStart();
    const nodes = await readFlowNodes(control, { projectId, flowId: compiled.flowId });
    const actionTypes = createdFlowActionTypes(nodes, compiled.flowId);
    const facilityRunId = `${options.matrixRunId}-${matrixCase.caseId}`;
    // No `llmExecution`: Core runs it with `adaptiveMode: "deterministic"`, and its host was built with no model wiring.
    run = await executeRecordedFlowRun(control, { projectId, flowId: compiled.flowId, facilityRunId, actionTypes, inputs: { scenarioId: scenario.id, facilityRunId } });
    const detail = await settledRunDetail(control, projectId, run.runId);
    const modelCalls = matrixModelCalls(detail);
    const raw = await control.automationStudioCall("get-flow-run-detail", { projectId, runId: run.runId });
    const runDetail = record(record(raw)?.runDetail) ?? {};
    const site = judgeSiteState(matrixCase.site, await readSiteState(started.scenarioOrigin, started.allocation.controllerToken, scenario.id));
    const goalHeld = matrixCase.goalFacts ? await goalFactsHeld(browser, started.scenarioOrigin, finalStateFacts(scenario, workflow)) : null;
    perturbationReport = perturbation ? await perturbation.close() : null;
    perturbation = undefined;
    const evidence: MatrixCaseEvidence = {
      run: { status: run.status, failure: run.failure ? { category: run.failure.category, code: run.failure.code ?? null } : null, stopCode: matrixRunStopCode(runDetail) },
      attempts: matrixAttemptRecords(runDetail),
      steps: compiled.steps,
      primarySubflowKey: compiled.subflows.find(subflow => subflow.role === "primary")?.key ?? "",
      site,
      goalHeld,
      model: { calls: modelCalls.calls, interventions: modelCalls.interventions, harnessActivations: run.harnessActivations },
      faultFired: perturbationReport ? perturbationReport.fired : null,
    };
    const checked = MATRIX_CHECKS[matrixCase.check](evidence, matrixCase);
    browser.guard.assertNoViolations();
    const reasons = [...checked.reasons];
    return (outcome = finish({
      ...base,
      verdict: reasons.length ? "failed" : checked.verdict,
      reasons,
      missingRecords: checked.missingRecords,
      observed: { ...checked.observed, site: site.observed },
      compiled,
      run: { runtimeRunId: run.runId, status: run.status, failure: evidence.run.failure, attempts: evidence.attempts.length },
      attempts: attemptSummaries(evidence),
      accounting: modelCalls,
      measures: matrixCaseMeasures(evidence),
      perturbationReport,
    }));
  } catch (error) {
    // The requirement gate refusing the run is this Core lacking what the row needs, reported as such (`./requirement-refusal.ts`).
    const refusal = requirementRefusal(error, compiled?.requires ?? [], run !== undefined);
    if (refusal !== undefined) return (outcome = finish({ ...base, verdict: "not-proven", reasons: [], missingRecords: [...row.needs], observed: { refusal }, compiled, run: null, attempts: [], accounting: null, measures: null, perturbationReport }));
    return (outcome = finish({
      ...base,
      verdict: "error",
      reasons: [`${classifyRunnerFailure(error)}: ${error instanceof Error ? error.message : String(error)}`],
      missingRecords: [],
      observed: {},
      compiled,
      run: run ? { runtimeRunId: run.runId, status: run.status, failure: run.failure ? { category: run.failure.category, code: run.failure.code ?? null } : null, attempts: run.actions.length } : null,
      attempts: [],
      accounting: null,
      measures: null,
      perturbationReport,
    }));
  } finally {
    await perturbation?.close().catch(/* best-effort: the verdict is already decided */ () => undefined);
    await browser?.close().catch(/* best-effort: the verdict is already decided */ () => undefined);
    await topology?.close().catch(/* best-effort: the verdict is already decided */ () => undefined);
    // A case that did not pass keeps its workspace -- Core's store with the run's trace, and its logs -- because every
    // failure is debugged from its run's files before the case is run again. One that passed, or never ran, is removed.
    const workspaceRoot = path.join(options.runsDirectory, "persistent-isolated", workspace);
    if (outcome && outcome.verdict !== "passed" && outcome.verdict !== "blocked") outcome.retainedWorkspace = workspaceRoot;
    else await rm(workspaceRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }).catch(/* best-effort: a workspace only this case used */ () => undefined);
  }
}

function finish(result: Omit<MatrixCaseResult, "finishedAt" | "retainedWorkspace">): { -readonly [Key in keyof MatrixCaseResult]: MatrixCaseResult[Key] } {
  return { ...result, retainedWorkspace: null, finishedAt: new Date().toISOString() };
}

/** Each attempt as the bundle keeps it: the step it ran, and Core's closed words for what happened. */
function attemptSummaries(evidence: MatrixCaseEvidence): MatrixCaseResult["attempts"] {
  return evidence.attempts.map(attempt => ({
    order: attempt.order,
    step: stepOfNode(evidence.steps, attempt.nodeId)?.nodeKey ?? attempt.definitionId,
    status: attempt.status,
    retry: attempt.retry,
    failure: attempt.failure ? `${attempt.failure.category ?? "unknown"}/${attempt.failure.code ?? "no code"}` : null,
    lifecycle: attempt.lifecycle ? `${attempt.lifecycle.event}:${attempt.lifecycle.disposition ?? "none"}` : null,
    entry: attempt.entry?.kind ?? null,
    stateRouting: attempt.stateRouting?.outcome ?? null,
  }));
}

/** How long the model gate's record may follow the run's answer: Core writes it with the result verdict, in a later save. */
const GATE_RECORD_WAIT_MS = 30_000;
const GATE_RECORD_POLL_MS = 500;

/**
 * The run's detail once Core has written its model gate record, or as it stands
 * when the wait runs out. Core answers a deterministic run before its result
 * check settles, and the zero accounting is written in the same save as that
 * verdict (`result-verification/run-record.ts`), so a detail read at once
 * carries no count at all (matrix run 3 of case 1: read without it, stored with
 * `costAccounting.calls: 0`).
 */
async function settledRunDetail(control: NonNullable<RunningTopology["control"]>, projectId: string, runId: string): Promise<Awaited<ReturnType<NonNullable<RunningTopology["control"]>["getRunDetail"]>>> {
  const deadline = Date.now() + GATE_RECORD_WAIT_MS;
  let detail = await control.getRunDetail(projectId, runId);
  while (detail.llmGate === undefined && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, GATE_RECORD_POLL_MS));
    detail = await control.getRunDetail(projectId, runId);
  }
  return detail;
}

/** Core refused the script because its node library offers no Call Subflow (`flow_script.call_unavailable`). */
function callUnavailable(error: unknown): boolean {
  const codes = error instanceof RunnerFailure ? error.details?.codes : undefined;
  return Array.isArray(codes) && codes.includes("flow_script.call_unavailable");
}

/** The extension's own page in the browser: the perturbation's CDP session and status reads go through it. */
function extensionPage(browser: ReplayBrowser): Page {
  const page = browser.context.pages().find(candidate => candidate.url().startsWith("chrome-extension://"));
  if (!page) throw new RunnerFailure("environment.missing", "The matrix browser has no extension page to arm the perturbation from");
  return page;
}

/** Whether the scenario's goal facts hold on any tab showing the fixture, newest first, as `lab replay` judges them. */
async function goalFactsHeld(browser: ReplayBrowser, scenarioOrigin: string, facts: ReturnType<typeof finalStateFacts>): Promise<boolean> {
  for (const page of browser.context.pages().filter(candidate => !candidate.isClosed() && candidate.url().startsWith(`${scenarioOrigin}/`)).reverse()) {
    try {
      await assertExpectedFacts(facts, playwrightScenarioFactProbe(page));
      return true;
    } catch {
      // best-effort: the Flow may have finished on another tab
    }
  }
  return false;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
