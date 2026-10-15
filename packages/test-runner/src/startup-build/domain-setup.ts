import path from "node:path";
import { runBoundedBuildStep, type BuildStepBound } from "../core-web-build/index.js";
import { executable, type ProcessSupervisor } from "../process-supervisor.js";

/**
 * `domain/scripts/setup-fluxiq.mjs` bundles the setup CLI with esbuild at
 * `logLevel: "silent"` and then runs it once against the demo's FluxIQ root,
 * printing one JSON summary at the end: a build plus one-off setup, not a
 * readiness wait, and silent while it works. Its bound is the gateway
 * generator's: five silent minutes is hung, fifteen in all the backstop. It
 * ran under the supervisor's default fixed 120 s (t620).
 */
const DOMAIN_SETUP_BOUND: BuildStepBound = Object.freeze({ quietMs: 5 * 60_000, ceilingMs: 15 * 60_000 });

export type DomainSetupInput = { name: string; repositoryRoot: string; fluxiqRoot: string; logPath: string; env?: NodeJS.ProcessEnv };

/** Builds and runs the web-automation domain's FluxIQ setup for one FluxIQ root. */
export const domainSetupStep = Object.freeze({
  bound: DOMAIN_SETUP_BOUND,
  run(supervisor: ProcessSupervisor, input: DomainSetupInput): Promise<void> {
    return runBoundedBuildStep(supervisor, {
      name: input.name,
      command: executable("node"),
      args: [path.join(input.repositoryRoot, "domain", "scripts", "setup-fluxiq.mjs")],
      cwd: input.repositoryRoot,
      env: { ...(input.env ?? process.env), FLUXIQ_WEB_AUTOMATION_ROOT: input.fluxiqRoot },
      logPath: input.logPath,
    }, DOMAIN_SETUP_BOUND);
  },
});
