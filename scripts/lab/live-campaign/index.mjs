// The live campaign behind `pnpm lab:campaign` (entry point:
// `scripts/lab/live-campaign.mjs`, which describes what a campaign does).
//
// By responsibility: `arguments.mjs` and `selection.mjs` read the command line
// and pick the tasks; `catalog.mjs` builds and loads the task lists;
// `lab-run/` is one Lab child process, from its command to whether it died of
// a RAM fault; `row/` reads a finished run into one judged summary row;
// `summary/` totals, renders and writes the summary; `runner.mjs` runs the
// tasks one at a time with retries; `command-line.mjs` is the entry point's
// work.

export { parseCampaignArgs } from "./arguments.mjs";
export { runCommandLine } from "./command-line.mjs";
export { labRunArguments, ramFaultSignature } from "./lab-run/index.mjs";
export { summarizeTask } from "./row/index.mjs";
export { runCampaign } from "./runner.mjs";
export { selectTasks } from "./selection.mjs";
export { renderSummaryMarkdown } from "./summary/index.mjs";
