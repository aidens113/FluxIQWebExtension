import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// package.json's "fluxiqHostModule" is the one declaration of the host's path;
// every launcher reads the same field.
const { fluxiqHostModule } = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
if (typeof fluxiqHostModule !== "string" || !fluxiqHostModule.endsWith(".mjs")) {
  throw new Error(`domain/package.json must declare "fluxiqHostModule" as the built host's .mjs path, not ${JSON.stringify(fluxiqHostModule)}`);
}
const outfile = path.resolve(root, fluxiqHostModule);

await mkdir(path.dirname(outfile), { recursive: true });

// An ES module with every FluxIQ package external: FluxIQ packages are
// ESM-only, so the host reaches Core only through its public entry points,
// and Core's web panel loads the host with a native import().
await build({
  entryPoints: [path.join(root, "src", "web-panel-host.ts")],
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
  logLevel: "info"
});

console.log(`[FluxIQ Web Automation] Built web panel host module: ${outfile}`);
