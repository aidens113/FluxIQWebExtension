import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

// The extension's unit tests, on the domain's pattern (domain/scripts/test-domain.mjs):
// every `src/**/tests/*.test.ts` is bundled as its own entry and executed under
// node:test, so a new test file runs without being registered anywhere.
//
// The bundles run in Node, not a browser, so this runner covers pure logic: a
// module that touches `chrome` or the DOM while loading cannot be imported by a
// test here. Content-script behaviour is covered by the Playwright harness
// (`test:content`).
//
// EXTENSION_TEST_BUILD_LABEL sends the bundles to a per-label directory so
// concurrent runs (parallel workers) never overwrite each other's output;
// without a label they go to `default`. Every label directory sits under the
// ignored `.test-build-scratch/`, inside the package, so the bare `fluxiq` and
// `@fluxiq/client-gateway-websocket` imports left external resolve through the
// package's node_modules.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(root, "src");
const label = process.env.EXTENSION_TEST_BUILD_LABEL ?? "default";
if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(label)) {
  throw new Error("EXTENSION_TEST_BUILD_LABEL must be lowercase kebab-case, at most 64 characters");
}
const outdir = path.join(root, ".test-build-scratch", label);

async function findTestEntries(directory, suffix = ".test.ts") {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await findTestEntries(full, suffix));
    else if (entry.isFile() && entry.name.endsWith(suffix) && path.basename(directory) === "tests") found.push(full);
  }
  return found;
}

// Path fragments on the command line narrow the run to the entries whose
// package-relative path contains one of them, so a change is validated with the
// tests beside it (`node scripts/test-extension.mjs panel/automations/tests`).
// A fragment that matches nothing is refused rather than reported as a pass.
const filters = process.argv.slice(2).map((filter) => filter.split(path.sep).join("/"));
const selectedBy = (entries) => filters.length === 0
  ? entries
  : entries.filter((entry) => filters.some((filter) => path.relative(root, entry).split(path.sep).join("/").includes(filter)));

const entryPoints = selectedBy((await findTestEntries(sourceRoot)).sort());
const scriptEntries = selectedBy((await findTestEntries(path.join(root, "scripts"), ".test.mjs")).sort());
if (filters.length > 0 && entryPoints.length + scriptEntries.length === 0) {
  throw new Error(`No extension test entry matches ${filters.map((filter) => JSON.stringify(filter)).join(", ")}`);
}
if (filters.length === 0 && entryPoints.length === 0) throw new Error("No extension tests found under src/**/tests/");

// Only this label's directory is cleared, so a deleted test leaves no stale
// bundle behind and a concurrent run under another label is untouched.
await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });
if (entryPoints.length > 0) await build({
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
  sourcemap: "linked",
  logLevel: "silent"
});

// A failing assertion reports the test's source line, not the bundle's.
process.setSourceMapsEnabled(true);
for (const entry of entryPoints) {
  const bundle = path.join(outdir, path.relative(sourceRoot, entry).replace(/\.ts$/, ".mjs"));
  await import(pathToFileURL(bundle).href);
}

// The build and release scripts' own tests (scripts/**/tests/*.test.mjs) run in
// the same node:test run: the build stamp, target verification and store
// packaging are gates, so they are tested with the rest.
for (const entry of scriptEntries) {
  await import(pathToFileURL(entry).href);
}
