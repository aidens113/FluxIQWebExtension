// The authoring mode every Core the Lab starts runs in, as Core's one setting
// (`FLUXIQ_AUTHORING_MODE`, Core `model/authoring-mode/`), passed the way the
// default model is (`./default-model-env.ts`).
//
// `answer-first` (the Answer First plan) ends a task on its result: a first attempt
// answers and saves a draft, and a later one proves the Flow. It is selected by name
// once Core's resolver takes it, since this module asks Core, and its run is scored
// by `answerVerdict` (`../flow-lane/creation/answer/`).
//
// `legacy` is the Lab's default today: a build proposes an adaptation, which the chat
// applies and the Lab's direct build approves and applies, then runs and
// judges. `candidate` submits the whole Flow as a candidate that Core tests from
// its declared start before proposing it; the created-Flow lane admits it only
// when Core has a trial runner and a start reset
// (`../flow-lane/creation/readiness.ts`), and the creation-qualification lanes
// name it explicitly. `project` (opt-in) has a project supervisor plan the
// Flow's subflows and assemble its builders' work into one candidate, admitted
// on the same terms.
//
// The Lab's default is its own until the merge that lands `answer-first`, when it
// becomes the product's: one line, marked below (user, 2026-11-03). Core's configured
// product default is `project` today, which the Lab does not follow until then.
//
// It is read from the run's `--authoring-mode` and from nothing else, and it is
// always given to Core explicitly: a value inherited from whoever launched the
// Lab is dropped (`../environment.ts`), so the mode a run records
// (`LiveLlmPlan.coreAuthoringMode`, `snapshots/live-llm.json`) is the mode its
// Core was started in.

import { AUTOMATION_STUDIO_AUTHORING_MODE_ENV, resolveAutomationStudioAuthoringMode, type AutomationStudioAuthoringMode } from "fluxiq/automation";

/** The Answer First mode's name, as Core will spell it. `fluxiq/automation` does not export it yet, so it is compared as a word. */
export const LAB_ANSWER_FIRST_AUTHORING_MODE = "answer-first";

/** Whether a run's Core authors answer-first, read as a word so it compiles before and after Core's type takes the mode. */
export function labAuthorsAnswerFirst(authoringMode: unknown): boolean {
  return authoringMode === LAB_ANSWER_FIRST_AUTHORING_MODE;
}

/** The variable Core reads (`fluxiq/automation` `AUTOMATION_STUDIO_AUTHORING_MODE_ENV`). */
export const LAB_AUTHORING_MODE_ENV = AUTOMATION_STUDIO_AUTHORING_MODE_ENV;

/** The flag that sets it for one run. */
export const LAB_AUTHORING_MODE_FLAG = "--authoring-mode";

/**
 * The mode a run that names none starts its Core in.
 * FLIP AT THE ANSWER-FIRST MERGE (one line, the lead's): `= AUTOMATION_STUDIO_AUTHORING_MODE_DEFAULT`, imported from `fluxiq/automation`, so the Lab's default equals the product's.
 */
const LAB_DEFAULT_AUTHORING_MODE: AutomationStudioAuthoringMode = "legacy";

/**
 * The authoring mode for the Core started with `args`: `--authoring-mode` when
 * given, else the Lab's default (`legacy`). A value Core would refuse is refused
 * here, through Core's own resolver, before anything starts.
 */
export function labAuthoringModeValue(args: readonly string[] = process.argv, resolve: typeof resolveAutomationStudioAuthoringMode = resolveAutomationStudioAuthoringMode): AutomationStudioAuthoringMode {
  const at = args.indexOf(LAB_AUTHORING_MODE_FLAG);
  if (at < 0) return LAB_DEFAULT_AUTHORING_MODE;
  const flagged = args[at + 1];
  if (flagged === undefined || flagged.startsWith("--") || flagged.trim() === "") throw new Error(`${LAB_AUTHORING_MODE_FLAG} needs a mode: legacy, candidate, project or ${LAB_ANSWER_FIRST_AUTHORING_MODE}`);
  try {
    return resolve({ [LAB_AUTHORING_MODE_ENV]: flagged });
  } catch (error) {
    throw new Error(`${LAB_AUTHORING_MODE_FLAG} ${flagged} cannot be the authoring mode of the run's Core: ${error instanceof Error ? error.message : String(error)}`);
  }
}
