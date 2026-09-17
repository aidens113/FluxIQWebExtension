import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

// Every `src/**/tests/*.test.ts` is bundled as its own entry and executed, so
// a new test file runs without being registered in another test file.
//
// DOMAIN_TEST_BUILD_LABEL sends the bundles to an ignored per-label directory
// so concurrent runs (parallel workers) never overwrite each other's output.
// It stays inside the package so bare `fluxiq` imports still resolve through
// its node_modules. Without a label the ignored `.test-build/` is written.
//
// The out directory is emptied before each build, because esbuild writes only
// the entries it is handed and deletes nothing. Without that step a bundle
// outlives the test file it came from: a deleted or renamed test leaves a
// runnable `.mjs` behind that nothing detects, and a change of build shape
// leaves whole trees behind. Both had happened by 2026-09-17 -- 89 bundles
// against 84 test entries, plus 211 files under `.test-build/!FluxIQ/` and
// `.test-build/!FluxIQWebExtension/` last written on 2026-08-01, when the
// build still emitted paths carrying the checkout's own directory names.
const LABEL_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
const UNLABELLED_DIR_NAME = ".test-build";
const SCRATCH_DIR_NAME = ".test-build-scratch";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(packageRoot, "src");

/**
 * The directory this run owns, and the only one it may empty.
 *
 * @param {string | undefined} label value of DOMAIN_TEST_BUILD_LABEL
 * @param {string} [root] domain package root; overridden only by tests
 */
export function resolveTestBuildOutdir(label, root = packageRoot) {
  if (label !== undefined && !LABEL_PATTERN.test(label)) {
    throw new Error("DOMAIN_TEST_BUILD_LABEL must be lowercase kebab-case, at most 64 characters");
  }
  return label ? path.join(root, SCRATCH_DIR_NAME, label) : path.join(root, UNLABELLED_DIR_NAME);
}

/**
 * Refuse to empty anything but this package's own build output. Deleting a
 * directory cannot be undone, so the check is a whitelist of the two shapes
 * `resolveTestBuildOutdir` can produce rather than a list of paths to avoid:
 * `<root>/.test-build`, or `<root>/.test-build-scratch/<label>` -- never the
 * scratch parent itself, which holds a concurrent labelled run's output.
 *
 * @param {unknown} outdir
 * @param {string} [root] domain package root; overridden only by tests
 */
export function assertTestBuildOutdirIsRemovable(outdir, root = packageRoot) {
  const refuse = (reason) => {
    throw new Error(`Refusing to empty the domain test build directory: ${reason}. Received ${JSON.stringify(outdir)} under package root ${JSON.stringify(root)}`);
  };
  if (typeof root !== "string" || root === "" || !path.isAbsolute(root)) refuse("the package root is not an absolute path");
  if (typeof outdir !== "string" || outdir === "") refuse("it is empty or not a string");
  if (!path.isAbsolute(outdir)) refuse("it is not an absolute path");
  // A normalized path cannot climb back out of the package through a `..`
  // further along, and cannot be a trailing-separator variant of one.
  if (path.resolve(outdir) !== outdir) refuse("it is not already normalized, so it may not mean what it reads as");
  const relative = path.relative(root, outdir);
  if (relative === "") refuse("it is the package root itself");
  if (path.isAbsolute(relative)) refuse("it is on another drive or outside the package");
  const segments = relative.split(path.sep);
  if (segments.includes("..")) refuse("it lies outside the domain package");
  const isUnlabelled = segments.length === 1 && segments[0] === UNLABELLED_DIR_NAME;
  const isLabelled = segments.length === 2 && segments[0] === SCRATCH_DIR_NAME && LABEL_PATTERN.test(segments[1]);
  if (!isUnlabelled && !isLabelled) {
    refuse(`it is neither ${UNLABELLED_DIR_NAME}/ nor ${SCRATCH_DIR_NAME}/<label>/ inside the domain package`);
  }
}

/**
 * Empty the out directory and recreate it, so what it holds after the build is
 * exactly one bundle per current test entry.
 *
 * @param {string} outdir
 * @param {string} [root] domain package root; overridden only by tests
 */
export async function cleanTestBuildOutdir(outdir, root = packageRoot) {
  assertTestBuildOutdirIsRemovable(outdir, root);
  // maxRetries covers the EBUSY or EPERM a Windows indexer or virus scanner
  // can raise while a directory tree is being removed.
  await rm(outdir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  await mkdir(outdir, { recursive: true });
}

async function findTestEntries(directory) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await findTestEntries(full));
    else if (entry.isFile() && entry.name.endsWith(".test.ts") && path.basename(directory) === "tests") found.push(full);
  }
  return found;
}

async function runDomainTests() {
  const outdir = resolveTestBuildOutdir(process.env.DOMAIN_TEST_BUILD_LABEL);

  const entryPoints = (await findTestEntries(sourceRoot)).sort();
  // Discovery runs before anything is deleted: finding nothing is a defect,
  // and must not take the previous run's output with it on the way out.
  if (entryPoints.length === 0) throw new Error("No domain tests found under src/**/tests/");

  await cleanTestBuildOutdir(outdir);
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
    const relative = path.relative(packageRoot, entry).split(path.sep).join("/");
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
}

// Running this file runs the suite. Importing it -- which is how the guard
// above is tested -- must not, so an import says so for itself. Anything else
// throws rather than exiting quietly, because a run that built nothing and
// reported nothing would otherwise look like a pass.
const entryPath = process.argv[1];
const selfPath = fileURLToPath(import.meta.url);
const samePath = (left, right) => (process.platform === "win32" ? left.toLowerCase() === right.toLowerCase() : left === right);
const startedFromThisFile = typeof entryPath === "string" && entryPath !== "" && samePath(path.resolve(entryPath), selfPath);
if (startedFromThisFile) await runDomainTests();
else if (process.env.DOMAIN_TEST_BUILD_IMPORT_ONLY !== "1") {
  throw new Error(`test-domain.mjs was loaded without being the entry point (process.argv[1] is ${JSON.stringify(entryPath)}); set DOMAIN_TEST_BUILD_IMPORT_ONLY=1 to import it for its exports alone`);
}
