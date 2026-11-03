import type { ChatRecordingsPort } from "@fluxiq/ui-components";
import { RUNTIME_MESSAGES } from "../../../../shared/constants";
import type { PanelStore } from "../../../state";
import { asRecord, failureOf } from "../reply";

/** The recordings a person may attach, from the background's list. */
export function recordingsPort(request: PanelStore["request"]): ChatRecordingsPort {
  return {
    list: async (query) => {
      const result = await request({ type: RUNTIME_MESSAGES.listRecordings, ...query });
      if (!result.ok) {
        return failureOf(result);
      }
      const items = asRecord(asRecord(result.value)?.recordings)?.items;
      return { ok: true, value: Array.isArray(items) ? { items } : {} };
    }
  };
}
