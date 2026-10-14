// The authoring mode every Core the Lab starts runs in, as Core's one setting
// (`FLUXIQ_AUTHORING_MODE`, Core `model/authoring-mode/`), passed the way the
// default model is (`./default-model-env.ts`).
//
// `legacy` is the Lab's default: a build proposes an adaptation, which the chat
// applies and the Lab's direct build approves and applies, then runs and
// judges. `candidate` submits the whole Flow as a candidate that Core tests from
// its declared start before proposing it; the created-Flow lane admits it only
// when Core has a trial runner and a start reset
// (`../flow-lane/creation/readiness.ts`), and the creation-qualification lanes
// name it explicitly. `project` (opt-in) has a project supervisor plan the
// Flow's subflows and assemble its builders' work into one candidate, admitted
// on the same terms.
//
// The Lab's default is its own, not Core's. Core's configured product default
// became `candidate` in t450 (2026-10-11) while the Lab's stayed `legacy`
// (`docs/architecture/build-loop.md`); reading Core's constant here had silently
// moved every run that names no mode to candidate.
//
// It is read from the run's `--authoring-mode` and from nothing else, and it is
// always given to Core explicitly: a value inherited from whoever launched the
// Lab is dropped (`../environment.ts`), so the mode a run records
// (`LiveLlmPlan.coreAuthoringMode`, `snapshots/live-llm.json`) is the mode its
// Core was started in.

import { AUTOMATION_STUDIO_AUTHORING_MODE_ENV, resolveAutomationStudioAuthoringMode, type AutomationStudioAuthoringMode } from "fluxiq/automation-studio";

/** The variable Core reads (`fluxiq/automation-studio` `AUTOMATION_STUDIO_AUTHORING_MODE_ENV`). */
export const LAB_AUTHORING_MODE_ENV = AUTOMATION_STUDIO_AUTHORING_MODE_ENV;

/** The flag that sets it for one run. */
export const LAB_AUTHORING_MODE_FLAG = "--authoring-mode";

/** The mode a run that names none starts its Core in, whatever Core's own default is. */
const LAB_DEFAULT_AUTHORING_MODE: AutomationStudioAuthoringMode = "legacy";

/**
 * The authoring mode for the Core started with `args`: `--authoring-mode` when
 * given, else the Lab's default (`legacy`). A value Core would refuse is refused
 * here, through Core's own resolver, before anything starts.
 */
export function labAuthoringModeValue(args: readonly string[] = process.argv): AutomationStudioAuthoringMode {
  const at = args.indexOf(LAB_AUTHORING_MODE_FLAG);
  if (at < 0) return LAB_DEFAULT_AUTHORING_MODE;
  const flagged = args[at + 1];
  if (flagged === undefined || flagged.startsWith("--") || flagged.trim() === "") throw new Error(`${LAB_AUTHORING_MODE_FLAG} needs a mode: legacy, candidate or project`);
  try {
    return resolveAutomationStudioAuthoringMode({ [LAB_AUTHORING_MODE_ENV]: flagged });
  } catch (error) {
    throw new Error(`${LAB_AUTHORING_MODE_FLAG} ${flagged} cannot be the authoring mode of the run's Core: ${error instanceof Error ? error.message : String(error)}`);
  }
}
