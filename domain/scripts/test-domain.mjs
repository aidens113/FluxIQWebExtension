import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outdir = path.join(root, ".test-build");
const outfile = path.join(outdir, "domain.test.mjs");

await mkdir(outdir, { recursive: true });
await build({
  entryPoints: [path.join(root, "src", "tests", "domain.test.ts")],
  outfile,
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
await import(pathToFileURL(outfile).href);
