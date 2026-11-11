import type { ChatResult } from "@fluxiq/ui-components";
import type { PanelResult } from "../../../state";
import { namedFailureOf } from "./named-failure-of";
import { payloadOf } from "./payload-of";

/**
 * A thread list change's reply (New chat, Rename, Delete) as the chat's result.
 *
 * The list shows a refusal as it stands, so a failure the background named
 * with a code keeps the words it came with as its sentence (`namedFailureOf`).
 * A failure with no code (the background did not answer) keeps the panel's sentence.
 */
export function threadChangeOf(result: PanelResult<unknown>): ChatResult<Record<string, unknown>> {
  return namedFailureOf(result) ?? payloadOf(result);
}
