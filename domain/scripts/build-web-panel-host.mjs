import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outdir = path.join(root, "dist", "host");
const outfile = path.join(outdir, "web-panel-host.cjs");

await mkdir(outdir, { recursive: true });

await build({
  entryPoints: [path.join(root, "src", "web-panel-host.ts")],
  outfile,
  bundle: true,
  platform: "node",
  target: ["node22"],
  format: "cjs",
  external: [
    "fluxiq",
    "fluxiq/*",
    "@fluxiq/client-gateway-websocket",
    "@fluxiq/client-gateway-websocket/*"
  ],
  sourcemap: false,
  logLevel: "info"
});

console.log(`[FluxIQ Web Automation] Built web panel host module: ${outfile}`);
