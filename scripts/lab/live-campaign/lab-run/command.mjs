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
  // The same story as the input tokens above, one limit along, and it has to be
  // stated here for the same reason. Leaving the call count unnamed inherited
  // `DEFAULT_LLM_LAB_BUDGET.maxCallsPerRun: 26`, which mirrors Core's grant
  // default of a diagnosis, a patch and 24 exploration decisions -- a shape
  // that predates a build exploring by running the library's own nodes. On
  // 2026-09-23 the first six tasks of a ten-site campaign each made 19 to 28
  // calls and every one that passed 26 was failed as `performance.budget`
  // after the model had already done the work: `run-mudpkd77-e780792e` made 27
  // against an authorized 26, and $0.90 bought six runs that measured nothing.
  // 48 is above what a build of these pages has been observed to need and below
  // the contract ceiling of 64. What bounds the run stays what always bounded
  // it -- the per-run token budget and the cost ceiling below, not a count set
  // for a different shape of loop.
  ["--llm-max-calls", "48"],
  ["--llm-max-run-tokens", "600000"], ["--llm-max-cost-usd", "0.25"],
]);

/**
 * What a task's run is permitted to cause, as `--llm-permit`.
 *
 * **Who answers a permission question in a campaign, and how.** Nobody is
 * watching a campaign, so a build that stops to ask a person waits for an
 * answer that never comes. Two things keep that from being a harness failure.
 *
 * Core already permits any class it reads the person's own instruction as
 * asking for, whatever the grant holds -- the instruction is the authority --
 * so the ordinary consequential task needs nothing here at all. This is the
 * corpus's second opinion for the case where the two readings disagree: a task
 * whose instruction plainly asks for an act names the classes on itself
 * (`LiveInstructionTask.permits`), and its run is granted exactly those.
 *
 * A task that names none permits none. Its build then either proceeds on the
 * instruction's own authority, or stops and asks -- and a build that asks and
 * is not answered ends as `permission.required`, which is a result about the
 * product. What it must never be is a campaign-wide grant: permitting
 * `move_money` for every task would hide exactly the over-declaration this
 * measurement exists to find.
 *
 * An operator's own `--llm-permit` after `--` replaces this for every task in
 * the selection, because the Lab refuses an option given twice and because
 * somebody running one task by hand is the person the question is for.
 */
function permitArguments(task, options) {
  const permits = Array.isArray(task.permits) ? task.permits.filter((entry) => typeof entry === "string" && entry.length > 0) : [];
  if (permits.length === 0 || options.labArgs.includes("--llm-permit")) return [];
  return ["--llm-permit", permits.join(",")];
}

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
    return ["run", task.scenarioId, ...(task.variantId ? ["--variant", task.variantId] : []), ...identity, "--llm-task", "create-flow", "--instruction-task", task.id, ...createLimits, ...permitArguments(task, options), ...options.labArgs];
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
