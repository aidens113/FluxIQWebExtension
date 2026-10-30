import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// package.json's "fluxiqHostModule" is the one declaration of the host's path.
const { fluxiqHostModule } = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
if (typeof fluxiqHostModule !== "string" || !fluxiqHostModule.endsWith(".mjs")) {
  throw new Error(`apps/product/package.json must declare "fluxiqHostModule" as the built host's .mjs path, not ${JSON.stringify(fluxiqHostModule)}`);
}
const outfile = path.resolve(root, fluxiqHostModule);
await mkdir(path.dirname(outfile), { recursive: true });

// Every FluxIQ package stays external: the host module reaches Core only
// through its public entry points, and Core loads it with a native import().
// The assets stay in apps/product/assets/, two directories above the output,
// which is where src/host/platform.ts resolves them from.
await build({
  entryPoints: [path.join(root, "src", "host", "platform.ts")],
  outfile,
  bundle: true,
  platform: "node",
  target: ["node22"],
  format: "esm",
  external: ["fluxiq", "fluxiq/*"],
  sourcemap: false,
  logLevel: "info"
});

console.log(`[FluxIQ Product] Built product host module: ${outfile}`);
