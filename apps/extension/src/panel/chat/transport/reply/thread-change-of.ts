import type { ChatResult } from "@fluxiq/ui-components";
import type { PanelResult } from "../../../state";
import { payloadOf } from "./payload-of";

/**
 * A thread list change's reply (New chat, Rename, Delete) as the chat's result.
 *
 * The list shows a refusal as it stands, so a failure the background named
 * with a code keeps the words it came with as its sentence: Core's own for a
 * `failed` call -- "This conversation is still being used by work that is
 * running..." for `conversation_run_active` -- and the relay's own for the rest
 * (`relay-failure.ts`, `core-api.ts`), each written for a person. The panel's
 * general sentence would put "Something went wrong." in their place. A failure
 * with no code (the background did not answer) keeps the panel's sentence.
 */
export function threadChangeOf(result: PanelResult<unknown>): ChatResult<Record<string, unknown>> {
  if (!result.ok && result.code !== undefined && result.detail !== undefined && result.detail.trim() !== "") {
    return { ok: false, sentence: result.detail, detail: result.detail, code: result.code };
  }
  return payloadOf(result);
}
