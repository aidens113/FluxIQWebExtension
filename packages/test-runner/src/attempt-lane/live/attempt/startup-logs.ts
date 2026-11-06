import { cp } from "node:fs/promises";
import { RunnerFailure } from "../../../failure.js";

/** What an attempt's session does with a startup that failed: copy its process logs out, then say where they went. */
export type AttemptStartupLogs = {
  /** `startTopology`'s `copyStartupFailureLogs`: copies the run root's logs before the run root is removed. */
  copy(logsDirectory: string): Promise<void>;
  /** The failure as thrown, naming where its logs are when they were copied; anything else as it was. */
  named(error: unknown): unknown;
};

/**
 * Keeps a failed startup's logs in the run's own folder (lane B, run-mw499mns-1532a49a). `startTopology` removes the
 * run root on a startup failure and copies its logs only for a caller that asks, which the scenario lane does
 * (`../../../run-scenario.ts`) and the attempt lane did not: the isolated Core's web build failed and its log went with
 * the run root, so nobody could say why. The failure line now names where the logs are.
 */
export function attemptStartupLogs(directory: string): AttemptStartupLogs {
  let copied = false;
  return {
    copy: async (logsDirectory) => {
      await cp(logsDirectory, directory, { recursive: true });
      copied = true;
    },
    named: (error) => {
      if (!copied || !(error instanceof RunnerFailure)) return error;
      return new RunnerFailure(error.category, `${error.message}. Its startup logs are in ${directory}`, { cause: error, details: { ...error.details, startupLogs: directory } });
    },
  };
}
