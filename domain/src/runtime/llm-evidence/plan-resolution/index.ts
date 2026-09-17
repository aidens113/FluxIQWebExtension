// Resolving the opaque handles a model wrote into a plan node: the target
// handles its packets showed it (`target-packets.ts` remembers them per Flow
// and page) and the extraction handles the detection tool issued, into the
// selectors and `extractList` requests the node runs with
// (`resolve-plan-node.ts`).

export {
  resolveWebPlanNodeParameters,
  WEB_PLAN_HANDLE_ISSUE_CODES,
  type WebPlanHandleIssueCode,
  type WebPlanHandleStores,
  type WebPlanNodeResolution,
  type WebPlanNodeResolutionInput
} from "./resolve-plan-node";
export {
  createWebLlmTargetPackets,
  type WebLlmTargetPackets,
  type WebLlmTargetResolution,
  type WebLlmTargetScope
} from "./target-packets";
