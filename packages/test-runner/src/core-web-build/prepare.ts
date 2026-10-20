import { appendFileSync } from "node:fs";
import { RunnerFailure } from "../failure.js";
import type { ProcessSpec, ProcessSupervisor } from "../process-supervisor.js";
import { coreWebBuildEnvironment } from "./build-environment.js";
import { runBoundedBuildStep, type BuildStepBound } from "./build-step.js";
import { loadCoreWebBuildSeam } from "./core-seam.js";
import type { CoreWebBuild, CoreWebBuildCommand, CoreWebBuildError, CoreWebBuildSeam } from "./types.js";

const BUILD_PROCESS_NAME = "core-web-build";
const GATEWAY_PROCESS_NAME = "gateway-server-build";
/**
 * `next build`'s bound. It prints as it moves through its phases, but its
 * compile phase can be silent for minutes on a loaded machine, so a build is
 * hung only after ten silent minutes; thirty minutes in all is the backstop.
 * It was a fixed ten minutes, which a slow machine could exceed while the
 * build still worked (t620).
 */
const BUILD_BOUND: BuildStepBound = Object.freeze({ quietMs: 10 * 60_000, ceilingMs: 30 * 60_000 });
/**
 * The gateway generator prints nothing until it finishes (esbuild runs with
 * `logLevel: "silent"`), so its quiet bound is in effect its whole limit: a
 * build takes seconds, but on a loaded machine it outlasted the fixed 60 s
 * that used to fail the whole run (`run-mv93ywox-9b5aa220`).
 */
const GATEWAY_BOUND: BuildStepBound = Object.freeze({ quietMs: 5 * 60_000, ceilingMs: 15 * 60_000 });
/** A waiter outlasts one whole build by the lock holder, plus the holder's staging copy. */
const WAIT_TIMEOUT_MS = BUILD_BOUND.ceilingMs + 120_000;

export type CoreWebBuildOptions = {
  fluxiqRepositoryRoot: string;
  /** Where published builds are cached. Defaults to Core's own (`<core>/.tmp/web-build`, or `FLUXIQ_CORE_WEB_BUILD_CACHE`). */
  cacheRoot?: string;
  /** Owns the build children, so a run's cleanup stops a build it started. */
  supervisor: ProcessSupervisor;
  /** Where the build's output and Core's account of it go, when this caller is the one that builds. */
  logPath: string;
  signal?: AbortSignal;
};

export type CoreWebBuildDependencies = {
  loadSeam: (fluxiqRepositoryRoot: string) => Promise<CoreWebBuildSeam>;
  runBuild: (supervisor: ProcessSupervisor, spec: ProcessSpec, bound: BuildStepBound) => Promise<void>;
  buildBound: BuildStepBound;
  gatewayBound: BuildStepBound;
  waitTimeoutMs: number;
  environment: () => NodeJS.ProcessEnv;
};

const defaultDependencies: CoreWebBuildDependencies = {
  loadSeam: loadCoreWebBuildSeam,
  runBuild: (supervisor, spec, bound) => runBoundedBuildStep(supervisor, spec, bound),
  buildBound: BUILD_BOUND,
  gatewayBound: GATEWAY_BOUND,
  waitTimeoutMs: WAIT_TIMEOUT_MS,
  environment: () => coreWebBuildEnvironment(),
};

/**
 * Returns the published production build of Core's web panel for the current
 * Core inputs, through Core's keyed build (`<core>/scripts/web-build/`), which
 * keys, stages, locks, checks and publishes it. The Lab supplies what is its
 * own: the scrubbed environment, the supervised and bounded children (so a
 * run's cleanup stops a build it started), and the log. Every failure is a
 * closed `RunnerFailure`; the build's own output stays in its log.
 */
export async function prepareCoreWebBuild(options: CoreWebBuildOptions, overrides: Partial<CoreWebBuildDependencies> = {}): Promise<CoreWebBuild> {
  const dependencies: CoreWebBuildDependencies = { ...defaultDependencies, ...overrides };
  const seam = await dependencies.loadSeam(options.fluxiqRepositoryRoot);
  // Synchronous, so Core's lines and the build's own output keep their order in
  // the log, and a log that cannot be written fails the preparation.
  const log = (line: string) => appendFileSync(options.logPath, `[core-web-build] ${line}\n`, "utf8");
  // The scrubbed environment drops every FLUXIQ_* setting, so the cache
  // override is read here, from the shell that asked for the build.
  const cacheRoot = options.cacheRoot ?? (process.env.FLUXIQ_CORE_WEB_BUILD_CACHE?.trim() || undefined);
  try {
    const build = await seam.prepareWebBuild({
      repoRoot: options.fluxiqRepositoryRoot,
      ...(cacheRoot ? { cacheRoot } : {}),
      env: dependencies.environment(),
      run: command => runCommand(command, options, dependencies),
      log,
      ...(options.signal ? { signal: options.signal } : {}),
      waitTimeoutMs: dependencies.waitTimeoutMs,
    });
    return { key: build.key, directory: build.directory, webDirectory: build.webDirectory, nextExecutable: build.nextExecutable, buildId: build.buildId };
  } catch (error) {
    if (error instanceof RunnerFailure) throw error;
    if (isCoreWebBuildError(error)) {
      throw new RunnerFailure(error.kind === "environment" ? "environment.missing" : "process.startup", error.message, { cause: error, details: { ...error.details, process: BUILD_PROCESS_NAME } });
    }
    throw new RunnerFailure("process.startup", "Core web panel production build could not be prepared", { cause: error, details: { process: BUILD_PROCESS_NAME } });
  }
}

async function runCommand(command: CoreWebBuildCommand, options: CoreWebBuildOptions, dependencies: CoreWebBuildDependencies): Promise<void> {
  const gateway = command.name === "gateway-server-build";
  const spec: ProcessSpec = {
    name: gateway ? GATEWAY_PROCESS_NAME : BUILD_PROCESS_NAME,
    command: command.command,
    args: command.args,
    cwd: command.cwd,
    env: command.env,
    shell: command.shell,
    logPath: gateway ? `${options.logPath}.gateway-server.log` : options.logPath,
  };
  try {
    await dependencies.runBuild(options.supervisor, spec, gateway ? dependencies.gatewayBound : dependencies.buildBound);
  } catch (cause) {
    // A timeout keeps its own sentence -- the step, the bound it hit, the
    // limit and the elapsed time -- rather than only the generic one.
    const timeout = cause instanceof RunnerFailure && cause.details?.bound !== undefined ? cause : undefined;
    const what = gateway ? "Core's gateway server generator did not succeed" : "Core web panel production build did not succeed";
    throw new RunnerFailure("process.startup", timeout ? `${what}. ${timeout.message}` : what, { cause, details: { ...timeout?.details, process: spec.name } });
  }
}

function isCoreWebBuildError(error: unknown): error is CoreWebBuildError {
  return error instanceof Error && "kind" in error && (error.kind === "environment" || error.kind === "build") && "details" in error && typeof error.details === "object" && error.details !== null;
}
