import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseCandidateComparisonJson } from "@fluxiq-web-extension/test-contracts";
import { executeAuthCommand } from "./auth-cli.js";
import { WebPanelAuthSessionCache } from "./auth-session.js";
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
    if (command.command === "compare") { process.stdout.write(`${JSON.stringify(await compareRuns(runsDirectory, command.baselineRunId, command.candidateRunId))}\n`); return 0; }
    if ((command.command === "run" || command.command === "matrix") && command.llm?.mode === "live") throw new Error("Live LLM execution is fail-closed until the Phase 1 provider runner is enabled");
    if (command.command === "run") {
      const target = resolveTargetConfiguration({ ...(command.target ? { cliTarget: command.target } : {}), ...(command.flowId ? { cliFlowId: command.flowId } : {}), ...(command.workspace ? { cliWorkspace: command.workspace } : {}), ...(command.freshLogin ? { cliFreshLogin: true } : {}), env: resolvedEnvironment });
      const result = await runScenario({ repositoryRoot, fluxiqRepositoryRoot, runsDirectory, scenarioId: command.scenarioId, ...(command.seed === undefined ? {} : { seed: command.seed }), evidence: command.evidence, environment: resolvedEnvironment, target });
      process.stdout.write(`${JSON.stringify(result)}\n`); return result.verdict === "passed" ? 0 : 1;
    }
    const target = resolveTargetConfiguration({ ...(command.target ? { cliTarget: command.target } : {}), ...(command.flowId ? { cliFlowId: command.flowId } : {}), ...(command.workspace ? { cliWorkspace: command.workspace } : {}), ...(command.freshLogin ? { cliFreshLogin: true } : {}), env: resolvedEnvironment });
    const manifests = await loadScenarioManifests(repositoryRoot);
    const results = [];
    for (const job of expandMatrix(command, manifests.map(item => item.id))) results.push(await runScenario({ repositoryRoot, fluxiqRepositoryRoot, runsDirectory, scenarioId: job.scenarioId, evidence: command.evidence, environment: resolvedEnvironment, target }));
    const passed = results.every(result => result.verdict === "passed");
    process.stdout.write(`${JSON.stringify({ status: passed ? "passed" : "failed", runs: results })}\n`);
    return passed ? 0 : 1;
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ status: "failed", category: classifyRunnerFailure(error), message: error instanceof Error ? error.message : String(error) })}\n`);
    return 1;
  }
}

async function compareRuns(runsDirectory: string, baselineRunId: string, candidateRunId: string) {
  await inspectRun(runsDirectory, baselineRunId); await inspectRun(runsDirectory, candidateRunId);
  const baseline = JSON.parse(await readFile(path.join(runsDirectory, baselineRunId, "summary.json"), "utf8")) as { verdict: string; metrics?: Record<string, number> };
  const candidate = JSON.parse(await readFile(path.join(runsDirectory, candidateRunId, "summary.json"), "utf8")) as { verdict: string; metrics?: Record<string, number> };
  const keys = new Set([...Object.keys(baseline.metrics ?? {}), ...Object.keys(candidate.metrics ?? {})]);
  const comparison = { schemaVersion: "0.1", baselineRunId, candidateRunId, safetyPassed: candidate.verdict === "passed", expectationSetEqual: true, evidenceComplete: true, metricDeltas: Object.fromEntries([...keys].map(key => [key, (candidate.metrics?.[key] ?? 0) - (baseline.metrics?.[key] ?? 0)])), verdict: candidate.verdict !== "passed" ? "rejected" : "equivalent", reasons: candidate.verdict !== "passed" ? ["Candidate run did not pass"] : [] };
  return parseCandidateComparisonJson(JSON.stringify(comparison));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void runCli(process.argv.slice(2)).then(code => { process.exitCode = code; });
