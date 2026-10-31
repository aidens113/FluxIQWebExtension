import { spawnSync } from "node:child_process";
import { readdir, rm, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

// Every src/**/tests/*.test.ts is bundled as its own entry into
// .test-build/host/, the same depth as dist/host/, so the bundled host module
// resolves assets/ exactly as the built one does; then node --test runs them.
// Path fragments on the command line narrow the run.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outdir = path.join(root, ".test-build", "host");

async function testEntries(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await testEntries(full)));
    else if (entry.name.endsWith(".test.ts") && path.basename(path.dirname(full)) === "tests") found.push(full);
  }
  return found;
}

const filters = process.argv.slice(2);
const entries = (await testEntries(path.join(root, "src"))).filter((file) => filters.length === 0 || filters.some((fragment) => file.includes(fragment)));
if (entries.length === 0) throw new Error("No product test files matched.");

await rm(path.join(root, ".test-build"), { recursive: true, force: true });
await mkdir(outdir, { recursive: true });
await build({
  entryPoints: entries,
  outdir,
  entryNames: "[name]",
  outExtension: { ".js": ".mjs" },
  bundle: true,
  platform: "node",
  target: ["node22"],
  format: "esm",
  external: ["fluxiq", "fluxiq/*"],
  logLevel: "warning"
});

const bundles = entries.map((file) => path.join(outdir, `${path.basename(file, ".ts")}.mjs`));
const run = spawnSync(process.execPath, ["--test", ...bundles], { stdio: "inherit", cwd: root });
process.exit(run.status ?? 1);
