import { chromium, type BrowserContext } from "@playwright/test";
import { installDeterministicNetworkGuard, type DeterministicNetworkGuard, type DeterministicNetworkPolicy } from "../network-guard.js";
import { networkContainmentArgs } from "./containment-args.js";
import { forgetCachedServiceWorkers } from "./forget-cached-service-workers.js";

type PersistentLaunchOptions = NonNullable<Parameters<typeof chromium.launchPersistentContext>[1]>;
type PersistentLaunch = (userDataDir: string, options: PersistentLaunchOptions) => Promise<BrowserContext>;

/**
 * Launches a persistent Chromium context that cannot exist unguarded: the
 * containment switches, derived from the same `policy`, are appended to its
 * command line, and the deterministic
 * guard is installed before the context is returned, so no page the caller
 * opens is ever outside it. If the guard cannot be installed the browser is
 * closed and the failure thrown.
 *
 * The profile's stored service workers are forgotten before the launch, so an
 * extension loaded into a profile that ran another build runs this one's
 * background worker (`forgetCachedServiceWorkers`).
 *
 * `proxy` is refused by type: a proxy would resolve names itself and defeat
 * `--host-resolver-rules`. A lane that launches a browser some other way fails
 * the structural test `guarded-browser/tests/launch-containment.test.ts`.
 */
export async function launchGuardedPersistentContext(
  userDataDir: string,
  options: Omit<PersistentLaunchOptions, "proxy">,
  policy: DeterministicNetworkPolicy,
  launch: PersistentLaunch = (directory, launchOptions) => chromium.launchPersistentContext(directory, launchOptions),
): Promise<{ context: BrowserContext; guard: DeterministicNetworkGuard }> {
  const containment = networkContainmentArgs([...policy.scenarioOrigins, ...policy.fluxiqOrigins, ...(policy.gatewayOrigins ?? [])]);
  await forgetCachedServiceWorkers(userDataDir);
  const context = await launch(userDataDir, { ...options, args: [...(options.args ?? []), ...containment] });
  try {
    return { context, guard: await installDeterministicNetworkGuard(context, policy) };
  } catch (error) {
    await context.close().catch(/* best-effort: the guard failure is the one reported */ () => undefined);
    throw error;
  }
}
