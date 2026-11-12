import { randomUUID } from "node:crypto";
import { mkdir, access, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { FluxIQ, defineFluxNode, z, type RunOutcome } from "@fluxiq/sdk";
import { assertRealisticScenarios } from "../realistic-scenarios/index.js";
import { resolveLabPaths } from "../lab-instance/index.js";
import { loadScenarioManifest } from "../scenarios.js";
import { loadLiveInstructionTasks } from "../flow-lane/index.js";
import { providerFreeEnvironment, scriptedModelChildEnvironment, scriptedModelKey, scriptedModelScriptFor, startScriptedModelServer, type ScriptedModelCall } from "../attempt-lane/scripted-model/index.js";
import type { FluxNodeHostProofCommand } from "./command.js";
import { hostProofContinuation } from "./continuation.js";
import { startProofEngine } from "./engine.js";
import { hostProofProviderCalls } from "./provider-calls.js";
import { hostProofAttemptFailure } from "./attempt-failure.js";

/** The real SDK, CLI, managed extension and realistic fixture, with only model replies scripted. */
export async function runFluxNodeHostProof(command: FluxNodeHostProofCommand, options: {
  repositoryRoot: string;
  fluxiqRepositoryRoot: string;
  environment: NodeJS.ProcessEnv;
}): Promise<{ passed: boolean; scope: "lifecycle" | "complete"; flowAcceptance: "not-run" | "passed" | "failed"; report: string }> {
  assertRealisticScenarios([command.scenarioId], "lab fluxnode-host");
  if (command.scenarioId !== "company-website" || command.taskId !== "company-website-apprentices") throw new Error("This managed-host proof covers company-website / company-website-apprentices.");
  const paths = resolveLabPaths(options.repositoryRoot, options.environment);
  const manifest = await loadScenarioManifest(options.repositoryRoot, command.scenarioId, paths.scenarioLabDist);
  const task = (await loadLiveInstructionTasks(paths.scenarioLabDist)).find((candidate) => candidate.id === command.taskId && candidate.scenarioId === command.scenarioId);
  if (!task || task.judgeBy !== "expected-dataset") throw new Error("The host proof requires a declared dataset task on this realistic scenario.");
  const expected = [manifest.expected, ...(manifest.workflows ?? []).map((workflow) => workflow.expected)]
    .flatMap((expectation) => expectation.extracted ?? []).find((entry) => entry.step === task.expectedDatasetId)?.records;
  if (!expected?.length) throw new Error("A scraping host proof requires nonempty, record-by-record expected fixture data.");
  const marker = randomUUID();
  const evidenceDirectory = path.join(paths.runsDirectory, "fluxnode-host-proof", marker);
  const dataDir = path.join(evidenceDirectory, "engine");
  await mkdir(dataDir, { recursive: true });
  const reportPath = path.join(evidenceDirectory, "report.json");
  const stopping = new AbortController();
  let diagnosticFailure: ScriptedModelCall | undefined;
  const script = scriptedModelScriptFor(task.id);
  const scripted = await startScriptedModelServer({ key: scriptedModelKey(), script, onCall: (call) => {
    if (!call.answered || call.correlationId === undefined) {
      diagnosticFailure ??= call;
      stopping.abort(new Error(`The scripted fixture refused or could not attribute ${call.kind} request ${call.ordinal}.`));
    }
  } });
  let lab: { origin: string; frameOrigin: string; close(): Promise<void> };
  try {
    const labModule = await import(pathToFileURL(paths.scenarioEntrypoint).href) as { startScenarioLab(input: { runToken: string; seed: number }): Promise<typeof lab> };
    lab = await labModule.startScenarioLab({ runToken: `host-proof-${marker}`, seed: 4519 });
  } catch (error) {
    await scripted.close();
    throw error;
  }
  const environment = { ...scriptedModelChildEnvironment(providerFreeEnvironment(options.environment), scripted.origin),
    FLUXIQ_CONFIG_DIR: path.join(dataDir, "sdk-config"), FLUXIQ_HOST_MODULE: path.join(import.meta.dirname, "proof-host-module.js"),
    FLUXIQ_LAB_HOST_MODULE: paths.hostModulePath, FLUXIQ_BROWSER_EXTENSION_PATH: paths.extensionPath, FLUXIQ_HOST_PROOF_MARKER: marker,
    FLUXIQ_HOST_PROOF_START_URL: new URL(manifest.startPath, lab.origin).href,
    FLUXIQ_HOST_PROOF_SCENARIO_ORIGINS: JSON.stringify([lab.origin, lab.frameOrigin]) };
  let engine: Awaited<ReturnType<typeof startProofEngine>> | undefined;
  const attempts: Array<Record<string, unknown>> = [];
  const stages: Array<{ name: string; events: Array<Record<string, unknown>> }> = [];
  const checks: Record<string, boolean> = {};
  let failure: string | undefined;
  try {
    engine = await startProofEngine({ coreRoot: options.fluxiqRepositoryRoot, dataDir, evidenceDirectory, environment, hosts: command.hosts, marker });
    stages.push({ name: "initial", events: engine.events });
    const originalProfiles = await engine.profiles();
    if (originalProfiles.length !== command.hosts) throw new Error("The owned browser process/profile count does not match --hosts.");
    if (!command.lifecycleOnly) {
    const sdk = await FluxIQ.connect({ url: engine.apiUrl, env: environment, cwd: dataDir });
    const columns = Object.keys(expected[0]!).sort();
    const sameRows = (outputs: unknown): boolean => Array.isArray(outputs) && outputs.length === expected.length
      && outputs.every((row: unknown, index) => row !== null && typeof row === "object" && !Array.isArray(row)
        && JSON.stringify(Object.keys(row).sort()) === JSON.stringify(columns)
        && columns.every((column) => (row as Record<string, unknown>)[column] === expected[index]![column]));
    const node = (name: string) => defineFluxNode({ name, runtime: "web-automation", goal: task.instruction,
      start: new URL(manifest.startPath, lab.origin).href, scope: { sites: [new URL(lab.origin).host], acts: [] },
      outputs: z.array(z.object({ name: z.string(), role: z.string(), branch: z.string() }).strict()),
      check: ({ outputs }) => sameRows(outputs) || "The rows differ from the fixture's explicit expected dataset.", options: { budgetUsd: 5 } });
    const nodes = [node("proof.apprentices-a"), node("proof.apprentices-b")];
    const saved = new Map<string, Awaited<ReturnType<FluxIQ["exportFlow"]>>>();
    const execute = async (target: typeof nodes[number], ordinal: number): Promise<RunOutcome<unknown>> => {
      const predecessor = saved.get(target.name);
      const before = predecessor ? await sdk.exportFlow(target.name) : undefined;
      const startedAt = Date.now();
      const result = await sdk.run(target, {}, { signal: stopping.signal });
      await engine!.flushEvents();
      const scriptedRequests = scripted.calls().filter((call) => call.correlationId === result.runId).length;
      const actions = engine!.events.filter((event) => event.type === "proof.action" && event.runId === result.runId);
      const sessionIds = [...new Set(actions.map((event) => event.sessionId).filter((id): id is string => typeof id === "string"))];
      const hostIds = [...new Set(actions.map((event) => event.hostId).filter((id): id is string => typeof id === "string"))];
      if (result.status !== "achieved" || !sameRows(result.outputs)) {
        const attemptFailure = hostProofAttemptFailure({ name: target.name, ordinal, status: result.status, runId: result.runId, calls: scripted.calls(), diagnosticFailure });
        attempts.push({ name: target.name, ordinal, status: result.status, runId: result.runId, path: result.path, flowId: result.flowId, sessionIds, hostIds,
          engineModelDecisions: result.cost.calls, scriptedProviderRequests: scriptedRequests, paidProviderCalls: 0, billedUsd: 0,
          engineRecordedUsd: result.cost.usd, runtimeMs: Date.now() - startedAt, rowCount: Array.isArray(result.outputs) ? result.outputs.length : null, failure: attemptFailure });
        throw new Error(attemptFailure.message);
      }
      const after = await sdk.exportFlow(target.name);
      const continued = !attempts.some((attempt) => attempt.runId === result.runId) && (!predecessor || before !== undefined && hostProofContinuation({ predecessor, before, result, scriptedRequests }));
      attempts.push({ name: target.name, ordinal, runId: result.runId, path: result.path, flowId: result.flowId, sessionIds, hostIds,
        predecessor: predecessor ? { flowId: predecessor.flowId, flowVersion: predecessor.flowVersion, stepsDigest: predecessor.stepsDigest } : null,
        saved: { flowId: after.flowId, flowVersion: after.flowVersion, stepsDigest: after.stepsDigest }, continuationProven: continued,
        engineModelDecisions: result.cost.calls, scriptedProviderRequests: scriptedRequests, paidProviderCalls: 0, billedUsd: 0,
        engineRecordedUsd: result.cost.usd, runtimeMs: Date.now() - startedAt, rowCount: expected.length });
      saved.set(target.name, after);
      if (!continued) throw new Error(`Host attempt ${target.name}/${ordinal} did not run its predecessor's saved Flow with zero model decisions.`);
      if (sessionIds.length !== 1 || hostIds.length !== 1) throw new Error(`Host attempt ${target.name}/${ordinal} did not prove command ownership by exactly one leased host/session.`);
      return result;
    };
    await finishProofGroup(nodes.map(async (target) => {
      for (let ordinal = 1; ordinal <= command.attempts; ordinal++) await execute(target, ordinal);
    }));
    const parallel = await finishProofGroup(nodes.map((target) => execute(target, command.attempts + 1)));
    const sessionsFor = (runId: string): Set<unknown> => new Set(engine!.events.filter((event) => event.type === "proof.action" && event.runId === runId).map((event) => event.sessionId));
    const firstSessions = sessionsFor(parallel[0]!.runId);
    const secondSessions = sessionsFor(parallel[1]!.runId);
    checks.concurrentIsolation = firstSessions.size === 1 && secondSessions.size === 1 && [...firstSessions][0] !== [...secondSessions][0];
    checks.noLeaseFailures = !engine.events.some((event) => event.failureCode === "host_lease.missing" || event.failureCode === "host_lease.stale");
    }
    const readyBefore = engine.events.filter((event) => event.type === "proof.session" && event.hostId === "host-1").length;
    const otherReadyBefore = engine.events.filter((event) => event.type === "proof.session" && event.hostId !== "host-1").length;
    engine.child.send({ type: "proof.crash", hostId: "host-1" });
    await engine.waitFor(() => engine!.events.filter((event) => event.type === "proof.session" && event.hostId === "host-1").length > readyBefore, "a fresh host to re-enrol after an actual browser crash");
    checks.crashRecovery = true;
    checks.crashIsolation = engine.events.filter((event) => event.type === "proof.session" && event.hostId !== "host-1").length === otherReadyBefore;
    const beforeReaperLoss = await engine.profiles();
    if (beforeReaperLoss.length !== command.hosts) throw new Error("Crash recovery did not restore every owned browser process.");
    const sessionsBeforeReaperLoss = engine.events.filter((event) => event.type === "proof.session").length;
    engine.child.send({ type: "proof.reaper-loss" });
    await engine.waitFor(() => engine!.events.filter((event) => event.type === "proof.session").length >= sessionsBeforeReaperLoss + command.hosts, "every fresh host to close and re-enrol after reaper loss");
    checks.reaperLossClosesProtectedProfiles = await allAbsent(beforeReaperLoss);
    const freshProfiles = [...new Set([...originalProfiles, ...beforeReaperLoss, ...await engine.profiles()])];
    await engine.stop();
    checks.normalShutdown = await allAbsent(freshProfiles);
    engine = await startProofEngine({ coreRoot: options.fluxiqRepositoryRoot, dataDir, evidenceDirectory, environment, hosts: command.hosts, marker: `${marker}-hard` });
    stages.push({ name: "hard-death", events: engine.events });
    const hardProfiles = await engine.profiles();
    if (hardProfiles.length !== command.hosts) throw new Error("Hard-death proof did not observe every owned browser profile before termination.");
    await engine.stop(true);
    await engine.waitFor(() => allAbsent(hardProfiles), "the reaper to remove every fresh profile after hard engine death");
    checks.hardDeathReaped = true;
    engine = await startProofEngine({ coreRoot: options.fluxiqRepositoryRoot, dataDir, evidenceDirectory, environment, hosts: command.hosts, marker: `${marker}-named`, profile: "proof" });
    stages.push({ name: "named-first", events: engine.events });
    const namedProfiles = await engine.profiles();
    await engine.stop();
    checks.namedRetained = namedProfiles.length === command.hosts && await allPresent(namedProfiles);
    engine = await startProofEngine({ coreRoot: options.fluxiqRepositoryRoot, dataDir, evidenceDirectory, environment, hosts: command.hosts, marker: `${marker}-resume`, profile: "proof" });
    stages.push({ name: "named-resume", events: engine.events });
    checks.namedResumed = engine.events.filter((event) => event.type === "proof.ticket").length === 0;
    await engine.stop();
    checks.networkContained = stages.every((stage) => !stage.events.some((event) => event.type === "proof.network" && event.violations !== 0));
    checks.scriptAccepted = scripted.refusals().length === 0;
    checks.lifecycleMadeNoModelCalls = command.lifecycleOnly !== true || scripted.calls().length === 0;
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  } finally {
    await engine?.stop().catch((error: unknown) => {
      const cleanup = `Proof cleanup failed: ${error instanceof Error ? error.message : String(error)}`;
      failure = failure ? `${failure} ${cleanup}` : cleanup;
    });
    await Promise.all([lab.close(), scripted.close()]);
    const accounting = hostProofProviderCalls(scripted.calls(), attempts.flatMap((attempt) => typeof attempt.runId === "string" ? [attempt.runId] : []));
    checks.providerCallsAttributed = accounting.unattributed === 0 && accounting.unknown === 0;
    checks.distinctRunAttempts = accounting.distinctRuns;
    if (!checks.providerCallsAttributed) {
      const attribution = `${accounting.unattributed} provider requests were unattributed and ${accounting.unknown} belonged to no completed run.`;
      failure = failure ? `${failure} ${attribution}` : attribution;
    }
    await writeFile(reportPath, JSON.stringify({ scope: command.lifecycleOnly ? "lifecycle" : "complete", flowAcceptance: command.lifecycleOnly ? "NOT RUN" : failure || Object.values(checks).some((check) => !check) ? "failed" : "passed",
      scenario: command.scenarioId, task: command.taskId, expectedRows: expected.length, browser: "Chromium", buildTarget: "e2e-chromium", startingPage: manifest.startPath, attempts, checks, stages,
      engineModelDecisions: checks.providerCallsAttributed && checks.distinctRunAttempts ? attempts.reduce((sum, attempt) => sum + Number(attempt.engineModelDecisions), 0) : null,
      providerRequestAccounting: accounting, scriptedCalls: scripted.calls(),
      scriptedProviderRequests: scripted.calls().length, paidProviderCalls: 0, billedUsd: 0, ...(failure ? { failure } : {}) }, null, 2));
  }
  const passed = failure === undefined && Object.values(checks).every(Boolean);
  return { passed, scope: command.lifecycleOnly ? "lifecycle" : "complete", flowAcceptance: command.lifecycleOnly ? "not-run" : passed ? "passed" : "failed", report: reportPath };
}

async function finishProofGroup<T>(work: readonly Promise<T>[]): Promise<T[]> {
  const outcomes = await Promise.allSettled(work);
  const errors = outcomes.flatMap((outcome) => outcome.status === "rejected" ? [outcome.reason as unknown] : []);
  if (errors.length) throw new AggregateError(errors, errors.map((error) => error instanceof Error ? error.message : String(error)).join("; "));
  return outcomes.flatMap((outcome) => outcome.status === "fulfilled" ? [outcome.value] : []);
}

async function allAbsent(paths: readonly string[]): Promise<boolean> {
  return (await Promise.all(paths.map(async (profile) => {
    try {
      await access(profile);
      return false;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return true;
      throw error;
    }
  }))).every(Boolean);
}

async function allPresent(paths: readonly string[]): Promise<boolean> {
  return (await Promise.all(paths.map(async (profile) => {
    try {
      await access(profile);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }
  }))).every(Boolean);
}
