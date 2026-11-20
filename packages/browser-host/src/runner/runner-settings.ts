import { BrowserHostError } from "../errors/index.js";

/** Where the runner listens for its enrolment relay: a tmpfs folder only its own user can enter. */
const DEFAULT_SOCKET = "/run/fluxiq/enrol.sock";

/** What a dedicated environment's runner is told by its container: nothing secret, since `docker inspect` shows all of it. */
export type RunnerSettings = {
  environmentId: string;
  coreApiUrl: string;
  gatewayUrl: string;
  /** The environment's one profile volume. */
  profileDir: string;
  /** The host the public origin's name resolves to inside the runner, or null where DNS resolves it. */
  resolveOriginTo: string | null;
  /** A certificate authority to trust besides the public ones (PEM), or null. */
  authority: string | null;
  extensionPath: string;
  executablePath: string;
  socketPath: string;
};

/** Reads the runner's settings from its container's environment, naming any that is missing. */
export function runnerSettings(environment: NodeJS.ProcessEnv = process.env): RunnerSettings {
  const required = (name: string): string => {
    const value = environment[name]?.trim();
    if (!value) throw new BrowserHostError("browser_host.runner_unconfigured", `The runner needs ${name}.`);
    return value;
  };
  const optional = (name: string): string | null => environment[name]?.trim() || null;
  return {
    environmentId: required("FLUXIQ_RUNNER_ENVIRONMENT"),
    coreApiUrl: required("FLUXIQ_RUNNER_CORE_URL"),
    gatewayUrl: required("FLUXIQ_RUNNER_GATEWAY_URL"),
    profileDir: required("FLUXIQ_RUNNER_PROFILE_DIR"),
    resolveOriginTo: optional("FLUXIQ_RUNNER_RESOLVE_ORIGIN_TO"),
    authority: optional("FLUXIQ_RUNNER_AUTHORITY"),
    extensionPath: required("FLUXIQ_BROWSER_EXTENSION_PATH"),
    executablePath: required("FLUXIQ_RUNNER_BROWSER"),
    socketPath: optional("FLUXIQ_RUNNER_SOCKET") ?? DEFAULT_SOCKET
  };
}
