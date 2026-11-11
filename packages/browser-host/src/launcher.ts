import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FluxIQHostLauncher } from "fluxiq/server";
import { createBrowserHostLauncher } from "./create-browser-host-launcher.js";

const BUILT_EXTENSION = fileURLToPath(new URL("../../../apps/extension/dist/chrome", import.meta.url));

/**
 * The module `fluxiq dev --browser-host` loads: a factory over the environment.
 * `FLUXIQ_BROWSER_EXTENSION_PATH` names the built extension; without it the
 * checkout's `apps/extension/dist/chrome` is used.
 */
export function createFluxIQHostLauncher(environment: NodeJS.ProcessEnv = process.env): FluxIQHostLauncher {
  return createBrowserHostLauncher({ extensionPath: path.resolve(environment["FLUXIQ_BROWSER_EXTENSION_PATH"] || BUILT_EXTENSION) });
}

export default createFluxIQHostLauncher;
