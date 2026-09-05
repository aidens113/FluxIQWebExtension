import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { removeRunOwnedTopologyState, startTopology } from "./coordinator.js";
import { ProcessSupervisor } from "./process-supervisor.js";
import type { ExistingTargetConfiguration } from "./target-config.js";

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
  const healthChecks: string[] = [];
  let topology: Awaited<ReturnType<typeof startTopology>> | undefined;
  try {
    topology = await startTopology({ repositoryRoot, fluxiqRepositoryRoot: path.join(root, "unused-core"), runsDirectory: path.join(root, "owned-runs"), target }, supervisor, { waitForHttp: async url => { healthChecks.push(url); return new Response("ok"); } });
    assert.equal(topology.targetMode, "existing");
    assert.equal(topology.fluxiqOrigin, target.baseUrl);
    assert.equal(topology.gatewayUrl, target.gatewayUrl);
    assert.deepEqual(healthChecks, [target.baseUrl, `${topology.scenarioOrigin}/__control/health`]);
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
