// A node run whose command waited out a robot check that cleared by itself.
//
// The client says so on its result payload as `checkWait: { waitedMs }`
// (`actions/cleared-check-wait.ts`, put there by `client/gateway-mapping.ts`),
// and only when the check stood and lifted without anyone touching it. The
// node's outcome packet never carried it -- the validation that held it as
// prose is not on the packet -- so Core could not tell a step that waited out a
// check from one that met none, and the chat's robot-check card could not
// close as cleared on its own.
//
// It is written onto the execution just built, as `withCallStates` writes the
// states, under the key Core's reader learned for it: `clearedWait`
// (`../capture.ts`, `WEB_LLM_EVIDENCE_RESULT_KEYS_CORE_READS`). Copied through
// the same bound the gateway applies, so a payload that arrived malformed, or
// with anything beside `waitedMs`, adds nothing.

import type { JsonValue } from "fluxiq/core";
import { webAutomationClearedCheckWaitValue } from "../../../actions/cleared-check-wait";
import type { WebLlmEvidenceToolExecution } from "../capture";
import { isJsonRecord } from "../untrusted-json";

/** The execution, carrying `clearedWait` when the command's payload says a check cleared by itself. */
export function withClearedWait(payload: JsonValue | undefined, execution: WebLlmEvidenceToolExecution): WebLlmEvidenceToolExecution {
  const clearedWait = webAutomationClearedCheckWaitValue(isJsonRecord(payload) ? payload.checkWait : undefined);
  if (clearedWait !== undefined) execution.clearedWait = clearedWait;
  return execution;
}
