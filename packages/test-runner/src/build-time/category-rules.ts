import type { CategoryRule, StepTiming } from "./types.js";

/** A label naming a reset: `reset.cart.1`, `dispatch.reset.1`, `reset2`, `dryrun.1.reset`; not `preset`. */
const RESET_LABEL = /(^|[^a-z])reset/iu;
const TRIAL_TOOLS = new Set(["core.test_subflow", "core.test_candidate"]);
const MODEL_KINDS = new Set(["decide", "judge", "chat"]);
const BOOKKEEPING_TOOLS = new Set([
  "project.read_task", "project.write_plan", "project.amend_plan", "project.assemble",
  "core.submit_subflow", "core.describe_nodes", "core.recall_result"
]);

const resetLabelled = (step: StepTiming) => step.callId !== null && RESET_LABEL.test(step.callId);
const exploresPage = (step: StepTiming) => step.toolId !== null && (step.toolId.startsWith("web.") || step.toolId === "core.run_node");

/**
 * How a step's meta fields place it, first match wins. Derived from the
 * Lab's runs of 2026-10-06..19: trials are the two trial tools and the
 * reauthor round-test's dry-run nodes (`NNNN-test-core.run_node`). Resets are
 * a reset the model labelled (`callId`), a reset brief it dispatched, and,
 * since t737, Core's own `NNNN-reset` steps: the start hook and the site check
 * a trial runs before it acts, written inside the trial tool's window (Core's
 * `llm/step-log/reset-step.ts`). Runs from before t737 have none, so their
 * resets inside trials still count as trial.
 */
export const CATEGORY_RULES: readonly CategoryRule[] = [
  { id: "playback-run", category: "playback", describes: "kind run, phase playback: the Lab's replay of the applied Flow", matches: step => step.kind === "run" && step.phase === "playback" },
  { id: "playback-judge", category: "playback-judge", describes: "kind judge with no part: judges a playback when next to one, else model", matches: step => step.kind === "judge" && step.part === null },
  { id: "reset-dispatch", category: "reset", describes: "project.dispatch whose callId names a reset: the whole reset brief's window", matches: step => step.toolId === "project.dispatch" && resetLabelled(step) },
  { id: "dispatch", category: "container", describes: "project.dispatch: wraps a brief's own steps, counts nothing itself", matches: step => step.toolId === "project.dispatch" },
  { id: "reset-labelled", category: "reset", describes: "any step whose callId names a reset (model-chosen label)", matches: resetLabelled },
  { id: "trial-reset", category: "reset", describes: "kind reset: Core's own reset step (a trial's start hook or site check), inside a trial tool's window or before the judged whole run", matches: step => step.kind === "reset" },
  { id: "trial-tool", category: "trial", describes: "kind tool, core.test_subflow or core.test_candidate (judged candidate trial)", matches: step => step.kind === "tool" && step.toolId !== null && TRIAL_TOOLS.has(step.toolId) },
  { id: "trial-node", category: "trial", describes: "kind test: a dry-run node of a round-test; consecutive nodes of one round form one trial", matches: step => step.kind === "test" },
  { id: "model", category: "model", describes: "a provider call: kind decide, judge or chat, or any step naming a provider", matches: step => step.provider !== null || MODEL_KINDS.has(step.kind) },
  { id: "loop-answer", category: "other", describes: "kind answer: the loop's own refusal or recall, no work (0 ms)", matches: step => step.kind === "answer" },
  { id: "exploration", category: "exploration", describes: "kind tool, web.* or core.run_node: acting on or reading the live page", matches: step => step.kind === "tool" && exploresPage(step) },
  { id: "bookkeeping", category: "other", describes: `kind tool, ${[...BOOKKEEPING_TOOLS].join(", ")}: planning and candidate bookkeeping, no page`, matches: step => step.kind === "tool" && step.toolId !== null && BOOKKEEPING_TOOLS.has(step.toolId) }
];
