import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { executeAuthCommand } from "./auth-cli.js";
import { WebPanelAuthSessionCache } from "./auth-session.js";
import { benchDirectory, buildCampaignCompatibility, compareBenchCloseoutCommand, compareBenchCommand, createResumableBench, createShardedBench, findBenchCorpus, loadCampaignManifest, resumeBench, resumeShardedBench, type RunBenchOutcome } from "./bench/index.js";
import { ClonePackageCache } from "./clone-cache.js";
import { parseLabCommand, expandMatrix } from "./commands.js";
import { classifyRunnerFailure } from "./failure.js";

import { inspectRun } from "./inspect.js";
import { beginLiveLlmRun } from "./live-llm/index.js";
import { resolveLabPaths } from "./lab-instance/index.js";
import { runInteractiveSession } from "./interactive-session.js";
import { runScenario } from "./run-scenario.js";
import { loadScenarioManifests } from "./scenarios.js";
import { loadTestEnvironment, resolveAuthScopeConfiguration, resolveCloneCacheScopeConfiguration, resolveInteractiveTargetConfiguration, resolveTargetConfiguration } from "./target-config.js";

export async function runCli(argv: string[], env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const repositoryRoot = path.resolve(env.FLUXIQ_WEB_EXTENSION_ROOT ?? process.cwd());
  try {
    const resolvedEnvironment = await loadTestEnvironment(repositoryRoot, env);
    const fluxiqRepositoryRoot = path.resolve(resolvedEnvironment.FLUXIQ_CORE_ROOT ?? path.join(repositoryRoot, "..", "!FluxIQ"));
    const labPaths = resolveLabPaths(repositoryRoot, resolvedEnvironment);
    const runsDirectory = labPaths.runsDirectory;
    const command = parseLabCommand(argv);
    if (command.command === "interactive") {
      const target = resolveInteractiveTargetConfiguration({ ...(command.target ? { cliTarget: command.target } : {}), ...(command.workspace ? { cliWorkspace: command.workspace } : {}), ...(command.freshLogin ? { cliFreshLogin: true } : {}), env: resolvedEnvironment });
      if (target.mode === "clone") throw new Error("interactive mode does not support clone targets");
      await runInteractiveSession({ repositoryRoot, fluxiqRepositoryRoot, runsDirectory, scenarioId: command.scenarioId, ...(command.seed === undefined ? {} : { seed: command.seed }), environment: resolvedEnvironment, target });
      return 0;
    }
    if (command.command === "auth") {
      const scope = resolveAuthScopeConfiguration(resolvedEnvironment);
      process.stdout.write(`${JSON.stringify(await executeAuthCommand(new WebPanelAuthSessionCache(runsDirectory), command.operation, scope))}\n`);
      return 0;
    }
    if (command.command === "clone-cache") {
      const scope = resolveCloneCacheScopeConfiguration(resolvedEnvironment);
      const cache = new ClonePackageCache(runsDirectory);
      const status = command.operation === "status" ? await cache.status(scope) : await cache.clear(scope);
      process.stdout.write(`${JSON.stringify({ command: `clone-cache.${command.operation}`, ...status, ...(command.operation === "refresh" ? { effect: "invalidated; refresh occurs on the next clone run" } : {}) })}\n`);
      return 0;
    }
    if (command.command === "inspect") { process.stdout.write(`${JSON.stringify(await inspectRun(runsDirectory, command.runId))}\n`); return 0; }
    if (command.command === "compare") {
      const comparison = "halvesReport" in command
        ? await compareBenchCommand({ runsDirectory, cwd: process.cwd(), halvesOf: command.halvesReport })
        : await compareBenchCloseoutCommand({ runsDirectory, cwd: process.cwd(), baseline: command.baselineReport, candidate: command.candidateReport, sharedLoad: command.sharedLoad });
      process.stdout.write(`${JSON.stringify(comparison)}\n`);
      return "comparisonPassed" in comparison ? (comparison.comparisonPassed ? 0 : 1) : comparison.outcome === "regressed" ? 1 : 0;
    }
    if (command.command === "bench") {
      const savedManifest = "resumeBenchId" in command ? await loadCampaignManifest(benchDirectory(runsDirectory, command.resumeBenchId)) : null;
      const request = savedManifest?.request ?? null;
      const corpus = findBenchCorpus(request?.corpusId ?? ("corpusId" in command ? command.corpusId : ""));
      const target = resolveTargetConfiguration({
        ...("resumeBenchId" in command
          ? { cliTarget: request!.target.mode, ...(request!.target.workspace === null ? {} : { cliWorkspace: request!.target.workspace }) }
          : { ...(command.target ? { cliTarget: command.target } : {}), ...(command.workspace ? { cliWorkspace: command.workspace } : {}) }),
        env: resolvedEnvironment,
      });
      const manifests = await loadScenarioManifests(repositoryRoot, labPaths.scenarioLabDist);
      const compatibility = await buildCampaignCompatibility({
        repositoryRoot,
        fluxiqRepositoryRoot,
        testRunnerBuildPath: path.dirname(fileURLToPath(import.meta.url)),
        extensionBuildPath: labPaths.extensionPath,
        scenarioLabBuildPath: labPaths.scenarioLabDist,
      });
      const shared = { corpus, target, manifests, repositoryRoot, fluxiqRepositoryRoot, runsDirectory, environment: resolvedEnvironment, runScenario, inspectRun, compatibility, lifecycle: reportBenchLifecycle };
      const machineSlotsDirectory = path.join(os.tmpdir(), "fluxiq-testing-lab-machine-slots");
      let outcome: RunBenchOutcome;
      if ("resumeBenchId" in command) {
        const resume = { ...shared, benchId: command.resumeBenchId, repeatCount: request!.repeatCount, ...(request!.evidence === null ? {} : { evidence: request!.evidence }) };
        if (savedManifest!.execution.mode === "serial") outcome = await resumeBench(resume);
        else if (savedManifest!.execution.mode === "shard-parent") outcome = await resumeShardedBench({ ...resume, machineSlotsDirectory });
        else throw new Error("A shard child cannot be resumed as a logical bench campaign");
      } else if (command.shards === undefined) {
        outcome = await createResumableBench({ ...shared, repeatCount: command.repeat, ...(command.evidence ? { evidence: command.evidence } : {}) });
      } else {
        outcome = await createShardedBench({ ...shared, repeatCount: command.repeat, ...(command.evidence ? { evidence: command.evidence } : {}), shardCount: command.shards, jobs: command.jobs ?? Math.min(command.shards, 2), machineSlotsDirectory });
      }
      process.stdout.write(`${JSON.stringify(outcome)}\n`); return outcome.status === "passed" ? 0 : 1;
    }
    if (command.command === "run") {
      const target = resolveTargetConfiguration({ ...(command.target ? { cliTarget: command.target } : {}), ...(command.flowId ? { cliFlowId: command.flowId } : {}), ...(command.workspace ? { cliWorkspace: command.workspace } : {}), ...(command.freshLogin ? { cliFreshLogin: true } : {}), env: resolvedEnvironment });
      // Before the run, so an unexecutable profile or an absent credential is a
      // refusal an operator can read, rather than a sanitized facility failure
      // reported from inside a run that had already started a browser.
      const live = command.llm ? await beginLiveLlmRun({ profile: command.llm, repositoryRoot, environment: resolvedEnvironment, flowLane: command.flowLane === true, targetMode: target.mode }) : undefined;
      const result = await runScenario({ repositoryRoot, fluxiqRepositoryRoot, runsDirectory, scenarioId: command.scenarioId, ...(command.seed === undefined ? {} : { seed: command.seed }), ...(command.workflowId ? { workflowId: command.workflowId } : {}), ...(command.variantId ? { variantId: command.variantId } : {}), ...(command.flowLane ? { flow: true } : {}), ...(command.evidence ? { evidence: command.evidence } : {}), ...(live ? { live } : {}), environment: resolvedEnvironment, target });
      process.stdout.write(`${JSON.stringify(result)}\n`); return result.verdict === "passed" ? 0 : 1;
    }
    const target = resolveTargetConfiguration({ ...(command.target ? { cliTarget: command.target } : {}), ...(command.flowId ? { cliFlowId: command.flowId } : {}), ...(command.workspace ? { cliWorkspace: command.workspace } : {}), ...(command.freshLogin ? { cliFreshLogin: true } : {}), env: resolvedEnvironment });
    const manifests = await loadScenarioManifests(repositoryRoot, labPaths.scenarioLabDist);
    const results = [];
    // A live matrix is one scenario at one repeat (`parseLabCommand`), and it
    // runs the Flow lane because that is the only lane a provider is authorized
    // against; `runScenario` refuses the combination otherwise.
    const matrixLive = command.llm ? await beginLiveLlmRun({ profile: command.llm, repositoryRoot, environment: resolvedEnvironment, flowLane: true, targetMode: target.mode }) : undefined;
    for (const job of expandMatrix(command, manifests.map(item => item.id))) results.push(await runScenario({ repositoryRoot, fluxiqRepositoryRoot, runsDirectory, scenarioId: job.scenarioId, ...(command.evidence ? { evidence: command.evidence } : {}), ...(matrixLive ? { live: matrixLive, flow: true } : {}), environment: resolvedEnvironment, target }));
    const passed = results.every(result => result.verdict === "passed");
    process.stdout.write(`${JSON.stringify({ status: passed ? "passed" : "failed", runs: results })}\n`);
    return passed ? 0 : 1;
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ status: "failed", category: classifyRunnerFailure(error), message: error instanceof Error ? error.message : String(error) })}\n`);
    return 1;
  }
}

function reportBenchLifecycle(record: Readonly<{ event: string; benchId: string; directory: string }>): void {
  if (record.event === "created" || record.event === "resumed") process.stderr.write(`${JSON.stringify({ event: `bench-campaign-${record.event}`, benchId: record.benchId, directory: record.directory })}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void runCli(process.argv.slice(2)).then(code => { process.exitCode = code; });
