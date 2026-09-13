import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

// Every `src/**/tests/*.test.ts` is bundled as its own entry and executed, so
// a new test file runs without being registered in another test file.
//
// DOMAIN_TEST_BUILD_LABEL sends the bundles to an ignored per-label directory
// so concurrent runs (parallel workers) never overwrite each other's output.
// It stays inside the package so bare `fluxiq` imports still resolve through
// its node_modules. Without a label the tracked `.test-build/` is written.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(root, "src");
const label = process.env.DOMAIN_TEST_BUILD_LABEL;
if (label !== undefined && !/^[a-z0-9][a-z0-9-]{0,63}$/.test(label)) {
  throw new Error("DOMAIN_TEST_BUILD_LABEL must be lowercase kebab-case, at most 64 characters");
}
const outdir = label ? path.join(root, ".test-build-scratch", label) : path.join(root, ".test-build");

async function findTestEntries(directory) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await findTestEntries(full));
    else if (entry.isFile() && entry.name.endsWith(".test.ts") && path.basename(directory) === "tests") found.push(full);
  }
  return found;
}

const entryPoints = (await findTestEntries(sourceRoot)).sort();
if (entryPoints.length === 0) throw new Error("No domain tests found under src/**/tests/");

await mkdir(outdir, { recursive: true });
await build({
  entryPoints,
  outdir,
  outbase: sourceRoot,
  outExtension: { ".js": ".mjs" },
  bundle: true,
  platform: "node",
  target: ["node22"],
  format: "esm",
  external: [
    "fluxiq",
    "fluxiq/*",
    "@fluxiq/client-gateway-websocket",
    "@fluxiq/client-gateway-websocket/*"
  ],
  sourcemap: false,
  logLevel: "silent"
});

// An entry that throws while it loads -- a failed import, a top-level
// statement -- is reported with its error and the loop moves on, so one broken
// file cannot hide every entry sorted after it. Any such entry exits 1; a
// failing `test()` still sets the exit code through node:test.
const failedToLoad = [];
for (const entry of entryPoints) {
  const relative = path.relative(root, entry).split(path.sep).join("/");
  const bundle = path.join(outdir, path.relative(sourceRoot, entry).replace(/\.ts$/, ".mjs"));
  try {
    await import(pathToFileURL(bundle).href);
  } catch (error) {
    failedToLoad.push(relative);
    process.exitCode = 1;
    console.error(`Domain test entry failed to load: ${relative}`);
    console.error(error);
  }
}
if (failedToLoad.length > 0) {
  console.error(`${failedToLoad.length} of ${entryPoints.length} domain test entries failed to load:\n${failedToLoad.map((relative) => `  ${relative}`).join("\n")}`);
}
