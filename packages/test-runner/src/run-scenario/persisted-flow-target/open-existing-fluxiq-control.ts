import { WebPanelAuthSessionCache } from "../../auth-session.js";
import { ExistingFluxIQControlClient } from "../../existing-fluxiq-control.js";
import type { ExistingTargetConfiguration } from "../../target-config.js";

/**
 * An authenticated control client for a FluxIQ this run did not start.
 *
 * The session is cached under the runs directory, so a sequence of runs against
 * the same FluxIQ logs in once rather than once per run -- which matters because
 * a real deployment's login is rate-limited and its PIN authorization is
 * audited. `freshLogin` on the target opts out, and is what a run that is
 * testing the login itself passes.
 *
 * The credentials are read off the target rather than the environment here: the
 * environment's are the isolated Core's, and handing them to a remote FluxIQ
 * would send this machine's test account password to somewhere that is not this
 * machine.
 */
export async function openExistingFluxIQControl(target: ExistingTargetConfiguration, runsDirectory: string): Promise<ExistingFluxIQControlClient> {
  const control = new ExistingFluxIQControlClient(target.baseUrl);
  await control.login({
    username: target.credentials.username,
    password: target.credentials.password,
    pin: target.credentials.authorizationPin,
    ...(target.credentials.totp ? { totp: target.credentials.totp } : {}),
  }, { sessionCache: new WebPanelAuthSessionCache(runsDirectory), ...(target.freshLogin ? { freshLogin: true } : {}) });
  return control;
}
