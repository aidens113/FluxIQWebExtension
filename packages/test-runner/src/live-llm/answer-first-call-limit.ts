import { labAuthorsAnswerFirst } from "./authoring-mode-env.js";

/** The flag that types a call allowance for one run. */
export const LAB_CALL_LIMIT_FLAG = "--llm-max-calls";

/**
 * The call allowance to hold a run's Core to, as the option that carries it, or nothing.
 *
 * An answer-first attempt's call cap sits on its purse and reaching it reads as budget out, so a run
 * on that mode is held to one only when it typed `--llm-max-calls` (as `lab attempt` does), never to
 * the plan's default. Any other mode is held to the plan's allowance as it always was.
 */
export function labBuildCallLimitFor(run: { readonly coreAuthoringMode: unknown; readonly authorizedBuildCallLimit: number }, args: readonly string[]): { buildCallLimit?: number } {
  if (labAuthorsAnswerFirst(run.coreAuthoringMode) && !args.includes(LAB_CALL_LIMIT_FLAG)) return {};
  return { buildCallLimit: run.authorizedBuildCallLimit };
}
