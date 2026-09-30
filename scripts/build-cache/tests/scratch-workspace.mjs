// A scratch workspace for the store and lock tests: `a` <- `b` (b depends on
// a) and a check on `a`. Each build copies its source (and a dependency's
// output) into dist/out.txt and appends its package name to a log outside
// every input, so a test can count what actually ran. A package holding a
// file named `embed-path` writes its own absolute directory into its output,
// which is what makes an output not relocatable.

import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runStep } from "../index.mjs";

const BUILD_SCRIPT = `
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
const name = path.basename(process.cwd());
appendFileSync(process.env.RUN_LOG, name + "\\n");
if (process.env.SLOW_BUILD) { const until = Date.now() + Number(process.env.SLOW_BUILD); while (Date.now() < until); }
mkdirSync("dist", { recursive: true });
const dep = name === "b" ? readFileSync("../a/dist/out.txt", "utf8") : "";
const embedded = existsSync("embed-path") ? process.cwd() : "";
writeFileSync(path.join("dist", "out.txt"), readFileSync("src/main.txt", "utf8") + dep + embedded);
`;

export const SCRATCH_STEPS = {
  "a:build": { package: "packages/a", kind: "build", command: "node build.mjs", generated: ["dist"], outputs: [{ path: "dist" }], required: ["dist/out.txt"], env: [] },
  "b:build": { package: "packages/b", kind: "build", command: "node build.mjs", generated: ["dist"], outputs: [{ path: "dist" }], required: ["dist/out.txt"], env: [] },
  "a:check": { package: "packages/a", kind: "check", command: "node check.mjs", generated: ["dist"], env: [] }
};

/** Creates a scratch workspace under a fresh temporary directory; returns its root. */
export async function makeScratchWorkspace(prefix) {
  const repo = await mkdtemp(path.join(os.tmpdir(), prefix));
  const put = (relative, text) => putFile(repo, relative, text);
  await put("pnpm-workspace.yaml", 'packages:\n  - "packages/*"\n');
  await put("package.json", "{}");
  for (const [name, deps] of [["a", {}], ["b", { a: "workspace:*" }]]) {
    await put(`packages/${name}/package.json`, JSON.stringify({ name, dependencies: deps }));
    await put(`packages/${name}/src/main.txt`, `${name} source\n`);
    await put(`packages/${name}/build.mjs`, BUILD_SCRIPT);
  }
  await put("packages/a/check.mjs", "import { appendFileSync } from 'node:fs'; appendFileSync(process.env.RUN_LOG, 'check\\n');");
  return repo;
}

export async function putFile(root, relative, text) {
  const file = path.join(root, relative);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text);
}

/** What ran in a scratch workspace, in order. */
export async function runsIn(repo) {
  const log = path.join(repo, "runs.log");
  if (!existsSync(log)) return [];
  return (await readFile(log, "utf8")).split("\n").filter(Boolean);
}

/** Runs a scratch step with the given store (a directory, or "off"). */
export function runScratch(repo, step, store, env = {}) {
  return runStep(step, {
    repoRoot: repo,
    steps: SCRATCH_STEPS,
    stdio: "ignore",
    env: { ...process.env, RUN_LOG: path.join(repo, "runs.log"), FLUXIQ_BUILD_FORCE: "", FLUXIQ_BUILD_CACHE_DIR: store, ...env }
  });
}
