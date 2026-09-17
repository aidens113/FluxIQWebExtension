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
  ["--llm-max-input-tokens", "48000"], ["--llm-max-output-tokens", "8000"], ["--llm-max-total-tokens", "56000"],
  ["--llm-max-run-tokens", "600000"], ["--llm-max-calls", "26"], ["--llm-max-cost-usd", "0.25"],
]);

/**
 * The same budget for building a Flow, and it has to be stated rather than left
 * to the default.
 *
 * A creation task used to pass no limits at all, so it inherited
 * `DEFAULT_LLM_LAB_BUDGET`'s `maxInputTokens: 8000` while a repair task ran on
 * 42000 -- five times smaller, for no reason other than that nobody named it.
 * Measured 2026-09-17 across thirty-six live creation tasks: seven of the ten
 * failures were `flow_bootstrap.provider_input_budget_exceeded`, thrown before
 * the request was ever sent, and the grant ends there, so the run produced no
 * Flow at all. The slice holding the realistic pages -- an infinite feed, a
 * multi-tab order lookup, an auth gate, an admin console with a virtualised
 * list -- scored zero of six, four of them on that code alone, while the slice
 * of small forms scored six of seven.
 *
 * Describing a real page costs tokens, and 8000 is not enough to describe one.
 * The model's context is 64k, so this was a self-imposed ceiling rather than a
 * provider one. Cost stays bounded where it belongs: by the per-run token
 * budget and the cost ceiling below, not by a limit that makes a large page
 * undescribable.
 */
const CREATE_LIMITS = Object.freeze([
  ["--llm-max-input-tokens", "48000"], ["--llm-max-output-tokens", "8000"], ["--llm-max-total-tokens", "56000"],
  ["--llm-max-run-tokens", "600000"], ["--llm-max-cost-usd", "0.25"],
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
  if (!repair) {
    const createLimits = CREATE_LIMITS.filter(([name]) => !options.labArgs.includes(name)).flat();
    return ["run", task.scenarioId, ...(task.variantId ? ["--variant", task.variantId] : []), ...identity, "--llm-task", "create-flow", "--instruction-task", task.id, ...createLimits, ...options.labArgs];
  }
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
