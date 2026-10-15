// Core's gateway server artifact is generated only when its receipt no longer
// matches its sources, and generating it is bounded by progress rather than by
// a fixed minute a busy machine can exceed (t620, `run-mv93ywox-9b5aa220`).
import assert from "node:assert/strict";
import type { ChildProcess, SpawnOptions } from "node:child_process";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import test, { type TestContext } from "node:test";
import { RunnerFailure } from "../../failure.js";
import { ProcessSupervisor } from "../../process-supervisor.js";
import { serverAdapterBuild } from "../server-adapter.js";

/** One file in every directory and fixed file Core's server source inventory walks. */
const SOURCES: Readonly<Record<string, string>> = {
  "apps/web/src/server/client-gateway-websocket.ts": "export const gateway = 1;\n",
  "apps/web/scripts/build-client-gateway-server.mjs": "// generator\n",
  "scripts/build-cache/index.mjs": "// cache\n",
  "apps/web/src/lib/fluxiq.ts": "export {};\n",
  "apps/web/src/instrumentation.ts": "export {};\n",
  "apps/web/package.json": "{\"version\":\"0.1.0\"}\n",
  "package.json": "{}\n",
  "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
};
const ARTIFACT = "apps/web/.server-runtime/client-gateway-server.mjs";

type Spawned = { command: string; args: readonly string[]; options: SpawnOptions; child: FakeChild };
type Harness = { root: string; logPath: string; spawned: Spawned[]; supervisor: ProcessSupervisor; nextSpawn: () => Promise<Spawned> };

async function withCore(run: (harness: Harness) => Promise<void>): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "gateway-server-build-"));
  const spawned: Spawned[] = [];
  const waiting: Array<(spawn: Spawned) => void> = [];
  const supervisor = new ProcessSupervisor((command, args, options) => {
    const entry = { command, args, options, child: fakeChild() };
    spawned.push(entry);
    waiting.shift()?.(entry);
    return entry.child;
  }, async () => undefined);
  try {
    for (const [file, text] of Object.entries(SOURCES)) await writeText(path.join(root, file), text);
    await run({ root, logPath: path.join(root, "core-web-build.log"), spawned, supervisor, nextSpawn: () => new Promise(resolve => waiting.push(resolve)) });
  } finally {
    await supervisor.cleanup().catch(() => undefined);
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

test("a receipt that matches every current source skips the generator; a changed source generates it again", async () => {
  await withCore(async ({ root, logPath, spawned, supervisor, nextSpawn }) => {
    await stampArtifact(root);
    assert.equal(await serverAdapterBuild.prepare({ fluxiqRepositoryRoot: root, supervisor, logPath }), "reused");
    assert.equal(spawned.length, 0, "a current artifact is not regenerated");
    assert.match(await readFile(`${logPath}.gateway-server.log`, "utf8"), /\[reused\]/u);

    await writeText(path.join(root, "apps/web/src/server/client-gateway-websocket.ts"), "export const gateway = 2;\n");
    const preparing = serverAdapterBuild.prepare({ fluxiqRepositoryRoot: root, supervisor, logPath });
    const generator = await nextSpawn();
    assert.equal(generator.command, process.execPath);
    assert.deepEqual(generator.args, [path.join(root, "apps/web/scripts/build-client-gateway-server.mjs")]);
    await stampArtifact(root);
    exitChild(generator.child, 0);
    assert.equal(await preparing, "generated");
    assert.equal(spawned.length, 1);
  });
});

test("a missing artifact is generated, and a generator that leaves a stale receipt still fails the identity check", async () => {
  await withCore(async ({ root, logPath, supervisor, nextSpawn }) => {
    const preparing = serverAdapterBuild.prepare({ fluxiqRepositoryRoot: root, supervisor, logPath });
    const generator = await nextSpawn();
    await stampArtifact(root);
    await writeText(path.join(root, "package.json"), "{\"changed\":true}\n");
    exitChild(generator.child, 0);
    await assert.rejects(preparing, (error: unknown) => error instanceof RunnerFailure && error.category === "environment.missing" && /stale/u.test(error.message));
  });
});

test("a slow generator that keeps making progress past a minute is not failed", async (t: TestContext) => {
  await withCore(async ({ root, logPath, supervisor, nextSpawn }) => {
    t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 });
    const preparing = serverAdapterBuild.prepare({ fluxiqRepositoryRoot: root, supervisor, logPath });
    const generator = await nextSpawn();
    // Twelve 30 s steps: six minutes in all, longer than the old fixed 60 s
    // and longer than the quiet bound, with output inside every window.
    for (let step = 0; step < 12; step += 1) {
      generator.child.stdout.write(`still bundling ${step}\n`);
      await flush();
      t.mock.timers.tick(30_000);
    }
    assert.ok(Date.now() > serverAdapterBuild.bound.quietMs && Date.now() > 60_000);
    await stampArtifact(root);
    exitChild(generator.child, 0);
    assert.equal(await preparing, "generated");
    t.mock.timers.reset();
  });
});

test("a silent, hung generator fails as a Lab startup failure naming the step, its limit and the elapsed time", async (t: TestContext) => {
  await withCore(async ({ root, logPath, supervisor, nextSpawn }) => {
    t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 0 });
    const preparing = serverAdapterBuild.prepare({ fluxiqRepositoryRoot: root, supervisor, logPath });
    await nextSpawn();
    t.mock.timers.tick(60_000);
    await flush();
    t.mock.timers.tick(serverAdapterBuild.bound.quietMs - 60_000);
    await assert.rejects(preparing, (error: unknown) => {
      assert.ok(error instanceof RunnerFailure);
      assert.equal(error.category, "process.startup");
      assert.match(error.message, /^Lab startup failure: build step gateway-server-build printed nothing for 300 s/u);
      assert.match(error.message, /after 300 s in all/u);
      assert.deepEqual(error.details, { process: "gateway-server-build", step: "gateway-server-build", bound: "quiet", limitMs: 300_000, elapsedMs: 300_000 });
      return true;
    });
    t.mock.timers.reset();
  });
});

/** Writes the artifact and the receipt Core's generator would stamp for the current sources. */
async function stampArtifact(root: string): Promise<void> {
  const hash = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
  const sources: Record<string, string> = {};
  for (const file of Object.keys(SOURCES).sort()) sources[file] = hash(await readFile(path.join(root, file)));
  const code = `const embedded=${JSON.stringify(`__FLUXIQ_SERVER_IDENTITY_BEGIN__${Buffer.from('{"fluxiqServerIdentityPlaceholder":310}').toString("base64")}__FLUXIQ_SERVER_IDENTITY_END__`)};`;
  const identity = { schema: 1, protocol: "fluxiq.module-build-identity.v1", moduleId: "fluxiq/web-client-gateway-server", version: "0.1.0", normalization: "module-payload-v1", artifactDigest: hash(code), sourceInputsDigest: hash(JSON.stringify(sources)) };
  await writeText(path.join(root, ARTIFACT), code);
  await writeText(path.join(root, `${ARTIFACT}.identity.json`), JSON.stringify({ identity, sources }));
}

async function writeText(file: string, text: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text, "utf8");
}

function flush(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}

type FakeChild = ChildProcess & { stdout: PassThrough; stderr: PassThrough };

function fakeChild(): FakeChild {
  const child = new EventEmitter() as unknown as FakeChild;
  Object.defineProperties(child, {
    stdout: { value: new PassThrough() },
    stderr: { value: new PassThrough() },
    pid: { value: 4_243 },
    exitCode: { value: null, writable: true, configurable: true },
    signalCode: { value: null, writable: true, configurable: true },
  });
  return child;
}

function exitChild(child: FakeChild, code: number): void {
  Object.defineProperty(child, "exitCode", { value: code, writable: true, configurable: true });
  child.emit("exit", code, null);
}
