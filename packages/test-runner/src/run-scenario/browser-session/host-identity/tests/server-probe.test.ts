import assert from "node:assert/strict";
import { fork, spawn, type ChildProcess } from "node:child_process";
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { chromium } from "@playwright/test";
import { verifyRunningHostIdentity } from "../index.js";


function boundedStderr(previous: string, bytes: Buffer): string {
  return Buffer.concat([Buffer.from(previous), bytes.subarray(-4096)]).subarray(-4096).toString("utf8").slice(-4096);
}
async function waitExit(child: ChildProcess, milliseconds: number): Promise<boolean> {
  if (child.exitCode !== null || child.signalCode !== null) return true;
  return new Promise(resolve => {
    const finish = () => { clearTimeout(timer); child.removeListener("exit", finish); resolve(true); };
    const timer = setTimeout(() => { child.removeListener("exit", finish); resolve(false); }, milliseconds);
    child.once("exit", finish);
  });
}
async function stopOwnedChild(child: ChildProcess, graceful = false): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  if (graceful && child.connected) child.send("close");
  if (graceful && await waitExit(child, 3000)) return;
  child.kill("SIGKILL");
  if (!await waitExit(child, 5000)) throw new Error("Owned host proof child failed bounded shutdown.");
}

// Real loaded built host and real Core owner/handler; synthetic authenticated HTTP, no user panel.
test("actual retained host refuses changed rebind before IO; legacy clears attestation and fresh process matches", { timeout: 180_000, skip: process.env.FLUXIQ_HOST_IDENTITY_PROBE !== "1" }, async t => {
  const downstream = process.env.FLUXIQ_HOST_IDENTITY_DOWNSTREAM_ROOT ?? fileURLToPath(new URL("../../../../../../..", import.meta.url));
  const core = process.env.FLUXIQ_HOST_IDENTITY_CORE_ROOT ?? path.resolve(downstream, "../!FluxIQ");
  const root = await mkdtemp(path.join(tmpdir(), "actual-host-identity-")), copied = path.join(root, "downstream");
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  let child: ChildProcess | undefined, ownedBuild: ChildProcess | undefined;
  try {
    for (const dir of ["domain/src", "domain/scripts", "domain/dist/host", "scripts/build-cache"]) await cp(path.join(downstream, dir), path.join(copied, dir), { recursive: true });
    await cp(path.join(downstream, "domain/package.json"), path.join(copied, "domain/package.json"));
    await symlink(path.join(downstream, "domain/node_modules"), path.join(copied, "domain/node_modules"), "junction");
    const hostPath = path.join(copied, "domain/dist/host/web-panel-host.mjs"), server = path.join(root, "server.mjs");
    await writeFile(server, `
import { createServer } from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const [core, hostPath, stateRoot] = process.argv.slice(2);
const { FluxIQ } = await import(pathToFileURL(path.join(core, 'packages/fluxiq/dist/index.js')));
const { AutomationStudioNativeNodeRuntime } = await import(pathToFileURL(path.join(core, 'packages/fluxiq/dist/programs/automation-studio/index.js')));
const { registerRuntimeIdentityEndpoint } = await import(pathToFileURL(path.join(core, 'packages/fluxiq/dist/programs/automation-studio/api/handlers/diagnostics/runtime-identity.js')));
let dispatches = 0, mutations = 0, revision = 0, endpoint;
globalThis.fetch = async () => { dispatches++; throw new Error('Network/provider forbidden in host proof'); };
const fluxiq = FluxIQ.create({ rootDir: stateRoot, loadEnv: false, modelProvidersEnabled: false });
const service = fluxiq.programs.automationStudio;
for (const method of ['generateFlowBootstrapAdaptation', 'runRuntimeSession']) service[method] = () => { dispatches++; throw new Error('Chat/provider forbidden in host proof'); };
for (const method of ['registerDomain', 'registerDomainIo']) { const original = fluxiq[method].bind(fluxiq); fluxiq[method] = (...args) => { mutations++; return original(...args); }; }
for (const method of ['registerRecordingDomain', 'bindRuntimeService', 'bindHostRuntime', 'bindLlmEvidenceRuntime']) { const original = service[method].bind(service); service[method] = (...args) => { mutations++; return original(...args); }; }
const registerAdapter = fluxiq.runtime.registerAdapter.bind(fluxiq.runtime); fluxiq.runtime.registerAdapter = (...args) => { mutations++; return registerAdapter(...args); };
const loaded = await import(pathToFileURL(hostPath)); loaded.registerFluxIQHost(fluxiq);
registerRuntimeIdentityEndpoint({ registry: { register: entry => { endpoint = entry; } }, service });
const http = createServer(async (request, response) => {
  if (request.url === '/') { response.setHeader('content-type', 'text/html'); response.end('<!doctype html><title>Owned built-host proof</title>'); return; }
  if (request.headers.authorization !== 'Bearer isolated-public-test-token') { response.writeHead(401); response.end('{}'); return; }
  let body = ''; for await (const bytes of request) body += bytes;
  response.setHeader('content-type', 'application/json');
  try { response.end(JSON.stringify(request.url === '/counts' ? { dispatches, mutations } : await endpoint.handler({ payload: JSON.parse(body) }))); }
  catch { response.writeHead(400); response.end('{}'); }
});
http.listen(0, '127.0.0.1', () => process.send({ port: http.address().port, mutations }));
process.on('message', async message => {
  if (message === 'reload-route') {
    const refreshed = await import(pathToFileURL(path.join(core, 'packages/fluxiq/dist/programs/automation-studio/api/handlers/diagnostics/runtime-identity.js')).href + '?host-proof-route=' + (++revision));
    refreshed.registerRuntimeIdentityEndpoint({ registry: { register: entry => { endpoint = entry; } }, service });
    process.send({ routeReloaded: true });
  }
  if (message === 'legacy') { service.bindNativeNodeRuntime(new AutomationStudioNativeNodeRuntime()); process.send({ legacy: true }); }
  if (message === 'rebind') {
    const before = mutations;
    try { const changed = await import(pathToFileURL(hostPath).href + '?revision=' + (++revision)); changed.registerFluxIQHost(fluxiq); process.send({ refused: false, mutations: mutations - before }); }
    catch (error) { process.send({ refused: /identity changed/.test(error.message), mutations: mutations - before }); }
  }
  if (message === 'close') { await fluxiq.close(); http.close(() => process.exit(0)); }
});
`);
    const message = async (command: string) => {
      const received = new Promise<unknown>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Owned host child timed out: ${command}`)), 20_000);
        child!.once("message", value => { clearTimeout(timer); resolve(value); });
      }); child!.send(command); return received;
    };
    const launch = async () => {
      child = fork(server, [core, hostPath, path.join(root, `state-${Date.now()}`)], { stdio: ["ignore", "ignore", "pipe", "ipc"] });
      let errors = ""; child.stderr!.on("data", bytes => { errors = boundedStderr(errors, bytes as Buffer); });
      const started = await new Promise<{ port: number; mutations: number }>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Owned actual host did not start")), 20_000);
        child!.once("message", value => { clearTimeout(timer); resolve(value as { port: number; mutations: number }); });
        child!.once("exit", code => { clearTimeout(timer); reject(new Error(`Owned actual host exited ${code}: ${errors}`)); });
      }); assert.ok(started.mutations > 0); return `http://127.0.0.1:${started.port}`;
    };
    const close = async () => { if (child) await stopOwnedChild(child, true); child = undefined; };
    let origin = await launch(); await page.goto(origin);
    const request = async (reachedInputs: string[]) => page.evaluate(async ({ origin, reachedInputs }) => (await fetch(`${origin}/identity`, { method: "POST", headers: { authorization: "Bearer isolated-public-test-token", "content-type": "application/json" }, body: JSON.stringify({ reachedInputs }) })).json(), { origin, reachedInputs });
    const records: unknown[] = []; let simulatedAdmissions = 0;
    const admit = async () => { await verifyRunningHostIdentity({ readRuntimeBuildIdentity: request }, copied, hostPath, async record => { records.push(record); }); simulatedAdmissions++; };
    assert.equal((await page.request.post(`${origin}/identity`, { data: {} })).status(), 401);
    await admit(); assert.equal(simulatedAdmissions, 1);
    const before = (records.at(-1) as { actual: { artifactDigest: string } }).actual.artifactDigest;
    const readerPath = path.join(copied, "domain/src/host-build-identity/read.ts");
    const readerSource = await readFile(readerPath, "utf8"); assert.ok(readerSource.includes("return Object.freeze(identity);"));
    await writeFile(readerPath, readerSource.replace("return Object.freeze(identity);", "return Object.freeze({ ...identity });"));
    await assert.rejects(admit, /provider dispatch refused/); assert.equal(simulatedAdmissions, 1);
    // The actual owning esbuild driver regenerates both executable and companion; no hand-edited stamp.
    await new Promise<void>((resolve, reject) => {
      const build = ownedBuild = spawn(process.execPath, [path.join(copied, "domain/scripts/build-web-panel-host.mjs")], { stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
      let errors = ""; build.stderr!.on("data", bytes => { errors = boundedStderr(errors, bytes as Buffer); });
      const timer = setTimeout(() => { build.kill("SIGKILL"); reject(new Error(`Copied owning host build timed out: ${errors}`)); }, 20_000);
      build.once("error", error => { clearTimeout(timer); reject(error); });
      build.once("exit", code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(`Copied owning host build failed ${code}: ${errors}`)); });
    });
    ownedBuild = undefined;
    assert.ok((await readFile(hostPath, "utf8")).includes("return Object.freeze({ ...identity });"));
    const after = JSON.parse(await readFile(`${hostPath}.identity.json`, "utf8")).identity;
    assert.notEqual(after.artifactDigest, before);
    assert.deepEqual(await message("reload-route"), { routeReloaded: true });
    await assert.rejects(admit, /provider dispatch refused/); assert.equal(simulatedAdmissions, 1);
    assert.deepEqual(await message("rebind"), { refused: true, mutations: 0 });
    assert.deepEqual(await message("legacy"), { legacy: true });
    const legacy = await request(["packages/fluxiq/dist/index.js"]); assert.deepEqual(legacy.payload.loadedModules, []);
    await assert.rejects(admit, /provider dispatch refused/);
    assert.deepEqual(await message("rebind"), { refused: true, mutations: 0 });
    const counts = await (await page.request.get(`${origin}/counts`, { headers: { authorization: "Bearer isolated-public-test-token" } })).json(); assert.equal(counts.dispatches, 0);
    await close(); origin = await launch(); await page.goto(origin); await admit(); assert.equal(simulatedAdmissions, 2);
    assert.equal((records.at(-1) as { actual: { artifactDigest: string } }).actual.artifactDigest, after.artifactDigest);
    const final = await (await page.request.get(`${origin}/counts`, { headers: { authorization: "Bearer isolated-public-test-token" } })).json(); assert.equal(final.dispatches, 0);
    t.diagnostic(`Headed Chromium ${browser.version()}; actual built Core+domain host; stale source refused, regenerated host/reloaded actual route refused by retained service, changed rebind refused with zero IO mutation, legacy cleared attestation without resetting anchor, fresh process matched; zero chat/provider calls; normalized host ${after.artifactDigest}`);
    await close();
  } finally {
    try { if (child) await stopOwnedChild(child); } finally {
      try { if (ownedBuild) await stopOwnedChild(ownedBuild); } finally {
        await browser.close();
        await rm(path.join(copied, "domain/node_modules"), { force: true });
        await rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
      }
    }
  }
});
