import type { FluxIQHostLaunchRequest, FluxIQLaunchedHost } from "fluxiq/server";
import type { BrowserHostOptions } from "./browser-host-options.js";
import { BrowserHostError } from "./errors/index.js";
import { launchHost } from "./launch-host.js";

type LaunchOne = (request: FluxIQHostLaunchRequest, options: BrowserHostOptions) => Promise<FluxIQLaunchedHost>;

/**
 * Launches the hosts in parallel. If any fails, every one that did start is
 * closed, and the error names the host that failed (the first, when several).
 */
export async function launchHosts(requests: readonly FluxIQHostLaunchRequest[], options: BrowserHostOptions, launch: LaunchOne = launchHost): Promise<FluxIQLaunchedHost[]> {
  const settled = await Promise.allSettled(requests.map(request => launch(request, options)));
  const started = settled.flatMap(result => (result.status === "fulfilled" ? [result.value] : []));
  const failedAt = settled.findIndex(result => result.status === "rejected");
  if (failedAt < 0) return started;
  await Promise.allSettled(started.map(host => host.close()));
  const failure = (settled[failedAt] as PromiseRejectedResult).reason as Error;
  const hostId = requests[failedAt]?.hostId;
  throw new BrowserHostError("browser_host.launch_failed", `Host ${hostId} failed, so the others were closed: ${failure.message}`, { hostId, cause: failure });
}
