import type { InvariantResult } from "@fluxiq-web-extension/test-contracts";
import type { FlowLanePermissionStop } from "../../lane-rules/index.js";

/** The invariant id that records a run whose build stopped to ask at the task's permission point. */
export const PERMISSION_STOP_INVARIANT = "stopped-for-permission";

/**
 * The failed invariant an evaluation carries for a build that stopped to ask
 * the person at the task's declared permission point
 * (`../../lane-rules/built-flow.ts`). Stopping there is correct, and no Flow
 * was built, so the run did not do its task: the invariant never passes, which
 * is what keeps the evaluation's `verdict` from ever reading `passed` for it,
 * and its `actual` names the consequence and control the build stopped at, so
 * `evaluation.json` says plainly what happened (`honestRunVerdict`).
 */
export function permissionStopInvariant(stop: FlowLanePermissionStop, evidenceSequences: readonly number[] = []): InvariantResult {
  const at = stop.control === "matched" ? "the task's declared control" : "a control the build did not name";
  return {
    id: PERMISSION_STOP_INVARIANT,
    passed: false,
    expected: "a created Flow that did the task",
    actual: `stopped_for_permission: asked permission to ${stop.consequence} at ${at} (control ${stop.control}); no Flow was built`,
    evidenceSequences: [...evidenceSequences],
  };
}
