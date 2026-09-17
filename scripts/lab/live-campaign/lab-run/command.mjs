// The command one task becomes: the arguments after `pnpm lab`, and how that
// command is shown in logs and in a dry run.

import { DEFAULT_PROFILES } from "./profiles.mjs";

/**
 * The per-call and per-run limits a repair run gets unless the same option is
 * given after `--`: the ones live adapt runs have worked with
 * (`run-mu4ovip2-b15551d3`). The Lab refuses an option given twice, so a
 * limit given after `--` replaces its default rather than joining it.
 */
const REPAIR_LIMITS = Object.freeze([
  ["--llm-max-input-tokens", "42000"], ["--llm-max-output-tokens", "8000"], ["--llm-max-total-tokens", "50000"],
  ["--llm-max-run-tokens", "600000"], ["--llm-max-calls", "26"], ["--llm-max-cost-usd", "0.25"],
]);

/**
 * The Lab arguments for one task, after `pnpm lab`. A creation task builds a
 * Flow from its instruction; a repair task runs the Flow recorded on the
 * unarmed page against its variant, with the model allowed to diagnose and
 * propose (`adapt`), under `REPAIR_LIMITS` less any given after `--`.
 */
export function labRunArguments(task, options) {
  const repair = task.kind === "repair";
  const identity = ["--live-llm", "--llm-profile", options.profile ?? (repair ? DEFAULT_PROFILES.repair : DEFAULT_PROFILES.create), "--llm-provider", options.provider, "--llm-model", options.model];
  if (!repair) return ["run", task.scenarioId, ...(task.variantId ? ["--variant", task.variantId] : []), ...identity, "--llm-task", "create-flow", "--instruction-task", task.id, ...options.labArgs];
  const limits = REPAIR_LIMITS.filter(([name]) => !options.labArgs.includes(name)).flat();
  return [
    "run", task.scenarioId, ...(task.workflowId ? ["--workflow", task.workflowId] : []), ...(task.variantId ? ["--variant", task.variantId] : []),
    "--flow", ...identity, "--llm-task", "adapt", ...limits, ...options.labArgs,
  ];
}

/** The command as a person would type it, quoting any argument a shell would split or expand. */
export function displayCommand(args) {
  return `pnpm lab ${args.map((arg) => (/^[\w@%+=:,./-]+$/u.test(arg) ? arg : JSON.stringify(arg))).join(" ")}`;
}
