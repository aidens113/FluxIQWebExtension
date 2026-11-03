import type { ChatResult } from "@fluxiq/ui-components";
import { EXTENSION_RESTARTED } from "../../../copy";
import type { PanelResult } from "../../../state";

/**
 * A failed panel result as the chat's failed result. When the background did
 * not answer, the chat's read notice names that as the cause.
 */
export function failureOf(failure: Extract<PanelResult<unknown>, { ok: false }>): ChatResult<never> {
  if (failure.sentence === EXTENSION_RESTARTED) {
    return { ...failure, cause: "the extension's background didn't answer" };
  }
  return failure;
}
