import type { FluxIQHostLauncher } from "fluxiq/server";
import type { BrowserHostOptions } from "./browser-host-options.js";
import { launchHost } from "./launch-host.js";

/** A launcher the engine can call once per host (`fluxiq dev --browsers N`). */
export function createBrowserHostLauncher(options: BrowserHostOptions): FluxIQHostLauncher {
  return { launch: request => launchHost(request, options) };
}
