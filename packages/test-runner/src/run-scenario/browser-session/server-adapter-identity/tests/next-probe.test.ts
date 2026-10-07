import assert from "node:assert/strict";
import { createServer } from "node:net";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import { FluxIQ } from "fluxiq";
import { prepareCoreWebBuild, coreWebServerProcessSpec, serverAdapterBuild } from "../../../../core-web-build/index.js";
import { ProcessSupervisor } from "../../../../process-supervisor.js";
import { withoutProviderSecrets } from "../../../../environment.js";
import { verifyRunningServerAdapterIdentity } from "../index.js";

async function freePort(): Promise<number> {
  const server = createServer(); await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const address = server.address(); assert.ok(address && typeof address === "object"); const port = address.port;
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); return port;
}
// PREPARED ONLY. The supervisor must record explicit current-session panel authorization before enabling this flag.
test("opt-in copied native artifact through actual production Next restricted diagnostic", { timeout: 840_000, skip: process.env.FLUXIQ_SERVER_ADAPTER_NEXT_PROBE !== "1" }, async t => {
  const downstream = process.env.FLUXIQ_SERVER_ADAPTER_DOWNSTREAM_ROOT ?? fileURLToPath(new URL("../../../../../../..", import.meta.url));
  const core = process.env.FLUXIQ_SERVER_ADAPTER_CORE_ROOT ?? path.resolve(downstream, "../!FluxIQ");
  // Short isolated cache paths preserve the Windows production build path budget.
  const intendedParent = await realpath(path.dirname(path.resolve(core))), rootName = `np-${randomUUID().slice(0, 8)}`;
  const root = path.resolve(intendedParent, rootName); await mkdir(root);
  const supervisor = new ProcessSupervisor(), stateRoot = path.join(root, "state"), countPath = path.join(root, "provider-count.json"), trapPath = path.join(root, "trap.mjs");
  let seed: FluxIQ | undefined;
  try {
    await writeFile(countPath, "0");
    await writeFile(trapPath, `import { writeFileSync } from 'node:fs';
const original = globalThis.fetch; let count = 0;
globalThis.fetch = (input, options) => { const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url); if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) { writeFileSync(process.env.FLUXIQ_PROBE_COUNT_PATH, String(++count)); throw new Error('Isolated proof refuses outbound fetch'); } return original(input, options); };
`);
    seed = FluxIQ.create({ rootDir: stateRoot, loadEnv: false, modelProvidersEnabled: false }); await seed.setup();
    const user = await seed.programs.identityAccess.upsertUser({ username: "isolated-identity-proof", displayName: "Isolated proof", roleId: "viewer" });
    const session = await seed.programs.identityAccess.createSession(user.id); await seed.close(); seed = undefined;
    const build = await prepareCoreWebBuild({ fluxiqRepositoryRoot: core, cacheRoot: path.join(root, "cache"), supervisor, logPath: path.join(root, "build.log") });
    await serverAdapterBuild.validateCopy(core, build.webDirectory);
    const port = await freePort(), gatewayPort = await freePort(), origin = `http://127.0.0.1:${port}`;
    supervisor.start(coreWebServerProcessSpec({ name: "owned-next-identity-proof", build, port, logPath: path.join(root, "next.log"), env: { ...withoutProviderSecrets(process.env),
      FLUXIQ_ROOT: stateRoot, FLUXIQ_MODEL_PROVIDERS_ENABLED: "false", FLUXIQ_CLIENT_GATEWAY_ENABLED: "true", FLUXIQ_CLIENT_GATEWAY_PORT: String(gatewayPort),
      FLUXIQ_HOST_MODULE: "", FLUXIQ_HOST_ROOT: stateRoot, FLUXIQ_PROBE_COUNT_PATH: countPath, NEXT_TELEMETRY_DISABLED: "1", NODE_OPTIONS: `--import=${pathToFileURL(trapPath).href}` } }));
    const endpoint = `${origin}/api/programs/automation-studio/get-runtime-build-identity`;
    const read = async (reachedInputs: string[]) => {
      const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json", cookie: `fluxiq_session=${session.id}` }, body: JSON.stringify({ reachedInputs }), signal: AbortSignal.timeout(5000) });
      assert.equal(response.status, 200); return response.json();
    };
    const deadline = Date.now() + 60_000; let ready = false;
    while (Date.now() < deadline) { try { await read(["packages/fluxiq/dist/index.js"]); ready = true; break; } catch { await new Promise(resolve => setTimeout(resolve, 250)); } }
    assert.ok(ready, "Owned production Next diagnostic did not become ready");
    assert.equal((await fetch(endpoint, { method: "POST", body: "{}", signal: AbortSignal.timeout(5000) })).status, 401);
    const records: unknown[] = [];
    await verifyRunningServerAdapterIdentity({ readRuntimeBuildIdentity: read }, core, async record => { records.push(record); }, path.join(build.webDirectory, ".server-runtime/client-gateway-server.mjs"));
    assert.equal(await readFile(countPath, "utf8"), "0");
    const record = records.at(-1) as { verified: boolean; actual: { artifactDigest: string } }; assert.equal(record.verified, true);
    t.diagnostic(`Actual isolated production Next copied artifact matched ${record.actual.artifactDigest}; unauthenticated request refused; outbound fetch count 0; no chat/provider operation requested.`);
  } finally {
    if (seed) await seed.close();
    await supervisor.cleanup(); assert.equal(supervisor.activeProcessCount, 0);
    const resolvedRoot = await realpath(root);
    assert.equal(path.dirname(resolvedRoot), intendedParent, "Cleanup target must be an immediate child of the intended worktree parent");
    assert.equal(path.basename(resolvedRoot), rootName, "Cleanup target must retain its owned random name");
    assert.match(rootName, /^np-[0-9a-f]{8}$/);
    assert.equal(resolvedRoot, root, "Cleanup refuses a redirected or replaced root");
    await rm(resolvedRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
});
