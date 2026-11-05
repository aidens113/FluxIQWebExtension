import type { SubflowSaveOutcome } from "@fluxiq/ui-components";
import { count, record, text } from "./values";

const STATUSES = ["created", "new_version", "existing"] as const;

/** Core's answer to "save this": kept (which way), or not kept and why in Core's words. Anything else is unreadable. */
export function readSave(value: unknown): SubflowSaveOutcome | undefined {
  const answer = record(value);
  if (answer?.saved === true) {
    const partId = text(answer.partId);
    const version = count(answer.version);
    const status = STATUSES.find((known) => known === answer.status);
    return partId === undefined || version === undefined || status === undefined ? undefined : { saved: true, partId, version, status };
  }
  const message = text(answer?.message);
  return answer?.saved === false && message !== undefined ? { saved: false, code: text(answer.code) ?? "", message } : undefined;
}
