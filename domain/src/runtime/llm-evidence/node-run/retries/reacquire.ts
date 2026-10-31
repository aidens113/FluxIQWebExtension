import { executeWebEvidenceAction } from "../../action-failure";
// A node a build runs against the live page finds its stale target again
// (t786, D7): the domain's side of Core's `reacquire` callback on
// `automationStudioDispatchWithNodeRetries`.
//
// Core asks it once, after the node's second failed retry on a target failure
// that never acted, under the same predicate a graph run uses; this file never
// asks that question again. A caller says how to find the target again
// (`WebNodeReacquire`: the row-bound replay's `./replay-row-reacquire.ts`, the
// exploration press's `./looked-up-reacquire.ts`) and answers with the
// parameters the remaining attempts are dispatched with; this file turns that
// into Core's answer:
//
// - `found`: the same command with the fresh parameters, each answer kept with
//   the rest so the node's answer is read over every attempt (`./answer.ts`);
// - `gone`: no retry is spent, and the node ends with a failure that says so,
//   under Core's own code (`AUTOMATION_STUDIO_TARGET_GONE_CODE`), never the
//   page's not-found -- which a replay would read as a step the site
//   remembered and pass;
// - `unmatched` and `unavailable`: the retries run on as before. A finder that
//   throws is `unavailable`, never a failed node.

import { AUTOMATION_STUDIO_TARGET_GONE_CODE, type AutomationStudioFailureRecord, type AutomationStudioNodeRetryReacquire } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import type { WebNodeRun } from "../context";
import type { WebNodeDispatchResult } from "./dispatch";
import { webAutomationExtractListReferenceNow } from "../../../../output-nodes/extract-list";
import type { WebNodeDispatchCapture } from "../frozen-execution";

/** What a caller found: the parameters to dispatch with, or why there are none. */
export type WebNodeReacquired = { outcome: "found"; parameters: JsonObject } | { outcome: "gone" } | { outcome: "unmatched" | "unavailable" };

/** How a caller finds a node's stale target again, told the failure that made it stale. */
export type WebNodeReacquire = (failure: AutomationStudioFailureRecord) => Promise<WebNodeReacquired>;

/** Core's callback for `reacquire`, dispatching `command` with the found parameters and keeping every answer in `answers` (header). */
export function webNodeRetryReacquire(
  run: Pick<WebNodeRun, "gateway" | "sessionId"> & Partial<Pick<WebNodeRun, "request">>,
  command: { actionType: string; parameters: JsonObject; metadata: JsonObject },
  reacquire: WebNodeReacquire,
  answers: WebNodeDispatchResult[],
  capture?: WebNodeDispatchCapture
): (input: { failure: AutomationStudioFailureRecord }) => Promise<AutomationStudioNodeRetryReacquire<WebNodeDispatchResult>> {
  return async ({ failure }) => {
    const found = await reacquire(failure).catch((): WebNodeReacquired => ({ outcome: "unavailable" }));
    if (found.outcome === "found") {
      capture?.refreshed(found.parameters);
      const parameters = command.actionType === "web.dom.extract_list" ? webAutomationExtractListReferenceNow(found.parameters, run.request?.referenceNow) : found.parameters;
      const fresh = { ...command, parameters };
      return {
        outcome: "found",
        dispatch: async () => {
          const send = () => run.gateway.executeAction(run.sessionId, fresh);
          const answer = await executeWebEvidenceAction(() => capture === undefined ? send() : capture.dispatch(fresh, send));
          answers.push(answer);
          return answer;
        }
      };
    }
    if (found.outcome === "gone") {
      const result = goneResult();
      answers.push(result);
      return { outcome: "gone", result };
    }
    return { outcome: found.outcome };
  };
}

/** The answer a node whose item is gone ends with: Core's gone record, which nothing retries or repairs (D6). */
function goneResult(): WebNodeDispatchResult {
  const failure: AutomationStudioFailureRecord = {
    category: "target_not_found",
    code: AUTOMATION_STUDIO_TARGET_GONE_CODE,
    retryable: false,
    stage: "target_resolution",
    effect: "unacted",
    expected: "the item the step was for",
    actual: "gone"
  };
  return { status: "failed", failure, error: AUTOMATION_STUDIO_TARGET_GONE_CODE };
}
