import { mkdir } from "node:fs/promises";
import Module from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(root, "..");
const fluxiqRoot = path.resolve(repoRoot, "..", "!FluxIQ");
const fluxiqRequire = Module.createRequire(path.join(fluxiqRoot, "packages", "fluxiq", "package.json"));
const externalEntrypoints = new Map([
  ["sqlite3", fluxiqRequire.resolve("sqlite3")],
  ["qrcode", fluxiqRequire.resolve("qrcode")]
]);
const outdir = path.join(root, ".script-build");
const outfile = path.join(outdir, "setup-fluxiq.mjs");

await mkdir(outdir, { recursive: true });
await build({
  entryPoints: [path.join(root, "src", "setup-cli.ts")],
  outfile,
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

process.env.FLUXIQ_WEB_AUTOMATION_ROOT = repoRoot;
process.env.NODE_PATH = [
  path.join(fluxiqRoot, "node_modules"),
  process.env.NODE_PATH
].filter(Boolean).join(path.delimiter);
Module._initPaths();
await import(pathToFileURL(outfile).href);
