import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FluxIQPlatform } from "fluxiq/platform/panel";
import { seedDefaultProject } from "../hooks/index.ts";
import { productManifest } from "../manifest/index.ts";

// From src/host/platform.ts and from dist/host/platform.mjs the package root
// is two directories up, so assets/ resolves the same in both.
const assetsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "assets");

/** The host module entry: Core calls it once per process with the platform. */
export function registerFluxIQPlatform(platform: FluxIQPlatform): void {
  platform.setProduct(productManifest, { assetsDir });
  platform.on("workspace.created", seedDefaultProject);
}
