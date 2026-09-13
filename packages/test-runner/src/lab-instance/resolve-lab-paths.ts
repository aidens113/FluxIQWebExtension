import path from "node:path";
import { webPanelHostModulePath } from "../environment.js";

/** Where one Lab instance reads its build output and writes its run state. */
export type LabInstancePaths = {
  /** The `FLUXIQ_LAB_INSTANCE` label, or null when this is the single default instance. */
  instance: string | null;
  /** The unpacked e2e Chromium extension the browser is launched with. */
  extensionPath: string;
  /** The scenario lab server this run spawns. */
  scenarioEntrypoint: string;
  /** The compiled scenario lab, holding both that server and the scenario registry. */
  scenarioLabDist: string;
  /** The FluxIQ web panel host module Core imports. */
  hostModulePath: string;
  /** True when the launcher already built the host, so a run must not rebuild it. */
  hostPrebuilt: boolean;
  /** The directory run evidence, bundles and caches are written under. */
  runsDirectory: string;
};

const INSTANCE_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/u;

/**
 * Resolves the paths one Lab instance runs against.
 *
 * `scripts/lab/run-lab.mjs` builds an instance's output and exports the
 * absolute result as `FLUXIQ_LAB_EXTENSION_PATH`,
 * `FLUXIQ_LAB_SCENARIO_ENTRYPOINT` and `FLUXIQ_LAB_HOST_MODULE`; those
 * variables are what this reads, so the runner cannot disagree with the build
 * about which bytes it is testing. An instance label with no exported paths is
 * refused rather than guessed at, because guessing is the one failure mode
 * that would silently run the wrong build.
 *
 * With no label and no exported paths every location is the repository's
 * default, which is what a single `pnpm lab` has always used.
 */
export function resolveLabPaths(repositoryRoot: string, environment: NodeJS.ProcessEnv = process.env): LabInstancePaths {
  const root = path.resolve(repositoryRoot);
  const declared = environment.FLUXIQ_LAB_INSTANCE?.trim() ?? "";
  if (declared !== "" && !INSTANCE_PATTERN.test(declared)) {
    throw new Error(`FLUXIQ_LAB_INSTANCE must be lowercase kebab-case, at most 64 characters; received ${JSON.stringify(declared)}`);
  }
  const instance = declared === "" ? null : declared;
  const hostModule = environment.FLUXIQ_LAB_HOST_MODULE?.trim();
  const extensionPath = required(environment.FLUXIQ_LAB_EXTENSION_PATH, instance, "FLUXIQ_LAB_EXTENSION_PATH", () => path.join(root, "apps", "extension", "dist", "e2e-chromium"));
  const scenarioEntrypoint = required(environment.FLUXIQ_LAB_SCENARIO_ENTRYPOINT, instance, "FLUXIQ_LAB_SCENARIO_ENTRYPOINT", () => path.join(root, "apps", "scenario-lab", "dist", "server.js"));
  return {
    instance,
    extensionPath,
    scenarioEntrypoint,
    scenarioLabDist: path.dirname(scenarioEntrypoint),
    hostModulePath: hostModule ? path.resolve(hostModule) : webPanelHostModulePath(root),
    hostPrebuilt: Boolean(hostModule),
    runsDirectory: environment.FLUXIQ_TEST_RUNS_DIR?.trim()
      ? path.resolve(environment.FLUXIQ_TEST_RUNS_DIR.trim())
      : instance === null ? path.join(root, "test-runs") : path.join(root, "test-runs", "instances", instance),
  };
}

function required(declared: string | undefined, instance: string | null, name: string, fallback: () => string): string {
  const value = declared?.trim();
  if (value) return path.resolve(value);
  if (instance !== null) {
    throw new Error(`FLUXIQ_LAB_INSTANCE=${instance} was set without ${name}. Start an instanced Lab through "pnpm lab" so the launcher exports the paths it built.`);
  }
  return fallback();
}
