// The Lab prelude's build phase: every build a run loads, through the build
// cache, in-process.
//
// It used to spawn four `pnpm` builds that rebuilt everything on every run,
// about 90 s before a scenario started even when nothing had changed. Each
// step now goes through `runStep` (scripts/build-cache), which reuses a
// stamped result when its inputs and outputs are provably unchanged and
// otherwise runs the registered command. A run with nothing changed spawns no
// build at all.
//
// It builds what the four `pnpm` builds built, in this order:
//   1. the scenario lab and what it needs (`pnpm --filter scenario-lab build`);
//   2. the web panel host bundle, only for an interactive or instanced run, and
//      still before the domain build, whose clean keeps `dist/host/`;
//   3. the domain, then the extension (`test:e2e:build`);
//   4. the test runner and the rest of its dependencies
//      (`pnpm --filter test-runner... build`);
//   5. an instance's own copy of the host bundle.
// A step that already ran earlier in the same phase is not asked again.
//
// The one change from the old order is that the extension now comes after
// both steps that write into `domain/`. The extension bundles domain/src, so
// what it produces is the same either way. But the cache fingerprints a
// dependency whole, outputs included, so an extension built before the domain
// was fingerprinted against the domain output that step 3 then replaced, and
// the next run rebuilt the extension for nothing: every domain edit cost two
// extension builds, and every host rebuild one.
//
// `runStep` and `buildOrder` are injected so the order, the failure path and
// the reuse path are tested without building this repository.

/** The registry name of the web panel host bundle's build step. */
const HOST_BUILD_STEP = "domain:host-build";

/**
 * @typedef {{ result: "reuse" | "build", step: string, reason: string, ms: number, exitCode: number, source?: "stamp" | "store" | "command" }} StepOutcome
 * @typedef {{
 *   interactive: boolean,
 *   instanced: boolean,
 *   env: NodeJS.ProcessEnv,
 *   runStep: (step: string, options: { env: NodeJS.ProcessEnv }) => Promise<StepOutcome>,
 *   buildOrder: (step: string) => string[],
 *   timer: { time: <T>(step: string, body: () => Promise<T>) => Promise<T> },
 *   note: (line: Record<string, unknown>) => void,
 *   copyHostModule?: () => Promise<void>,
 * }} BuildPhaseOptions
 */

/**
 * Runs the build phase. Throws on the first step whose command failed (a
 * non-zero `exitCode`), naming the step and the cache's reason; nothing after
 * it runs.
 *
 * @param {BuildPhaseOptions} options
 * @returns {Promise<StepOutcome[]>} one outcome per step, in the order run
 */
export async function runBuildPhase(options) {
  const { interactive, instanced, env, runStep, buildOrder, timer, note } = options;
  const plan = [
    ...buildOrder("scenario-lab:build"),
    ...(interactive || instanced ? [HOST_BUILD_STEP] : []),
    ...buildOrder("extension:build"),
    ...buildOrder("test-runner:build")
  ];
  const steps = [...new Set(plan)];

  /** @type {StepOutcome[]} */
  const outcomes = [];
  for (const step of steps) {
    const { outcome } = await timer.time(step, async () => {
      const outcome = await runStep(step, { env });
      note({ "build-cache": outcome.result, step, reason: outcome.reason, ms: outcome.ms, ...(outcome.source === undefined ? {} : { source: outcome.source }) });
      if (outcome.exitCode !== 0) {
        throw new Error(`build step ${step} failed with exit code ${outcome.exitCode} (${outcome.reason})`);
      }
      return { action: outcome.result === "reuse" ? "reused" : "rebuilt", reason: outcome.reason, outcome };
    });
    outcomes.push(outcome);
  }

  if (instanced) {
    if (options.copyHostModule === undefined) throw new Error("an instanced build phase needs copyHostModule");
    await timer.time("host-copy", options.copyHostModule);
  }
  return outcomes;
}
