// Checks every trace in an Automation Studio storage root on disk and writes
// what `checkStoreTraces` and `inspectProjectTraces` report: counts, names,
// sequences and sizes, never a payload. Point it at a copy: opening a store
// applies Core's migrations to it.
//
//   node packages/test-runner/dist/trace-parity/cli.js <automationDataDir> [--tail <n>] [--out <file>]

import { writeFile } from "node:fs/promises";
import { inspectProjectTraces } from "../trace-inspection/index.js";
import { checkStoreTraces } from "./check-store-traces.js";

const args = process.argv.slice(2);
const option = (name: string): string | undefined => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
const automationDataDir = args[0];
if (automationDataDir === undefined || automationDataDir.startsWith("--")) {
  process.stderr.write("usage: trace-parity/cli.js <automationDataDir> [--tail <n>] [--out <file>]\n");
  process.exit(2);
}
const tail = option("--tail");
const parity = await checkStoreTraces({ automationDataDir, ...(tail === undefined ? {} : { tailLength: Number(tail) }) });
const inspections = [];
for (const project of parity.projects) {
  const inspection = await inspectProjectTraces({ automationDataDir, projectId: project.projectId });
  inspections.push({
    projectId: inspection.projectId, storage: inspection.storage ?? null, dedupe: inspection.dedupe,
    traces: inspection.traces.map(trace => ({
      traceId: trace.traceId, activity: trace.activity, claimedCompleteness: trace.claimedCompleteness, completeness: trace.completeness.status,
      issues: trace.completeness.issues.map(issue => issue.code), events: trace.events, eventsByKind: trace.eventsByKind, storedBytes: trace.storedBytes,
      artifacts: trace.artifacts, commandTimings: { commands: trace.commandTimings.commands, answered: trace.commandTimings.answered }, redactionsByReason: trace.redactionsByReason,
    })),
  });
}
const text = `${JSON.stringify({ parity, inspections }, null, 2)}\n`;
const out = option("--out");
if (out === undefined) process.stdout.write(text);
else await writeFile(out, text);
