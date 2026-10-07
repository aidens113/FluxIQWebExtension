import assert from "node:assert/strict";
import { fork, type ChildProcess } from "node:child_process";
import { cp, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import { chromium } from "@playwright/test";
import { verifyRunningCoreIdentity } from "../index.js";

// Synthetic authenticated transport, actual built Core service/handler. No user's panel.
test("retained actual service refuses a regenerated artifact and fresh Chromium-reached server matches", { timeout: 180_000, skip: process.env.FLUXIQ_CORE_IDENTITY_PROBE !== "1" }, async (t) => {
  const coreRoot = process.env.FLUXIQ_IDENTITY_CORE_ROOT ?? fileURLToPath(new URL("../../../../../../../../!FluxIQ", import.meta.url));
  const extensionPath = process.env.FLUXIQ_IDENTITY_EXTENSION_PATH ?? fileURLToPath(new URL("../../../../../../../apps/extension/dist/e2e-chromium", import.meta.url));
  const root = await mkdtemp(path.join(tmpdir(), "actual-core-identity-probe-"));
  const copiedCore = path.join(root, "core");
  let child: ChildProcess | undefined;
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  try {
    for (const pkg of ["fluxiq", "contracts"]) {
      for (const dir of ["src", "dist"]) await cp(path.join(coreRoot, `packages/${pkg}/${dir}`), path.join(copiedCore, `packages/${pkg}/${dir}`), { recursive: true });
      await cp(path.join(coreRoot, `packages/${pkg}/package.json`), path.join(copiedCore, `packages/${pkg}/package.json`));
    }
    await symlink(path.join(coreRoot, "packages/fluxiq/node_modules"), path.join(copiedCore, "packages/fluxiq/node_modules"), "junction");
    const host = path.join(root, "host.mjs");
    await writeFile(host, `
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const root = process.argv[2];
const { AutomationStudioService } = await import(pathToFileURL(path.join(root, 'packages/fluxiq/dist/programs/automation-studio/runtime/service.js')));
const { registerRuntimeIdentityEndpoint } = await import(pathToFileURL(path.join(root, 'packages/fluxiq/dist/programs/automation-studio/api/handlers/diagnostics/runtime-identity.js')));
const service = new AutomationStudioService({ seedFixture: false });
let endpoint, dispatches = 0;
for (const method of ['runRuntimeSession', 'generateFlowBootstrapAdaptation']) service[method] = () => { dispatches++; throw new Error('Provider/chat dispatch forbidden in identity proof'); };
registerRuntimeIdentityEndpoint({ registry: { register: entry => { endpoint = entry; } }, service });
const server = createServer(async (request, response) => {
  if (request.url === '/') { response.setHeader('content-type','text/html'); response.end('<!doctype html><title>Owned identity probe</title>'); return; }
  if (request.headers.authorization !== 'Bearer isolated-public-test-token') { response.writeHead(401); response.end('{}'); return; }
  let body = ''; for await (const bytes of request) body += bytes;
  response.setHeader('content-type', 'application/json');
  try { response.end(JSON.stringify(request.url === '/dispatch-count' ? { dispatches } : await endpoint.handler({ payload: JSON.parse(body) }))); }
  catch { response.writeHead(400); response.end('{}'); }
});
server.listen(0, '127.0.0.1', () => process.send({ port: server.address().port }));
process.on('message', async message => {
  if (message === 'reload-route') {
    const updated = await import(pathToFileURL(path.join(root, 'packages/fluxiq/dist/programs/automation-studio/api/handlers/diagnostics/runtime-identity.js')).href + '?reloaded');
    updated.registerRuntimeIdentityEndpoint({ registry: { register: entry => { endpoint = entry; } }, service });
    process.send({ reloaded: true });
  }
  if (message === 'close') { await service.close(); server.close(() => process.exit(0)); }
});
`);
    const launch = async () => {
      child = fork(host, [copiedCore], { stdio: ["ignore", "ignore", "ignore", "ipc"] });
      const message = await new Promise<{ port: number }>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Owned Core identity child did not start")), 20_000);
        child!.once("message", value => { clearTimeout(timer); resolve(value as { port: number }); });
        child!.once("exit", code => { clearTimeout(timer); reject(new Error(`Owned Core identity child exited ${code}`)); });
      });
      return `http://127.0.0.1:${message.port}`;
    };
    const close = async () => { if (child && child.exitCode === null) { const ended = new Promise<void>(resolve => child!.once("exit", () => resolve())); child.send("close"); await ended; } child = undefined; };
    let origin = await launch();
    await page.goto(origin);
    const request = async (reachedInputs: string[]) => page.evaluate(async ({ origin, reachedInputs }) => (await fetch(`${origin}/api/programs/automation-studio/get-runtime-build-identity`, { method: "POST", headers: { authorization: "Bearer isolated-public-test-token", "content-type": "application/json" }, body: JSON.stringify({ reachedInputs }) })).json(), { origin, reachedInputs });
    const reports: unknown[] = [];
    let admittedDispatches = 0;
    const dispatch = async () => { await verifyRunningCoreIdentity({ readRuntimeBuildIdentity: request }, copiedCore, extensionPath, async record => { reports.push(record); }); admittedDispatches++; };
    assert.equal((await page.request.post(`${origin}/api/programs/automation-studio/get-runtime-build-identity`, { data: {} })).status(), 401);
    await dispatch(); assert.equal(admittedDispatches, 1);
    const before = (reports.at(-1) as { actual: { artifactDigest: string } }).actual.artifactDigest;
    const sourcePath = path.join(copiedCore, "packages/fluxiq/src/runtime/build-identity/read.ts");
    const source = await readFile(sourcePath, "utf8");
    await writeFile(sourcePath, source + "\nexport const isolatedIdentityBuildRevision = 2;\n");
    await assert.rejects(dispatch, /provider dispatch refused/); assert.equal(admittedDispatches, 1);
    // Regenerate changed executable code through TypeScript, then the owning stamp generator.
    const ts = createRequire(import.meta.url)("typescript") as typeof import("typescript");
    await writeFile(path.join(copiedCore, "packages/fluxiq/dist/runtime/build-identity/read.js"), ts.transpileModule(await readFile(sourcePath, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText);
    const { buildCoreRuntimeIdentity } = await import(pathToFileURL(path.join(coreRoot, "scripts/runtime-build-identity/index.mjs")).href) as { buildCoreRuntimeIdentity(root: string): Promise<{ artifactDigest: string }> };
    const after = await buildCoreRuntimeIdentity(copiedCore);
    assert.notEqual(after.artifactDigest, before);
    const reloaded = new Promise<unknown>(resolve => child!.once("message", resolve));
    child!.send("reload-route"); assert.deepEqual(await reloaded, { reloaded: true });
    await assert.rejects(dispatch, /provider dispatch refused/); assert.equal(admittedDispatches, 1);
    assert.equal((reports.at(-1) as { actual: { artifactDigest: string } }).actual.artifactDigest, before);
    const count = await (await page.request.get(`${origin}/dispatch-count`, { headers: { authorization: "Bearer isolated-public-test-token" } })).json();
    assert.equal(count.dispatches, 0);
    await close(); origin = await launch(); await page.goto(origin);
    await dispatch(); assert.equal(admittedDispatches, 2);
    assert.equal((reports.at(-1) as { actual: { artifactDigest: string } }).actual.artifactDigest, after.artifactDigest);
    const finalCount = await (await page.request.get(`${origin}/dispatch-count`, { headers: { authorization: "Bearer isolated-public-test-token" } })).json();
    assert.equal(finalCount.dispatches, 0);
    t.diagnostic(`Headed Chromium ${browser.version()}; actual Core service/handler; initial match, stale source refused, regenerated disk/reloaded route/retained service refused, fresh process matched; zero chat/provider calls; normalized artifact ${after.artifactDigest}`);
    await close();
  } finally {
    if (child && child.exitCode === null) { child.kill(); await new Promise<void>(resolve => child!.once("exit", () => resolve())); }
    await browser.close();
    await rm(path.join(copiedCore, "packages/fluxiq/node_modules"), { force: true });
    await rm(root, { recursive: true, force: true });
  }
});
