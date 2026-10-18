// Scratch Git checkouts running the actual sibling Core build-cache code.
import { execFileSync, spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const repository = fileURLToPath(new URL("../../../../../", import.meta.url));
const CORE = path.resolve(repository, "../!FluxIQ");
const LEASE = new URL("../index.mjs", import.meta.url).href;
const CHILD = `
import { acquireCoreBuildLease } from ${JSON.stringify(LEASE)};
import { runStep, resolveStep } from './scripts/build-cache/index.mjs';
const mode = process.argv[2];
if (mode === 'lease' || mode === 'exit') {
  const lease = await acquireCoreBuildLease(process.cwd(), { heartbeatMs: 20, onLost: (error) => { console.error(error); process.exit(2); } });
  process.send('held');
  await new Promise(resolve => process.once('message', resolve));
  if (mode === 'exit') process.exit(7);
  await lease.release();
} else {
  const step = process.argv[3] ?? 'fluxiq:build';
  const directory = step.split(':')[0];
  const steps = { [step]: { package: 'packages/' + directory, kind: 'build', command: 'node build.mjs', outputs: [{ path: 'dist' }], required: ['dist/out.txt'], env: [] } };
  process.send('attempting');
  const outcome = await runStep(step, { steps, repoRoot: process.cwd(), env: process.env, lock: { staleMs: Number(process.env.TEST_STALE_MS ?? 1800000), pollMs: 20 }, stdio: 'ignore' });
  process.send(outcome);
}
process.disconnect();
`;

/** One isolated root, store and observable real child build, never a live tree. */
export async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-lab-lease-"));
  const children = [];
  t.after(async () => {
    for (const child of children) if (child.exitCode === null && child.signalCode === null) child.kill();
    await Promise.all(children.map((child) => child.done.catch(() => {})));
    if (!path.resolve(root).startsWith(path.join(path.resolve(os.tmpdir()), "fluxiq-lab-lease-"))) throw new Error("Unexpected scratch cleanup root");
    await rm(root, { recursive: true, force: true });
  });
  await cp(path.join(CORE, "scripts/build-cache"), path.join(root, "scripts/build-cache"), { recursive: true, filter: (source) => !source.split(path.sep).includes("tests") });
  await mkdir(path.join(root, "state"));
  await writeFile(path.join(root, ".gitignore"), "node_modules/\ndist/\nstate/\n");
  await writeFile(path.join(root, "pnpm-workspace.yaml"), 'packages:\n  - "packages/*"\n');
  await writeFile(path.join(root, "package.json"), '{"type":"module"}');
  for (const [dir, name] of [["contracts", "@fluxiq/contracts"], ["fluxiq", "fluxiq"], ["client-gateway-websocket", "@fluxiq/client-gateway-websocket"]]) {
    const pkg = path.join(root, "packages", dir);
    await mkdir(path.join(pkg, "src"), { recursive: true });
    await writeFile(path.join(pkg, "package.json"), JSON.stringify({ name, scripts: { build: "node ../../scripts/build-cache/cli.mjs" } }));
    await writeFile(path.join(pkg, "src/input.txt"), "source");
    await writeFile(path.join(pkg, "build.mjs"), `import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
writeFileSync(process.env.TEST_STARTED, 'started');
while (process.env.TEST_GATE && !existsSync(process.env.TEST_GATE)) await delay(20);
mkdirSync('dist', { recursive: true }); writeFileSync('dist/out.txt', 'built output');`);
  }
  await writeFile(path.join(root, "child.mjs"), CHILD);
  execFileSync("git", ["init", "-q"], { cwd: root, stdio: "ignore" });
  const cache = await import(pathToFileURL(path.join(root, "scripts/build-cache/index.mjs")).href);
  return {
    root,
    lockPath: (step = "fluxiq:build") => `${cache.resolveStep(step, { repoRoot: root }).stampPath}.lock`,
    put: (relative, value = "") => writeFile(path.join(root, relative), value),
    read: (relative) => readFile(path.join(root, relative), "utf8"),
    start(mode, env = {}, step) {
      const child = spawn(process.execPath, ["child.mjs", mode, ...(step ? [step] : [])], {
        cwd: root, env: { ...process.env, FLUXIQ_BUILD_FORCE: "", FLUXIQ_BUILD_CACHE_DIR: "off", TEST_STARTED: path.join(root, "state/started"), ...env }, stdio: ["ignore", "pipe", "pipe", "ipc"]
      });
      child.messages = [];
      child.errors = "";
      child.stderr.on("data", (chunk) => { child.errors += chunk; });
      child.on("message", (message) => child.messages.push(message));
      child.done = new Promise((resolve, reject) => {
        child.once("error", reject);
        child.once("close", (code) => resolve(code));
      });
      children.push(child);
      return child;
    }
  };
}

/** Bounded waits inspect actual state instead of assuming a child has started. */
export async function until(predicate) {
  const deadline = Date.now() + 15_000;
  while (!(await predicate())) {
    if (Date.now() >= deadline) throw new Error("Timed out waiting for child state");
    await delay(20);
  }
}
