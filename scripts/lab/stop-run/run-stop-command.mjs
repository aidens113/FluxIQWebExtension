// `node scripts/lab/run-lab.mjs stop <instance>` (or `pnpm lab stop <instance>`):
// the command-line face of `stopLabRun`. Prints a sentence and one JSON line
// to stderr and returns the exit code: 0 when the run was stopped, 1 otherwise.

import { stopLabRun } from "./stop-lab-run.mjs";

const USAGE = "usage: node scripts/lab/run-lab.mjs stop <instance>   (the FLUXIQ_LAB_INSTANCE the run was launched with; \"default\" when it had none)";

/**
 * @param {string[]} args the arguments after `stop`
 * @param {Omit<Parameters<typeof stopLabRun>[0], "instance"> & { write?: (text: string) => void }} [options]
 * @returns {Promise<number>}
 */
export async function runStopCommand(args, options = {}) {
  const { write = (text) => process.stderr.write(text), ...stopOptions } = options;
  const instance = args[0]?.trim();
  if (!instance || instance.startsWith("--") || args.length > 1) {
    write(`[lab] ${USAGE}\n`);
    return 1;
  }
  const result = await stopLabRun({ ...stopOptions, instance });
  write(`[lab] ${result.status === "stopped" ? "" : `stop ${result.status}: `}${result.message}.\n`);
  const runs = result.finishes.map((finish) => ({ runId: finish.runId, verdict: finish.verdict, totalEstimatedCostUsd: finish.totalEstimatedCostUsd }));
  write(`${JSON.stringify({ lab: "stop", state: result.status, instance, launchId: result.launch?.launchId ?? null, pid: result.launch?.pid ?? null, runs })}\n`);
  return result.status === "stopped" ? 0 : 1;
}
