import { AUTOMATION_STUDIO_LLM_BUILD_CALL_LIMIT_ENV, AUTOMATION_STUDIO_LLM_BUILD_CALL_LIMIT_SCOPE_ENV } from "fluxiq/automation-studio";

/** Gives only this owned Core child the already-resolved Lab build allowance. */
export function labBuildCallLimitEnvironment(limit: number | undefined): NodeJS.ProcessEnv {
  if (limit === undefined) return {};
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error("A Lab build call limit must be a positive safe integer");
  return { [AUTOMATION_STUDIO_LLM_BUILD_CALL_LIMIT_ENV]: String(limit), [AUTOMATION_STUDIO_LLM_BUILD_CALL_LIMIT_SCOPE_ENV]: "test" };
}
