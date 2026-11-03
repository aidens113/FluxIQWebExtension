import type { ChatResult } from "@fluxiq/ui-components";
import type { PanelResult } from "../../../state";
import { asRecord } from "./as-record";
import { failureOf } from "./failure-of";

/** The relay's `{ ok: true, payload }` reply, as the payload. */
export function payloadOf(result: PanelResult<unknown>): ChatResult<Record<string, unknown>> {
  if (!result.ok) {
    return failureOf(result);
  }
  return { ok: true, value: asRecord(asRecord(result.value)?.payload) ?? {} };
}
