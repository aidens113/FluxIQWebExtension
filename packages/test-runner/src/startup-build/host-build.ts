import path from "node:path";
import { runBoundedBuildStep, type BuildStepBound } from "../core-web-build/index.js";
import { executable, type ProcessSupervisor } from "../process-supervisor.js";

/**
 * `domain/scripts/build-web-panel-host.mjs` is one esbuild bundle (its
 * `logLevel: "info"` summary prints only when it finishes) and a stamp, so it
 * is silent while it works, like Core's gateway server generator, and takes
 * the same bound: five silent minutes is hung, fifteen in all the backstop.
 * It ran under the supervisor's default fixed 120 s, which a loaded machine
 * can exceed while the build still works (t620).
 */
const HOST_BUILD_BOUND: BuildStepBound = Object.freeze({ quietMs: 5 * 60_000, ceilingMs: 15 * 60_000 });

export type HostBuildInput = { name: string; repositoryRoot: string; logPath: string; env?: NodeJS.ProcessEnv };

/** Builds the web panel host module the Lab and the demo load into Core. */
export const hostBuildStep = Object.freeze({
  bound: HOST_BUILD_BOUND,
  run(supervisor: ProcessSupervisor, input: HostBuildInput): Promise<void> {
    return runBoundedBuildStep(supervisor, {
      name: input.name,
      command: executable("node"),
      args: [path.join(input.repositoryRoot, "domain", "scripts", "build-web-panel-host.mjs")],
      cwd: input.repositoryRoot,
      env: input.env ?? process.env,
      logPath: input.logPath,
    }, HOST_BUILD_BOUND);
  },
});
