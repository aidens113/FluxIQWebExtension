import type { ChatResult } from "@fluxiq/ui-components";
import type { PanelResult } from "../../../state";

/**
 * A failure the background named with a code, in the words it came with: Core's
 * own for a `failed` call -- "This conversation is still being used by work
 * that is running..." for `conversation_run_active`, "A task's humanness is a
 * whole number from 0 to 100..." for `task.humanness_invalid` -- and the
 * relay's own for the rest (`relay-failure.ts`, `core-api.ts`), each written
 * for a person. The panel's general sentence would put "Something went wrong."
 * in their place. Core's code rides along as `coreCode`.
 *
 * Undefined for a success, and for a failure with no code or no words (the
 * background did not answer), which keeps the panel's sentence.
 */
export function namedFailureOf(result: PanelResult<unknown>): ChatResult<never> | undefined {
  if (result.ok || result.code === undefined || result.detail === undefined || result.detail.trim() === "") return undefined;
  const failure = { ok: false as const, sentence: result.detail, detail: result.detail, code: result.code, ...(result.coreCode ? { coreCode: result.coreCode } : {}) };
  return failure;
}
