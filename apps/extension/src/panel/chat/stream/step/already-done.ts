// A run step Core skipped because its act was already done in this run, for
// the same row (Core's `executor/step-loop/already-done.ts`, t411): the
// friend request already confirmed is never confirmed again. No DOM.
//
// Core says it with one row, and only one: a run step (`step` set) that is
// already `succeeded` when it arrives, and carries no record of the node it
// would run (`detail.text`, "Node: web.click"), since nothing ran. Every other
// run step Core announces as `started` with that record and never ends
// (`messages.ts`), and a recovery's row names no step (`recovery-message.ts`).
// So the shape alone says it, and the row's words ("Already done for Lin
// Zhao") are never parsed. Its card reads "Already
// done", never "Didn't work", and is never taken for a step done again or a
// retry that worked (`done-again.ts`, `retried.ts`).

import { stepRecovery, type ClientGatewayActivity } from "../../../../shared/activity/index";

/** Whether `event` is Core's row for a run step skipped as already done. */
export function isAlreadyDoneStep(event: ClientGatewayActivity): boolean {
  const detail = event.detail;
  return event.step !== undefined && detail?.kind === "step" && detail.status === "succeeded" && detail.text === undefined && stepRecovery(event) === undefined;
}
