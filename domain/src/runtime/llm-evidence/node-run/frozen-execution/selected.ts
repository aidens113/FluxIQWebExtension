import type { AutomationStudioLlmRerunExecutionAccess } from "fluxiq/automation-studio";
import { createWebNodeDispatchRecorder, webNodeFrozenRefreshedParameters } from "./dispatch";
import { webNodeFrozenJson } from "./json";
import type { WebNodeFrozenCall, WebNodeFrozenSelection } from "./types";

/** One selected transaction reports fresh main receipts without publishing another candidate. */
export function createWebNodeSelectedExecution(call: WebNodeFrozenCall, access: Extract<AutomationStudioLlmRerunExecutionAccess, { kind: "selected" }>): Extract<WebNodeFrozenSelection, { kind: "selected" }> {
  let logical = call.parameters;
  let base = call.command.parameters;
  const recorder = createWebNodeDispatchRecorder({ sessionId: call.scope.sessionId, actionType: call.command.actionType, referenceNow: call.referenceNow, parameters: () => logical });
  let consumptionAsked = false;
  let consumed = false;
  let finished = false;
  let valid = true;
  return {
    kind: "selected", call,
    consume() {
      if (consumptionAsked || finished) return false;
      consumptionAsked = true;
      consumed = access.consume(access.capsule).kind === "consumed";
      return consumed;
    },
    capture: {
      dispatch(command, execute) {
        if (!consumed || finished) return Promise.reject(new Error("The selected main dispatch is unavailable."));
        return recorder.dispatch(command, execute);
      },
      refreshed(parameters) {
        const refreshed = !finished && call.subjectKind === "element" ? webNodeFrozenRefreshedParameters(call.command.actionType, logical, base, parameters) : undefined;
        if (refreshed === undefined) {
          valid = false;
          return;
        }
        logical = refreshed;
        base = webNodeFrozenJson(parameters);
      }
    },
    finish() {
      if (finished) return { kind: "unavailable", reason: "report_closed" };
      finished = true;
      if (!consumed) return { kind: "unavailable", reason: "capsule_unconsumed" };
      const recorded = recorder.snapshot();
      if (!valid || recorded?.proven !== true || recorded.selected.receipt === undefined) return { kind: "unavailable", reason: "dispatch_unproven" };
      if (access.reportDispatch === undefined) return { kind: "unavailable", reason: "report_unavailable" };
      try {
        return access.reportDispatch(access.capsule, recorded.dispatch);
      } catch {
        // Core keeps the actual adapter result and marks missing trusted proof unproven.
        return { kind: "unavailable", reason: "report_unavailable" };
      }
    }
  };
}
