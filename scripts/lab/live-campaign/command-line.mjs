// What `pnpm lab:campaign` does with its arguments: print the usage, print a
// dry run's commands, or run the campaign and print where its summary is. A
// refusal is printed as one JSON line on stderr, followed by the usage.

import path from "node:path";
import { repositoryRoot } from "../lab-instance.mjs";
import { CAMPAIGN_USAGE, parseCampaignArgs } from "./arguments.mjs";
import { loadCatalog } from "./catalog.mjs";
import { displayCommand, labRunArguments, spawnLab } from "./lab-run/index.mjs";
import { runCampaign } from "./runner.mjs";
import { selectTasks } from "./selection.mjs";

/** Runs the campaign command for `argv` and sets the process exit code: 0 only when every task succeeded. */
export function runCommandLine(argv) {
  return campaignCommand(argv).then((code) => { process.exitCode = code; }, (error) => {
    process.stderr.write(`${JSON.stringify({ status: "failed", category: "campaign.usage", message: error instanceof Error ? error.message : String(error) })}\n${CAMPAIGN_USAGE}\n`);
    process.exitCode = 1;
  });
}

async function campaignCommand(argv) {
  const options = parseCampaignArgs(argv);
  if (options.help) { process.stdout.write(`${CAMPAIGN_USAGE}\n`); return 0; }
  const tasks = selectTasks(await loadCatalog(options), options);
  if (options.dryRun) {
    process.stdout.write(`# ${tasks.length} task(s), one at a time, npm_config_workspace_concurrency=1; each spawned as node scripts/lab/run-lab.mjs with these arguments\n`);
    for (const task of tasks) process.stdout.write(`${displayCommand(labRunArguments(task, options))}\n`);
    return 0;
  }
  const stamp = new Date().toISOString().replace(/[:.]/gu, "-");
  const runsDirectory = process.env.FLUXIQ_TEST_RUNS_DIR?.trim() || path.join(repositoryRoot, "test-runs");
  const outputDir = path.resolve(options.output ?? path.join(runsDirectory, "campaigns", stamp));
  const labScript = process.env.FLUXIQ_LAB_CAMPAIGN_LAB_SCRIPT?.trim() || path.join(repositoryRoot, "scripts", "lab", "run-lab.mjs");
  const summary = await runCampaign({ tasks, options, outputDir, execute: spawnLab(labScript) });
  process.stdout.write(`${JSON.stringify({ campaign: summary.campaignId, summary: path.join(outputDir, "summary.md"), totals: summary.totals })}\n`);
  return summary.totals.succeeded === summary.totals.tasks ? 0 : 1;
}
