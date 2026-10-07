import assert from "node:assert/strict";
import { fork, spawn, type ChildProcess } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { chromium } from "@playwright/test";
import { verifyRunningServerAdapterIdentity } from "../index.js";

function tail(previous: string, bytes: Buffer): string { return Buffer.concat([Buffer.from(previous), bytes.subarray(-4096)]).subarray(-4096).toString("utf8"); }
async function exited(child: ChildProcess, ms: number): Promise<boolean> {
  if (child.exitCode !== null || child.signalCode !== null) return true;
  return new Promise(resolve => { const done = () => { clearTimeout(timer); child.removeListener("exit", done); resolve(true); }; const timer = setTimeout(() => { child.removeListener("exit", done); resolve(false); }, ms); child.once("exit", done); });
}
async function stop(child: ChildProcess, graceful = false): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  if (graceful && child.connected) child.send("close");
  if (graceful && await exited(child, 3000)) return;
  child.kill("SIGKILL"); if (!await exited(child, 5000)) throw new Error("Owned server proof child did not stop.");
}
// Real native artifact/socket/retained service; synthetic restricted HTTP. This never launches Next or a user panel.
test("executing native socket identity survives route reload, refuses changed factory on retained gateway, fresh process matches", { timeout: 180_000, skip: process.env.FLUXIQ_SERVER_ADAPTER_PROBE !== "1" }, async t => {
  const downstream = process.env.FLUXIQ_SERVER_ADAPTER_DOWNSTREAM_ROOT ?? fileURLToPath(new URL("../../../../../../..", import.meta.url));
  const core = process.env.FLUXIQ_SERVER_ADAPTER_CORE_ROOT ?? path.resolve(downstream, "../!FluxIQ");
  const root = await mkdtemp(path.join(tmpdir(), "actual-server-identity-")), copied = path.join(root, "core");
  const browser = await chromium.launch({ headless: true }); const page = await browser.newPage();
  let child: ChildProcess | undefined, build: ChildProcess | undefined;
  try {
    for (const dir of ["apps/web/src/server", "apps/web/scripts", "scripts/build-cache", "apps/web/.server-runtime"]) await cp(path.join(core, dir), path.join(copied, dir), { recursive: true });
    for (const file of ["apps/web/src/lib/fluxiq.ts", "apps/web/src/instrumentation.ts", "apps/web/package.json", "package.json", "pnpm-lock.yaml"]) { await mkdir(path.dirname(path.join(copied, file)), { recursive: true }); await cp(path.join(core, file), path.join(copied, file)); }
    await symlink(path.join(core, "node_modules"), path.join(copied, "node_modules"), "junction");
    await symlink(path.join(core, "apps/web/node_modules"), path.join(copied, "apps/web/node_modules"), "junction");
    const artifact = path.join(copied, "apps/web/.server-runtime/client-gateway-server.mjs"), script = path.join(root, "server.mjs");
    await writeFile(script, `
import { createServer } from 'node:http';
import path from 'node:path'; import { pathToFileURL } from 'node:url';
const [core, artifact, stateRoot] = process.argv.slice(2);
const { FluxIQ } = await import(pathToFileURL(path.join(core, 'packages/fluxiq/dist/index.js')));
const routePath = path.join(core, 'packages/fluxiq/dist/programs/automation-studio/api/handlers/diagnostics/runtime-identity.js');
let dispatches = 0, connects = 0, listeners = 0, revision = 0, endpoint;
globalThis.fetch = async () => { dispatches++; throw new Error('Provider/network forbidden'); };
const fluxiq = FluxIQ.create({ rootDir: stateRoot, loadEnv: false, modelProvidersEnabled: false });
const service = fluxiq.programs.automationStudio, gateway = fluxiq.programs.clientGateway;
for (const method of ['generateFlowBootstrapAdaptation', 'runRuntimeSession']) service[method] = () => { dispatches++; throw new Error('Chat forbidden'); };
const connect = gateway.connect.bind(gateway); gateway.connect = (...args) => { connects++; return connect(...args); };
const factory = (await import(pathToFileURL(artifact))).startClientGatewayWebSocketServer;
const handle = factory({ gateway, host: '127.0.0.1', port: 0 }); listeners++;
await new Promise((resolve, reject) => { handle.server.once('listening', resolve); handle.server.once('error', reject); });
const register = module => module.registerRuntimeIdentityEndpoint({ registry: { register: entry => { endpoint = entry; } }, service, clientGateway: gateway });
register(await import(pathToFileURL(routePath)));
const http = createServer(async (request, response) => {
  if (request.url === '/') { response.setHeader('content-type', 'text/html'); response.end('<!doctype html><title>Owned adapter proof</title>'); return; }
  if (request.headers.authorization !== 'Bearer isolated-public-test-token') { response.writeHead(401); response.end('{}'); return; }
  let body = ''; for await (const chunk of request) body += chunk;
  response.setHeader('content-type', 'application/json');
  try { response.end(JSON.stringify(request.url === '/counts' ? { dispatches, connects, listeners } : await endpoint.handler({ payload: JSON.parse(body) }))); }
  catch { response.writeHead(400); response.end('{}'); }
});
http.listen(0, '127.0.0.1', () => process.send({ port: http.address().port, socketPort: handle.server.address().port }));
process.on('message', async message => {
  if (message === 'reload-route') { register(await import(pathToFileURL(routePath).href + '?adapter-route=' + (++revision))); process.send({ routeReloaded: true }); }
  if (message === 'rebind') {
    const before = listeners;
    try { const changed = await import(pathToFileURL(artifact).href + '?adapter-factory=' + (++revision)); changed.startClientGatewayWebSocketServer({ gateway, host: '127.0.0.1', port: 0 }); listeners++; process.send({ refused: false, listeners: listeners - before }); }
    catch (error) { process.send({ refused: /identity changed/.test(error.message), listeners: listeners - before }); }
  }
  if (message === 'legacy') { gateway.bindTransportBuildIdentity().activate(); process.send({ legacy: true }); }
  if (message === 'close') { await handle.close(); await fluxiq.close(); http.close(() => process.exit(0)); }
});
`);
    const message = async (command: string) => { const received = new Promise<unknown>((resolve, reject) => { const timer = setTimeout(() => reject(new Error(`Owned adapter IPC timeout: ${command}`)), 20_000); child!.once("message", value => { clearTimeout(timer); resolve(value); }); }); child!.send(command); return received; };
    const launch = async () => {
      child = fork(script, [core, artifact, path.join(root, `state-${Date.now()}`)], { stdio: ["ignore", "ignore", "pipe", "ipc"] });
      let errors = ""; child.stderr!.on("data", bytes => { errors = tail(errors, bytes as Buffer); });
      return new Promise<{ port: number; socketPort: number }>((resolve, reject) => { const timer = setTimeout(() => reject(new Error(`Owned adapter startup timeout: ${errors}`)), 20_000); child!.once("message", value => { clearTimeout(timer); resolve(value as { port: number; socketPort: number }); }); child!.once("exit", code => { clearTimeout(timer); reject(new Error(`Owned adapter exited ${code}: ${errors}`)); }); });
    };
    let started = await launch(), origin = `http://127.0.0.1:${started.port}`; await page.goto(origin);
    const request = async (reachedInputs: string[]) => page.evaluate(async ({ origin, reachedInputs }) => (await fetch(`${origin}/identity`, { method: "POST", headers: { authorization: "Bearer isolated-public-test-token", "content-type": "application/json" }, body: JSON.stringify({ reachedInputs }) })).json(), { origin, reachedInputs });
    const records: unknown[] = []; let admissions = 0;
    const admit = async () => { await verifyRunningServerAdapterIdentity({ readRuntimeBuildIdentity: request }, copied, async record => { records.push(record); }); admissions++; };
    assert.equal((await page.request.post(`${origin}/identity`, { data: {} })).status(), 401);
    await admit(); assert.equal(admissions, 1);
    await page.evaluate(async port => new Promise<void>((resolve, reject) => { const socket = new WebSocket(`ws://127.0.0.1:${port}/client`); const timer = setTimeout(() => { socket.close(); reject(new Error("Actual socket timeout")); }, 5000); socket.onopen = () => socket.close(); socket.onclose = () => { clearTimeout(timer); resolve(); }; socket.onerror = () => { clearTimeout(timer); reject(new Error("Actual socket failed")); }; }), started.socketPort);
    const counts = async () => (await page.request.get(`${origin}/counts`, { headers: { authorization: "Bearer isolated-public-test-token" } })).json();
    assert.equal((await counts()).connects, 1);
    const before = (records.at(-1) as { actual: { artifactDigest: string } }).actual.artifactDigest;
    const reader = path.join(copied, "apps/web/src/server/build-identity/read.ts"), source = await readFile(reader, "utf8"); assert.ok(source.includes("return Object.freeze(identity);"));
    await writeFile(reader, source.replace("return Object.freeze(identity);", "return Object.freeze({ ...identity });"));
    await assert.rejects(admit, /provider dispatch refused/);
    await new Promise<void>((resolve, reject) => {
      build = spawn(process.execPath, [path.join(copied, "apps/web/scripts/build-client-gateway-server.mjs")], { stdio: ["ignore", "ignore", "pipe"], windowsHide: true }); let errors = "";
      build.stderr!.on("data", bytes => { errors = tail(errors, bytes as Buffer); }); const timer = setTimeout(() => { build!.kill("SIGKILL"); reject(new Error(`Copied native build timeout: ${errors}`)); }, 20_000);
      build.once("error", error => { clearTimeout(timer); reject(error); }); build.once("exit", code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(`Copied native build failed ${code}: ${errors}`)); });
    }); build = undefined;
    const after = JSON.parse(await readFile(`${artifact}.identity.json`, "utf8")).identity; assert.notEqual(after.artifactDigest, before);
    assert.deepEqual(await message("reload-route"), { routeReloaded: true }); await assert.rejects(admit, /provider dispatch refused/); assert.equal(admissions, 1);
    assert.deepEqual(await message("rebind"), { refused: true, listeners: 0 });
    assert.deepEqual(await message("legacy"), { legacy: true }); assert.equal((await request(["packages/fluxiq/dist/index.js"])).payload.serverTransportIdentity, null); await assert.rejects(admit, /provider dispatch refused/);
    assert.deepEqual(await message("rebind"), { refused: true, listeners: 0 }); assert.equal((await counts()).dispatches, 0);
    await stop(child!, true); child = undefined; started = await launch(); origin = `http://127.0.0.1:${started.port}`; await page.goto(origin); await admit(); assert.equal(admissions, 2);
    assert.equal((records.at(-1) as { actual: { artifactDigest: string } }).actual.artifactDigest, after.artifactDigest); assert.equal((await counts()).dispatches, 0);
    t.diagnostic(`Chromium ${browser.version()}; actual built Core + generated native server + real socket; retained/reloaded route refused current artifact, changed factory refused before listener IO, legacy cleared without resetting anchor, fresh process matched ${after.artifactDigest}; zero provider/chat invocation; synthetic authenticated HTTP only, no Next.`);
    await stop(child!, true); child = undefined;
  } finally {
    try { if (child) await stop(child); } finally { try { if (build) await stop(build); } finally { await browser.close(); await rm(path.join(copied, "apps/web/node_modules"), { force: true }); await rm(path.join(copied, "node_modules"), { force: true }); await rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } }
  }
});
