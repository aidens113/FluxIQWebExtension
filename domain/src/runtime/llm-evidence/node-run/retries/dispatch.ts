// A node a build runs against the live page -- while it explores, and while its
// own test runs replay the draft -- is dispatched under Core's default retries,
// the same ones a saved Flow's playback and a candidate trial get (t355).
//
// **The user's rule (2026-10-07):** every node retries automatically, even while
// exploring; a step must never fail on one too-early attempt or just give up.
// Until this file, `../run.ts` and `../replay.ts` sent each node once and handed
// the first answer to the model or the test. Lane A round 4
// (`run-muyrpbnk-fef374e7`, step 0014) is the case it was written against:
// crossborder's "Get coupons" press came back `page_busy_try_later` -- the page
// wrote "Network busy, please try again" -- and nothing tried again.
//
// **Two layers, one policy each, and neither is restated here.**
//
//  - Inside one attempt, the extension waits for the target to be actionable
//    after the page settles, and absorbs what was decided before anything was
//    dispatched -- a target not drawn yet, a layer over it, a disabled control
//    counting down -- bounded to about five seconds and never past the
//    command's own timeout (`apps/extension/src/content/action-runtime/recovery/`).
//  - Across attempts, Core's default: the first attempt and three retries, with
//    Core's waits and Core's act-twice gates
//    (`automationStudioDispatchWithNodeRetries`, reading
//    `AUTOMATION_STUDIO_DEFAULT_NODE_RETRY_POLICY`). This file only says how to
//    dispatch the node and how to read its answer.
//
// **A lasting act is checked, never blindly repeated.** The node is described
// to Core by this domain's one read-or-change fact (`webAutomationActionEffect`
// via the catalog's `effect`), so a press whose failure was found after it acted,
// or whose effect is unknown, is not dispatched again; a press the page turned
// away before it landed (`effect: "unacted"` -- too fast, busy, not drawn yet)
// is, because nothing happened to repeat.
//
// **An uncertain press says so (t359).** When a press's failure leaves its
// effect unknown, Core asks the caller's effect check when it gives one
// (`checkEffect`): a press that landed counts as done, one that did not is
// made again, and without an answer the press is not repeated and the result
// says `lastingAct: "uncertain"` so the caller can tell the model the step's
// outcome is uncertain rather than that it failed.

import { automationStudioDispatchWithNodeRetries, type AutomationStudioFailureRecord, type AutomationStudioLastingActCheck, type AutomationStudioNodeRetryReading } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import type { WebLlmEvidenceGateway } from "../../capture";
import { present } from "../../present";
import { isJsonRecord } from "../../untrusted-json";
import type { WebNodeRun } from "../context";
import { webNodeRetryWait } from "./wait";

/** What the gateway answers one command with. */
export type WebNodeDispatchResult = Awaited<ReturnType<WebLlmEvidenceGateway["executeAction"]>>;

/**
 * The node's answer after its retries, how many times it was dispatched, and
 * how a lasting act whose effect the failure left unknown was settled: `landed`
 * (it counts as done) or `uncertain` (it was not made again). Absent otherwise.
 */
export type WebNodeRetriedDispatch = { result: WebNodeDispatchResult; attempts: number; lastingAct?: "landed" | "uncertain" };

/**
 * Dispatches one node command, and dispatches it again after each fault Core's
 * default policy absorbs. The answer is the last attempt's own.
 *
 * `node` is the catalog's description of the node: its definition id, and
 * whether running it changes the page. `noted`, when given, is told how many
 * attempts there were.
 */
export async function webNodeDispatchWithRetries(
  run: Pick<WebNodeRun, "gateway" | "sessionId" | "request">,
  node: { definitionId: string; effect: "observe" | "mutate" },
  command: { actionType: string; parameters: JsonObject; metadata: JsonObject },
  noted?: { attempts?: number },
  checkEffect?: AutomationStudioLastingActCheck<WebNodeDispatchResult>
): Promise<WebNodeRetriedDispatch> {
  const outcome = await automationStudioDispatchWithNodeRetries<WebNodeDispatchResult>({
    node: { id: node.definitionId, definitionId: node.definitionId, metadata: { effect: node.effect } },
    // Core sends nothing more once the build is cancelled between attempts.
    dispatch: async () => await run.gateway.executeAction(run.sessionId, command),
    read: webNodeRetryReading,
    checkEffect,
    delay: webNodeRetryWait,
    signal: run.request.signal
  });
  // On the call's own record too, when one is given, so a refusal raised after the retries says how many there were.
  if (noted) noted.attempts = outcome.attempts;
  return present<WebNodeRetriedDispatch>({ result: outcome.result, attempts: outcome.attempts, lastingAct: outcome.lastingAct });
}

/**
 * One answer as Core's policy reads it: success, or a failure carrying the
 * client's own record when it sent a well-formed one. A failure without one --
 * a bare `timed_out`, a dropped channel with no record -- is not guessed at,
 * so it is the answer.
 */
function webNodeRetryReading(result: WebNodeDispatchResult): AutomationStudioNodeRetryReading {
  if (result.status === "succeeded") return { ok: true };
  const failure = failureRecord(result.failure);
  return failure ? { ok: false, failure } : { ok: false };
}

/**
 * The client's record, taken only when it has the three fields the policy
 * decides on. It crossed the WebSocket from the browser, so it is read field by
 * field rather than trusted as a type.
 */
function failureRecord(value: unknown): AutomationStudioFailureRecord | undefined {
  if (!isJsonRecord(value)) return undefined;
  const { code, category, retryable } = value;
  if (typeof code !== "string" || typeof category !== "string" || typeof retryable !== "boolean") return undefined;
  return value as unknown as AutomationStudioFailureRecord;
}
