import type { ChatResult } from "@fluxiq/ui-components";
import type { PanelResult } from "../../../state";
import { asRecord } from "./as-record";
import { failureOf } from "./failure-of";

/** A failed result when `result` failed or the relay's reply inside it says `ok: false`; otherwise undefined. */
export function refusalOf(result: PanelResult<unknown>): ChatResult<never> | undefined {
  if (!result.ok) {
    return failureOf(result);
  }
  const reply = asRecord(result.value);
  if (reply?.ok !== false) {
    return undefined;
  }
  const sentence = typeof reply.sentence === "string" ? reply.sentence : "FluxIQ refused that.";
  if (typeof reply.code === "string") {
    return { ok: false, sentence, code: reply.code };
  }
  return { ok: false, sentence };
}
