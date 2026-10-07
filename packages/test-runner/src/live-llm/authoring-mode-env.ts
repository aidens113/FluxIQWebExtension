// The authoring mode every Core the Lab starts runs in, as Core's one setting
// (`FLUXIQ_AUTHORING_MODE`, Core `model/authoring-mode/`), passed the way the
// default model is (`./default-model-env.ts`).
//
// `legacy` (the default) is the creation path a person gets by default: a build
// proposes an adaptation, which the chat applies and the Lab's direct build
// approves and applies, then runs and judges. `candidate` saves an unverified
// candidate draft that nothing executes, verifies or promotes yet, so the
// created-Flow lane refuses before any provider call in that mode
// (`../flow-lane/creation/readiness.ts`).
//
// It is read from the run's `--authoring-mode` and from nothing else, and it is
// always given to Core explicitly: a value inherited from whoever launched the
// Lab is dropped (`../environment.ts`), so the mode a run records
// (`LiveLlmPlan.coreAuthoringMode`, `snapshots/live-llm.json`) is the mode its
// Core was started in.

import { AUTOMATION_STUDIO_AUTHORING_MODE_DEFAULT, AUTOMATION_STUDIO_AUTHORING_MODE_ENV, resolveAutomationStudioAuthoringMode, type AutomationStudioAuthoringMode } from "fluxiq/automation-studio";

/** The variable Core reads (`fluxiq/automation-studio` `AUTOMATION_STUDIO_AUTHORING_MODE_ENV`). */
export const LAB_AUTHORING_MODE_ENV = AUTOMATION_STUDIO_AUTHORING_MODE_ENV;

/** The flag that sets it for one run. */
export const LAB_AUTHORING_MODE_FLAG = "--authoring-mode";

/**
 * The authoring mode for the Core started with `args`: `--authoring-mode` when
 * given, else Core's default (`legacy`). A value Core would refuse is refused
 * here, through Core's own resolver, before anything starts.
 */
export function labAuthoringModeValue(args: readonly string[] = process.argv): AutomationStudioAuthoringMode {
  const at = args.indexOf(LAB_AUTHORING_MODE_FLAG);
  if (at < 0) return AUTOMATION_STUDIO_AUTHORING_MODE_DEFAULT;
  const flagged = args[at + 1];
  if (flagged === undefined || flagged.startsWith("--") || flagged.trim() === "") throw new Error(`${LAB_AUTHORING_MODE_FLAG} needs a mode: legacy or candidate`);
  try {
    return resolveAutomationStudioAuthoringMode({ [LAB_AUTHORING_MODE_ENV]: flagged });
  } catch (error) {
    throw new Error(`${LAB_AUTHORING_MODE_FLAG} ${flagged} cannot be the authoring mode of the run's Core: ${error instanceof Error ? error.message : String(error)}`);
  }
}
