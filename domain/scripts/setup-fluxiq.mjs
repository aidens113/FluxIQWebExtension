import { mkdir } from "node:fs/promises";
import Module from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(root, "..");
const fluxiqRoot = path.resolve(repoRoot, "..", "!FluxIQ");
const sqliteEntrypoint = path.join(fluxiqRoot, "node_modules", ".pnpm", "sqlite3@6.0.1", "node_modules", "sqlite3", "lib", "sqlite3.js");
const outdir = path.join(root, ".script-build");
const outfile = path.join(outdir, "setup-fluxiq.cjs");

await mkdir(outdir, { recursive: true });
await build({
  entryPoints: [path.join(root, "src", "setup-cli.ts")],
  outfile,
  bundle: true,
  platform: "node",
  target: ["node22"],
  format: "cjs",
  external: ["sqlite3"],
  plugins: [{
    name: "sqlite3-realpath",
    setup(buildContext) {
      buildContext.onResolve({ filter: /^sqlite3$/ }, () => ({
        path: sqliteEntrypoint,
        external: true
      }));
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
