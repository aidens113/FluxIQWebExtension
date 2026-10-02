// The model a new Flow's build runs on in the Core a Lab run starts -- the one
// a build typed into the extension's chat runs on, because the chat makes its
// Flow inside Core and that Flow names no model.
//
// The Lab gives Core its default from the run's `--llm-model`
// (`./default-model-env.ts`, `../environment.ts`); the Lab's plan records the
// same value, resolved through Core's own resolver, as the ceiling is recorded
// (`./build-cost-ceiling.ts`), so the chat-build check compares the run's model
// with what its Core was actually given rather than with a constant.

import { AUTOMATION_STUDIO_LLM_DEFAULT_MODEL_ENV, resolveAutomationStudioLlmDefaultModel, type AutomationStudioDeepSeekModel } from "fluxiq/automation-studio";
import { labDefaultModelValue } from "./default-model-env.js";

/**
 * Core's default model for the Core started with `args`: `--llm-model` when it
 * is given, else Core's own default. Throws on a model Core would refuse.
 */
export function liveLlmCoreDefaultModel(args: readonly string[] = process.argv): AutomationStudioDeepSeekModel {
  const value = labDefaultModelValue(args);
  return resolveAutomationStudioLlmDefaultModel(value === undefined ? {} : { [AUTOMATION_STUDIO_LLM_DEFAULT_MODEL_ENV]: value });
}
