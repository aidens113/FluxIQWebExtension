// The default model every Core the Lab starts builds a new Flow on, as one
// variable, passed the way the per-build cost ceiling is (`./cost-ceiling-env.ts`).
//
// A build started from the extension's chat makes its Flow inside Core's
// `flow.createHere` command, and that Flow names no model, so the build runs on
// Core's default model: `FLUXIQ_LLM_DEFAULT_MODEL`, read once when Core loads,
// `deepseek-flash` when unset, and a value Core is not configured for stops it
// at start (`runtime/llm/deepseek/models.ts` in Core). The Lab passes the run's
// `--llm-model` as that variable, so a chat build can be compared on another
// model (t233). It is read from the flag and from nothing else -- not the Lab's
// own environment, not `.env` -- and a value inherited from whoever launched
// the Lab is dropped (`../environment.ts`), so a run without `--llm-model`
// gives Core nothing and Core builds on its own default, which is the Lab's
// `DEFAULT_LLM_MODEL`. This is the developer's and the Lab's knob, not the
// product's model setting.

import { AUTOMATION_STUDIO_LLM_DEFAULT_MODEL_ENV, resolveAutomationStudioLlmDefaultModel } from "fluxiq/automation-studio";

/** The variable Core reads (`fluxiq/automation-studio` `AUTOMATION_STUDIO_LLM_DEFAULT_MODEL_ENV`). */
export const LAB_DEFAULT_MODEL_ENV = "FLUXIQ_LLM_DEFAULT_MODEL";

/** The flag that sets it for one run: the same `--llm-model` the run's profile names its model with. */
export const LAB_DEFAULT_MODEL_FLAG = "--llm-model";

/**
 * The model to pass to Core as its default, as Core will read it, or
 * `undefined` when `args` carries no `--llm-model`. A model Core is not
 * configured for is refused here, through Core's own resolver, so the Lab
 * never starts a Core that would stop on it.
 */
export function labDefaultModelValue(args: readonly string[] = process.argv): string | undefined {
  const at = args.indexOf(LAB_DEFAULT_MODEL_FLAG);
  if (at < 0) return undefined;
  const flagged = args[at + 1];
  if (flagged === undefined || flagged.startsWith("--")) throw new Error(`${LAB_DEFAULT_MODEL_FLAG} needs a model id, such as deepseek-v4-pro`);
  try {
    resolveAutomationStudioLlmDefaultModel({ [AUTOMATION_STUDIO_LLM_DEFAULT_MODEL_ENV]: flagged });
  } catch (error) {
    throw new Error(`${LAB_DEFAULT_MODEL_FLAG} ${flagged} cannot be the default model of the run's Core: ${error instanceof Error ? error.message : String(error)}`);
  }
  return flagged;
}
