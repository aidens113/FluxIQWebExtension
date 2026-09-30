import path from "node:path";

/**
 * Where a run's UI review goes: `<runId>.ui-review.local.json` and the
 * pictures' directory `<runId>.ui-review.local/`, beside the run's bundle in
 * the runs directory and never inside it. The bundle's staging directory is
 * walked into its artifact index, so anything written there would be
 * published; beside it, nothing indexes, hashes or publishes these files.
 */
export function uiReviewPaths(runsDirectory: string, runId: string): { json: string; directory: string; directoryName: string } {
  return {
    json: path.join(runsDirectory, `${runId}.ui-review.local.json`),
    directory: path.join(runsDirectory, `${runId}.ui-review.local`),
    directoryName: `${runId}.ui-review.local`,
  };
}
