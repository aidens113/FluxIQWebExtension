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
 * reauthor round-test's dry-run nodes (`NNNN-test-core.run_node`); resets
 * have no step kind of their own, so only a reset the model labelled
 * (`callId`) or a reset brief it dispatched is visible -- a reset Core runs
 * inside a trial is not a step and stays inside the trial's window.
 */
export const CATEGORY_RULES: readonly CategoryRule[] = [
  { id: "playback-run", category: "playback", describes: "kind run, phase playback: the Lab's replay of the applied Flow", matches: step => step.kind === "run" && step.phase === "playback" },
  { id: "playback-judge", category: "playback-judge", describes: "kind judge with no part: judges a playback when next to one, else model", matches: step => step.kind === "judge" && step.part === null },
  { id: "reset-dispatch", category: "reset", describes: "project.dispatch whose callId names a reset: the whole reset brief's window", matches: step => step.toolId === "project.dispatch" && resetLabelled(step) },
  { id: "dispatch", category: "container", describes: "project.dispatch: wraps a brief's own steps, counts nothing itself", matches: step => step.toolId === "project.dispatch" },
  { id: "reset-labelled", category: "reset", describes: "any step whose callId names a reset (model-chosen label)", matches: resetLabelled },
  { id: "trial-tool", category: "trial", describes: "kind tool, core.test_subflow or core.test_candidate (judged candidate trial)", matches: step => step.kind === "tool" && step.toolId !== null && TRIAL_TOOLS.has(step.toolId) },
  { id: "trial-node", category: "trial", describes: "kind test: a dry-run node of a round-test; consecutive nodes of one round form one trial", matches: step => step.kind === "test" },
  { id: "model", category: "model", describes: "a provider call: kind decide, judge or chat, or any step naming a provider", matches: step => step.provider !== null || MODEL_KINDS.has(step.kind) },
  { id: "loop-answer", category: "other", describes: "kind answer: the loop's own refusal or recall, no work (0 ms)", matches: step => step.kind === "answer" },
  { id: "exploration", category: "exploration", describes: "kind tool, web.* or core.run_node: acting on or reading the live page", matches: step => step.kind === "tool" && exploresPage(step) },
  { id: "bookkeeping", category: "other", describes: `kind tool, ${[...BOOKKEEPING_TOOLS].join(", ")}: planning and candidate bookkeeping, no page`, matches: step => step.kind === "tool" && step.toolId !== null && BOOKKEEPING_TOOLS.has(step.toolId) }
];
