import path from "node:path";
import { withoutProviderSecrets } from "../environment.js";

/** Inherited settings the build must not see: any of them would make a build depend on something its key does not cover. */
const DROPPED_PREFIXES = ["FLUXIQ_", "NEXT_PUBLIC_"];
const DROPPED_NAMES = new Set(["NODE_ENV", "PORT"]);

/**
 * The environment `next build` runs with. Inherited `FLUXIQ_*` settings are
 * dropped, so nothing from the invoking shell or from any run reaches the
 * build, and so are `NEXT_PUBLIC_*` values, which Next would inline into the
 * client bundle. The build gets its own FluxIQ root inside the staged
 * workspace, with the client gateway disabled: prerendering may construct the
 * runtime, and it must neither touch a run's data nor bind a port. Core reads
 * every `FLUXIQ_*` value when a request arrives, so `next start` supplies the
 * run's own values.
 */
export function coreWebBuildEnvironment(fluxiqRoot: string, base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const inherited = Object.entries(withoutProviderSecrets(base)).filter(([name]) => {
    const upper = name.toUpperCase();
    return !DROPPED_NAMES.has(upper) && !DROPPED_PREFIXES.some(prefix => upper.startsWith(prefix));
  });
  const storage = path.join(fluxiqRoot, ".fluxiq");
  return {
    ...Object.fromEntries(inherited),
    FLUXIQ_ROOT: fluxiqRoot,
    FLUXIQ_IMPORTER_ROOT: fluxiqRoot,
    FLUXIQ_HOST_ROOT: fluxiqRoot,
    FLUXIQ_DATA_DIR: storage,
    FLUXIQ_DATABASES_DIR: storage,
    FLUXIQ_CLIENT_GATEWAY_ENABLED: "false",
  };
}
