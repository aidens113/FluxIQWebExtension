import { RunnerFailure } from "../failure.js";
import type { ProcessSpec, ProcessSupervisor } from "../process-supervisor.js";

/**
 * How long a Lab startup build may run. A build is never failed for being
 * slow while it is still working: the quiet bound restarts on every line it
 * prints, so only a build that has printed nothing for `quietMs` is treated
 * as hung. The ceiling is a generous backstop for one that keeps printing and
 * never finishes. A fixed 60 s limit used to fail a whole run when a busy
 * machine took longer than that to generate Core's gateway server
 * (`run-mv93ywox-9b5aa220`, t620).
 */
export type BuildStepBound = {
  /** Longest stretch without output before the step counts as hung. */
  quietMs: number;
  /** Longest the step may run in all, output or not. */
  ceilingMs: number;
};

/**
 * Runs one Lab startup build under `bound`. It succeeds on exit 0; any other
 * ending is a closed `process.startup` failure, and a timeout names the step,
 * which bound it hit, the limit and the elapsed time. The child stays
 * registered with `supervisor`, so the run's cleanup stops a hung one.
 */
export async function runBoundedBuildStep(supervisor: ProcessSupervisor, spec: ProcessSpec, bound: BuildStepBound, now: () => number = () => Date.now()): Promise<void> {
  const child = supervisor.start(spec);
  const startedAt = now();
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    let quietTimer: ReturnType<typeof setTimeout> | undefined;
    let ceilingTimer: ReturnType<typeof setTimeout> | undefined;
    const finish = (error?: RunnerFailure) => {
      if (settled) return;
      settled = true;
      clearTimeout(quietTimer);
      clearTimeout(ceilingTimer);
      child.stdout?.off("data", onProgress);
      child.stderr?.off("data", onProgress);
      if (error) reject(error); else resolve();
    };
    const timedOut = (kind: "quiet" | "ceiling", limitMs: number) => {
      const elapsedMs = now() - startedAt;
      const what = kind === "quiet" ? `printed nothing for ${seconds(limitMs)}, its limit for a build that has stopped making progress` : `was still running at its ${seconds(limitMs)} ceiling`;
      finish(new RunnerFailure("process.startup", `Lab startup failure: build step ${spec.name} ${what}, after ${seconds(elapsedMs)} in all; the run's cleanup stops it`, {
        details: { process: spec.name, step: spec.name, bound: kind, limitMs, elapsedMs },
      }));
    };
    const armQuiet = () => {
      clearTimeout(quietTimer);
      quietTimer = setTimeout(() => timedOut("quiet", bound.quietMs), bound.quietMs);
    };
    const onProgress = () => { if (!settled) armQuiet(); };
    ceilingTimer = setTimeout(() => timedOut("ceiling", bound.ceilingMs), bound.ceilingMs);
    armQuiet();
    child.stdout?.on("data", onProgress);
    child.stderr?.on("data", onProgress);
    child.once("error", cause => finish(new RunnerFailure("process.startup", `${spec.name} failed to start`, { cause, details: { process: spec.name, step: spec.name } })));
    child.once("exit", (code, signal) => finish(code === 0 ? undefined : new RunnerFailure("process.startup", `${spec.name} exited unsuccessfully`, { details: { process: spec.name, step: spec.name, code, signal } })));
  });
}

function seconds(milliseconds: number): string {
  return `${Math.round(milliseconds / 1_000)} s`;
}
