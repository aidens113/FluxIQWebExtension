// `node packages/test-runner/dist/build-time/cli.js [--runs-root <dir>] [--limit 25] [--json]`
//
// Prints where the newest runs' build wall time went: a Markdown table per
// run, the pooled shares and the classification table, or with `--json` the
// raw figures. Reads only step `meta.json` timings and `entry.json`; writes
// nothing.
import path from "node:path";
import { labRunsRoot } from "../lab-runs/index.js";
import { aggregateBuildTimes } from "./aggregate-build-times.js";
import { findRecentRuns } from "./find-recent-runs.js";
import { measureBuildTime } from "./measure-build-time.js";
import { readStepTimings } from "./read-step-timings.js";
import { renderBuildTimeTable } from "./render-build-time-table.js";
import type { RunBuildTimeRow } from "./types.js";

const args = process.argv.slice(2);
const option = (name: string): string | undefined => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};

const root = path.resolve(option("--runs-root") ?? labRunsRoot());
const limit = Number(option("--limit") ?? "25");
if (!Number.isInteger(limit) || limit < 1) throw new Error(`--limit must be a positive whole number, not ${option("--limit")}`);

const rows: RunBuildTimeRow[] = [];
for (const run of await findRecentRuns(root, limit)) {
  const { steps, incomplete } = await readStepTimings(path.join(run.directory, "steps"));
  rows.push({ ...run, measured: measureBuildTime(steps), incomplete });
}
const totals = aggregateBuildTimes(rows);
process.stdout.write(args.includes("--json") ? `${JSON.stringify({ root, rows, totals }, null, 2)}\n` : `${renderBuildTimeTable(rows, totals)}\n`);
