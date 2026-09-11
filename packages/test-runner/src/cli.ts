import path from "node:path";
import { pathToFileURL } from "node:url";
import { executeAuthCommand } from "./auth-cli.js";
import { WebPanelAuthSessionCache } from "./auth-session.js";
import { compareBenchCommand, findBenchCorpus, runBench } from "./bench/index.js";
import { ClonePackageCache } from "./clone-cache.js";
import { parseLabCommand, expandMatrix } from "./commands.js";
import { classifyRunnerFailure } from "./failure.js";
import { inspectRun } from "./inspect.js";
import { runInteractiveSession } from "./interactive-session.js";
import { runScenario } from "./run-scenario.js";
import { loadScenarioManifests } from "./scenarios.js";
import { loadTestEnvironment, resolveAuthScopeConfiguration, resolveCloneCacheScopeConfiguration, resolveInteractiveTargetConfiguration, resolveTargetConfiguration } from "./target-config.js";

export async function runCli(argv: string[], env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const repositoryRoot = path.resolve(env.FLUXIQ_WEB_EXTENSION_ROOT ?? process.cwd());
  try {
    const resolvedEnvironment = await loadTestEnvironment(repositoryRoot, env);
    const fluxiqRepositoryRoot = path.resolve(resolvedEnvironment.FLUXIQ_CORE_ROOT ?? path.join(repositoryRoot, "..", "!FluxIQ"));
    const runsDirectory = path.resolve(resolvedEnvironment.FLUXIQ_TEST_RUNS_DIR ?? path.join(repositoryRoot, "test-runs"));
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
      const comparison = await compareBenchCommand({ runsDirectory, cwd: process.cwd(), ...("halvesReport" in command ? { halvesOf: command.halvesReport } : { baseline: command.baselineReport, candidate: command.candidateReport }) });
      process.stdout.write(`${JSON.stringify(comparison)}\n`); return comparison.outcome === "regressed" ? 1 : 0;
    }
    if (command.command === "bench") {
      const corpus = findBenchCorpus(command.corpusId);
      const target = resolveTargetConfiguration({ ...(command.target ? { cliTarget: command.target } : {}), ...(command.workspace ? { cliWorkspace: command.workspace } : {}), env: resolvedEnvironment });
      const outcome = await runBench({ corpus, repeatCount: command.repeat, target, manifests: await loadScenarioManifests(repositoryRoot), repositoryRoot, fluxiqRepositoryRoot, runsDirectory, environment: resolvedEnvironment, ...(command.evidence ? { evidence: command.evidence } : {}), runScenario, inspectRun });
      process.stdout.write(`${JSON.stringify(outcome)}\n`); return outcome.status === "passed" ? 0 : 1;
    }
    if ((command.command === "run" || command.command === "matrix") && command.llm?.mode === "live") throw new Error("Live LLM execution is fail-closed until the Phase 1 provider runner is enabled");
    if (command.command === "run") {
      const target = resolveTargetConfiguration({ ...(command.target ? { cliTarget: command.target } : {}), ...(command.flowId ? { cliFlowId: command.flowId } : {}), ...(command.workspace ? { cliWorkspace: command.workspace } : {}), ...(command.freshLogin ? { cliFreshLogin: true } : {}), env: resolvedEnvironment });
      const result = await runScenario({ repositoryRoot, fluxiqRepositoryRoot, runsDirectory, scenarioId: command.scenarioId, ...(command.seed === undefined ? {} : { seed: command.seed }), ...(command.workflowId ? { workflowId: command.workflowId } : {}), ...(command.evidence ? { evidence: command.evidence } : {}), environment: resolvedEnvironment, target });
      process.stdout.write(`${JSON.stringify(result)}\n`); return result.verdict === "passed" ? 0 : 1;
    }
    const target = resolveTargetConfiguration({ ...(command.target ? { cliTarget: command.target } : {}), ...(command.flowId ? { cliFlowId: command.flowId } : {}), ...(command.workspace ? { cliWorkspace: command.workspace } : {}), ...(command.freshLogin ? { cliFreshLogin: true } : {}), env: resolvedEnvironment });
    const manifests = await loadScenarioManifests(repositoryRoot);
    const results = [];
    for (const job of expandMatrix(command, manifests.map(item => item.id))) results.push(await runScenario({ repositoryRoot, fluxiqRepositoryRoot, runsDirectory, scenarioId: job.scenarioId, ...(command.evidence ? { evidence: command.evidence } : {}), environment: resolvedEnvironment, target }));
    const passed = results.every(result => result.verdict === "passed");
    process.stdout.write(`${JSON.stringify({ status: passed ? "passed" : "failed", runs: results })}\n`);
    return passed ? 0 : 1;
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ status: "failed", category: classifyRunnerFailure(error), message: error instanceof Error ? error.message : String(error) })}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void runCli(process.argv.slice(2)).then(code => { process.exitCode = code; });
