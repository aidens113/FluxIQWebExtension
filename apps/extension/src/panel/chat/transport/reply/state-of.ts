import type { ChatResult } from "@fluxiq/ui-components";
import type { PanelResult } from "../../../state";
import { asRecord } from "./as-record";
import { failureOf } from "./failure-of";

/** The activity relay's `{ ok: true, state }` reply, as the state. */
export function stateOf(result: PanelResult<unknown>): ChatResult<{ state?: unknown }> {
  if (!result.ok) {
    return failureOf(result);
  }
  return { ok: true, value: { state: asRecord(result.value)?.state } };
}
