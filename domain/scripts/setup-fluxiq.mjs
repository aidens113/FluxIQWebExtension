import { mkdir, rm } from "node:fs/promises";
import Module from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import { assertEagerFiles } from "../../scripts/check/lazy-modules/index.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(root, "..");
const fluxiqRoot = path.resolve(repoRoot, "..", "!FluxIQ");
const fluxiqRequire = Module.createRequire(path.join(fluxiqRoot, "packages", "fluxiq", "package.json"));
const externalEntrypoints = new Map([
  ["sqlite3", fluxiqRequire.resolve("sqlite3")],
  ["qrcode", fluxiqRequire.resolve("qrcode")]
]);
const outdir = path.join(root, ".script-build");
const entryName = "setup-fluxiq";
const outfile = path.join(outdir, `${entryName}.mjs`);

// The directory holds this build alone. Emptying it drops the previous build's
// chunks, whose names carry content hashes and would otherwise pile up.
await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });
// Split into chunks so every dynamic import() in Core stays a real import and
// each module starts in ESM order. As one file, esbuild started thousands of
// modules lazily and dropped a start call, which crashed setup as it loaded
// (scripts/check/lazy-modules). The chunks sit beside the entry, so code that
// resolves paths from import.meta.url sees the same directory as before.
const result = await build({
  entryPoints: { [entryName]: path.join(root, "src", "setup-cli.ts") },
  outdir,
  splitting: true,
  outExtension: { ".js": ".mjs" },
  chunkNames: "[name]-[hash]",
  absWorkingDir: root,
  metafile: true,
  bundle: true,
  platform: "node",
  target: ["node22"],
  format: "esm",
  external: [...externalEntrypoints.keys()],
  plugins: [{
    name: "sqlite3-realpath",
    setup(buildContext) {
      for (const [packageName, entrypoint] of externalEntrypoints) {
        buildContext.onResolve({ filter: new RegExp(`^${packageName}$`) }, () => ({ path: pathToFileURL(entrypoint).href, external: true }));
      }
    }
  }],
  sourcemap: false,
  logLevel: "silent"
});
await assertEagerFiles("domain setup bundle", Object.keys(result.metafile.outputs).map((file) => path.resolve(root, file)));

process.env.FLUXIQ_WEB_AUTOMATION_ROOT ??= repoRoot;
process.env.NODE_PATH = [
  path.join(fluxiqRoot, "node_modules"),
  process.env.NODE_PATH
].filter(Boolean).join(path.delimiter);
Module._initPaths();
await import(pathToFileURL(outfile).href);
