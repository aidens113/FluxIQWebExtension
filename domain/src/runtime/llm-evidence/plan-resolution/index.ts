// Resolving the opaque handles a model wrote into a plan node: the target
// handles its packets showed it (`target-packets.ts` remembers them per Flow
// and page) and the extraction handles the detection tool issued, into the
// selectors and `extractList` requests the node runs with
// (`resolve-plan-node.ts`, with the extraction node's list in
// `extraction/slot.ts`, its columns in `extraction/columns.ts` and the
// conditions that say which items are records in `extraction/conditions.ts`).

export {
  resolveWebPlanNode,
  resolveWebPlanNodeParameters,
  WEB_PLAN_HANDLE_ISSUE_CODES,
  type WebPlanHandleIssue,
  type WebPlanHandleIssueCode,
  type WebPlanHandleStores,
  type WebPlanNodeOutcome,
  type WebPlanNodeResolution,
  type WebPlanNodeResolutionInput
} from "./resolve-plan-node";
// The key a step's argument carries its row under, declared to Core (`rowContextKeys`).
export { WEB_LLM_ROW_CONTEXT_KEYS } from "./row-context-keys";
// What a step says its own action would lastingly do, and Core's answer.
export {
  WEB_PLAN_STEP_ISSUE_CODES,
  webPlanStepMustDeclare,
  webPlanStepPermission,
  type WebPlanStepIssueCode,
  type WebPlanStepPermission
} from "./step-permission";
export {
  createWebLlmTargetPackets,
  type WebLlmTargetPackets,
  type WebLlmTargetResolution,
  type WebLlmTargetScope
} from "./target-packets";
