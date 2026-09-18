import assert from "node:assert/strict";
import type { ChildProcess, SpawnOptions } from "node:child_process";
import { EventEmitter } from "node:events";
import { mkdtemp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import test from "node:test";
import { removeRunOwnedTopologyState, startTopology } from "../coordinator.js";
import { RunnerFailure } from "../failure.js";
import { ProcessSupervisor } from "../process-supervisor.js";
import type { ExistingTargetConfiguration } from "../target-config.js";

test("existing topology starts only Scenario Lab and never owns the external FluxIQ lifecycle", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-existing-topology-"));
  const repositoryRoot = path.join(root, "repository");
  const scenarioEntrypoint = path.join(repositoryRoot, "apps", "scenario-lab", "dist", "server.js");
  const externalSentinel = path.join(root, "external-fluxiq-state.txt");
  await mkdir(path.dirname(scenarioEntrypoint), { recursive: true });
  await writeFile(scenarioEntrypoint, "setInterval(() => {}, 1000);\n", "utf8");
  await writeFile(externalSentinel, "must survive runner cleanup", "utf8");

  const externalServer = createServer((_request, response) => { response.statusCode = 200; response.end("ok"); });
  await new Promise<void>((resolve, reject) => { externalServer.once("error", reject); externalServer.listen(0, "127.0.0.1", resolve); });
  const address = externalServer.address();
  if (!address || typeof address === "string") throw new Error("external test server did not bind");
  const target: ExistingTargetConfiguration = {
    mode: "existing",
    baseUrl: `http://127.0.0.1:${address.port}`,
    gatewayUrl: "ws://127.0.0.1:39001/client",
    projectId: "existing-project",
    flowId: "existing-flow",
    credentials: { username: "runner", password: "secret", authorizationPin: "123456" },
  };
  const supervisor = new ProcessSupervisor();
  const healthChecks: Array<{ url: string; operationStage: string | undefined }> = [];
  let topology: Awaited<ReturnType<typeof startTopology>> | undefined;
  try {
    topology = await startTopology({ repositoryRoot, fluxiqRepositoryRoot: path.join(root, "unused-core"), runsDirectory: path.join(root, "owned-runs"), target }, supervisor, { waitForHttp: async (url, options) => { healthChecks.push({ url, operationStage: options?.operationStage }); return new Response("ok"); } });
    assert.equal(topology.targetMode, "existing");
    assert.equal(topology.fluxiqOrigin, target.baseUrl);
    assert.equal(topology.gatewayUrl, target.gatewayUrl);
    assert.deepEqual(healthChecks, [
      { url: target.baseUrl, operationStage: "core.health" },
      { url: `${topology.scenarioOrigin}/__control/health`, operationStage: "scenario.health" },
    ]);
    assert.deepEqual(Object.keys(topology.processExitCodes()), ["scenario-lab"]);
    await stat(topology.allocation.browserProfileDir);

    await topology.close();
    assert.equal(supervisor.activeProcessCount, 0);
    assert.equal(externalServer.listening, true);
    await stat(externalSentinel);

    await removeRunOwnedTopologyState(topology);
    await assert.rejects(stat(topology.allocation.runRoot), error => typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT");
    assert.equal(externalServer.listening, true);
    await stat(externalSentinel);
  } finally {
    await topology?.close().catch(() => undefined);
    await new Promise<void>(resolve => externalServer.close(() => resolve()));
    await rm(root, { recursive: true, force: true });
  }
});

test("every coordinator HTTP readiness wait has its closed service stage", async () => {
  const source = await readFile(path.resolve(import.meta.dirname, "..", "..", "src", "coordinator.ts"), "utf8");
  assert.equal(source.match(/waitForHttp\(`\$\{scenarioOrigin\}\/__control\/health`, \{\s+operationStage: "scenario\.health"/gu)?.length, 2);
  assert.equal(source.match(/waitForHttp\(fluxiqOrigin, \{\s+operationStage: "core\.health"/gu)?.length, 1);
  assert.equal(source.match(/waitForHttp\(target\.baseUrl, \{\s+operationStage: "core\.health"/gu)?.length, 1);
  assert.match(source, /new RunnerFailure\("gateway\.connection", `Timed out waiting for client gateway/u, "the TCP wait remains a separate gateway diagnostic");
});

test("existing topology rejects isolated lifecycle options before spawning processes and removes its allocation", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-existing-mixed-"));
  const repositoryRoot = path.join(root, "repository");
  await mkdir(path.join(repositoryRoot, "apps", "scenario-lab", "dist"), { recursive: true });
  await writeFile(path.join(repositoryRoot, "apps", "scenario-lab", "dist", "server.js"), "", "utf8");
  const supervisor = new ProcessSupervisor();
  try {
    await assert.rejects(startTopology({
      repositoryRoot, fluxiqRepositoryRoot: path.join(root, "unused-core"), runsDirectory: path.join(root, "owned-runs"), runId: "mixed-run",
      target: { mode: "existing", baseUrl: "http://127.0.0.1:3000", projectId: "project", flowId: "flow", credentials: { username: "runner", password: "secret", authorizationPin: "123456" } },
      bootstrapIdentity: true,
    }, supervisor, { waitForHttp: async () => new Response("ok") }), /cannot use isolated Core bootstrap/);
    assert.deepEqual(supervisor.processExitCodes(), {});
    await assert.rejects(stat(path.join(root, "owned-runs", "mixed-run")), error => typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT");
  } finally { await supervisor.cleanup(); await rm(root, { recursive: true, force: true }); }
});

test("isolated startup failure removes only its exact allocated run root", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-isolated-startup-failure-"));
  const runsDirectory = path.join(root, "owned-runs");
  const failedRunRoot = path.join(runsDirectory, "failed-run");
  const siblingSentinel = path.join(runsDirectory, "sibling-run", "keep.txt");
  const sourceSentinel = path.join(root, "external-source", "keep.txt");
  await mkdir(path.dirname(siblingSentinel), { recursive: true });
  await mkdir(path.dirname(sourceSentinel), { recursive: true });
  await writeFile(siblingSentinel, "sibling must survive", "utf8");
  await writeFile(sourceSentinel, "source must survive", "utf8");
  const supervisor = new ProcessSupervisor();
  try {
    await assert.rejects(startTopology({
      repositoryRoot: path.join(root, "missing-repository"),
      fluxiqRepositoryRoot: path.join(root, "external-source"),
      runsDirectory,
      runId: "failed-run",
      target: { mode: "isolated" },
      prepareHost: false,
    }, supervisor, { waitForHttp: async () => new Response("must not be reached") }), /Required test topology path is missing/);
    assert.deepEqual(supervisor.processExitCodes(), {});
    await assert.rejects(stat(failedRunRoot), error => typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT");
    assert.equal(await readFile(siblingSentinel, "utf8"), "sibling must survive");
    assert.equal(await readFile(sourceSentinel, "utf8"), "source must survive");
  } finally { await supervisor.cleanup(); await rm(root, { recursive: true, force: true }); }
});

test("isolated startup preserves its primary safe failure when cleanup also fails", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-isolated-primary-failure-"));
  const runsDirectory = path.join(root, "owned-runs");
  class CleanupFailureSupervisor extends ProcessSupervisor {
    override async cleanup(): Promise<void> { throw new Error("cleanup detail must not replace startup failure"); }
  }
  try {
    await assert.rejects(startTopology({
      repositoryRoot: path.join(root, "missing-repository"),
      fluxiqRepositoryRoot: path.join(root, "missing-core"),
      runsDirectory,
      runId: "failed-run",
      target: { mode: "isolated" },
      prepareHost: false,
    }, new CleanupFailureSupervisor(), { waitForHttp: async () => new Response("must not be reached") }), error => {
      assert.ok(error instanceof RunnerFailure);
      assert.equal(error.category, "environment.missing");
      assert.match(error.message, /Required test topology path is missing/);
      assert.doesNotMatch(error.message, /cleanup detail/);
      return true;
    });
    await assert.rejects(stat(path.join(runsDirectory, "failed-run")), error => typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("an isolated startup failure hands every process log to the caller before removing its run root, and Core serves the production build", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-isolated-startup-logs-"));
  const repositoryRoot = path.join(root, "repository");
  const fluxiqRepositoryRoot = path.join(root, "core");
  // As `lab run` calls it: the isolated topology allocates below `.work`, and
  // the shared Core web build lives below the user-visible runs directory.
  const visibleRunsDirectory = path.join(root, "owned-runs");
  const runsDirectory = path.join(visibleRunsDirectory, ".work");
  const scenarioEntrypoint = path.join(repositoryRoot, "apps", "scenario-lab", "dist", "server.js");
  const hostModulePath = path.join(repositoryRoot, "domain", "dist", "web-panel-host.mjs");
  for (const file of [scenarioEntrypoint, hostModulePath, path.join(fluxiqRepositoryRoot, "apps", "web", "package.json")]) {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, "", "utf8");
  }
  const buildRunsDirectories: string[] = [];
  const buildDirectory = path.join(visibleRunsDirectory, ".core-web-build", "0".repeat(24), "b-0123456789ab");
  const build = { key: "0".repeat(24), directory: buildDirectory, webDirectory: path.join(buildDirectory, "apps", "web"), nextExecutable: path.join(fluxiqRepositoryRoot, "next"), buildId: "build-1" };
  const spawned: Array<{ command: string; args: readonly string[]; options: SpawnOptions }> = [];
  const supervisor = new ProcessSupervisor((command, args, options) => {
    spawned.push({ command, args, options });
    const child = fakeChild();
    setImmediate(() => child.stdout.write(command === build.nextExecutable ? "core output\n" : "scenario lab output\n"));
    return child;
  }, async child => exitChild(child as FakeChild, 0));
  const readinessFailure = new RunnerFailure("process.startup", "Core did not become ready");
  let copied: Record<string, string> | undefined;
  try {
    await assert.rejects(startTopology({
      repositoryRoot, fluxiqRepositoryRoot, runsDirectory, coreWebBuildCacheRoot: path.join(visibleRunsDirectory, ".core-web-build"), runId: "failed-run", target: { mode: "isolated" }, prepareHost: false, scenarioEntrypoint, hostModulePath,
      copyStartupFailureLogs: async logsDirectory => {
        copied = {};
        for (const name of (await readdir(logsDirectory)).sort()) copied[name] = await readFile(path.join(logsDirectory, name), "utf8");
      },
    }, supervisor, {
      waitForHttp: async (_url, options) => {
        if (options?.operationStage !== "core.health") return new Response("ok");
        await new Promise(resolve => setTimeout(resolve, 50));
        throw readinessFailure;
      },
      prepareCoreWebBuild: async buildOptions => { buildRunsDirectories.push(buildOptions.cacheRoot ?? "(the Core's own)"); return build; },
    }), (error: unknown) => error === readinessFailure);

    assert.deepEqual(buildRunsDirectories, [path.join(visibleRunsDirectory, ".core-web-build")], "the caller's cache root reaches the build, so a run can still be pointed at a cache of its own");
    assert.deepEqual(Object.keys(copied ?? {}), ["core.log", "scenario-lab.log"], "every process log reached the caller");
    assert.match(copied?.["core.log"] ?? "", /\[stdout\] core output/u);
    assert.match(copied?.["scenario-lab.log"] ?? "", /\[stdout\] scenario lab output/u);
    await assert.rejects(stat(path.join(runsDirectory, "failed-run")), error => typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT");

    const core = spawned.find(item => item.command === build.nextExecutable);
    assert.ok(core, "Core was started");
    assert.deepEqual(core.args, ["start", "--hostname", "127.0.0.1", "--port", core.options.env?.PORT], "Core serves the build on the run's own port");
    assert.equal(core.options.cwd, build.webDirectory);
    assert.equal(core.options.env?.FLUXIQ_ROOT, path.join(runsDirectory, "failed-run", "fluxiq-root"), "the per-run environment is unchanged");
  } finally {
    await supervisor.cleanup().catch(() => undefined);
    await rm(root, { recursive: true, force: true });
  }
});

test("lab run sends a startup failure's process logs through the bundle's own log copy", async () => {
  const source = await readFile(path.resolve(import.meta.dirname, "..", "..", "src", "run-scenario.ts"), "utf8");
  assert.match(source, /topology = await startTopology\(\{[^\n]*\bcopyStartupFailureLogs: logsDirectory => copyProcessLogs\(bundle, logsDirectory\)/u);
  assert.doesNotMatch(source, /coreWebBuildRunsDirectory/u, "the Core web build cache belongs to the Core, not to one run's runs directory: worktrees sharing a Core each had a cache and a lock of their own, and each built it");
  assert.match(source, /async function copyProcessLogs\(bundle: EvidenceBundle, logsDir: string\)/u, "the same redacting copy a run that started uses");
});

type FakeChild = ChildProcess & { stdout: PassThrough; stderr: PassThrough };

function fakeChild(): FakeChild {
  const child = new EventEmitter() as unknown as FakeChild;
  Object.defineProperties(child, {
    stdout: { value: new PassThrough() },
    stderr: { value: new PassThrough() },
    pid: { value: 4_242 },
    exitCode: { value: null, writable: true, configurable: true },
    signalCode: { value: null, writable: true, configurable: true },
  });
  return child;
}

function exitChild(child: FakeChild, code: number): void {
  Object.defineProperty(child, "exitCode", { value: code, writable: true, configurable: true });
  child.emit("exit", code, null);
}
