import { withoutProviderSecrets } from "../environment.js";

/** Inherited settings a Lab build must not see: any of them would make a build depend on the invoking shell or a run. */
const DROPPED_PREFIXES = ["FLUXIQ_", "NEXT_PUBLIC_"];
const DROPPED_NAMES = new Set(["NODE_ENV", "PORT"]);

/**
 * The base environment the Lab gives Core's keyed web build, for its gateway
 * generator, its `next build` and its key alike. Provider credentials are
 * removed, and so are inherited `FLUXIQ_*` settings, so nothing from the
 * invoking shell or from any run reaches the build, and `NEXT_PUBLIC_*`
 * values, which Next would inline into the client bundle. Core adds the
 * build's own FluxIQ root, with its client gateway disabled, inside the
 * attempt (`scripts/web-build/build-environment.mjs`); `next start` supplies
 * the run's own values.
 */
export function coreWebBuildEnvironment(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(withoutProviderSecrets(base)).filter(([name]) => {
    const upper = name.toUpperCase();
    return !DROPPED_NAMES.has(upper) && !DROPPED_PREFIXES.some(prefix => upper.startsWith(prefix));
  }));
}
