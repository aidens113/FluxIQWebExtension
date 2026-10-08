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
// **A lasting act is checked, never blindly repeated, by the one definition
// playback uses (t361).** The node is described to Core as a saved Flow's web
// node is: a read says it reads (`effect: "observe"`), and a node that changes
// the page carries the consequences its call declared
// (`AUTOMATION_STUDIO_DECLARED_CONSEQUENCES_METADATA_KEY`), never a blanket
// "acts" marker. Each failure then carries this domain's statement about the
// act behind it (`../../../lasting-act-statement.ts`, the runtime adapter's
// own): a committing act -- a press, a key press, a dialog answer, typing that
// sends its form -- is `ambiguous` unless the failure shows nothing was
// dispatched. So Core holds back exactly what it holds back in playback: a
// committing act, or one whose call declared a lasting consequence, whose
// failure leaves its effect unknown. Plain typing, choosing, ticking,
// navigating and waiting keep the first attempt and three retries after any
// retryable failure, a read-back that did not match included; a press the page turned away before it landed
// (`effect: "unacted"` -- too fast, busy, not drawn yet, never delivered) is
// made again, because nothing happened to repeat. Until t361 every
// page-changing node was marked `effect: "mutate"` here, which held back
// typing and navigation too: a second definition, stricter than playback's.
//
// **An uncertain press says so (t359).** When a press's failure leaves its
// effect unknown, Core asks the caller's effect check when it gives one
// (`checkEffect`): a press that landed counts as done, one that did not is
// made again, and without an answer the press is not repeated and the result
// says `lastingAct: "uncertain"` so the caller can tell the model the step's
// outcome is uncertain rather than that it failed.

import { AUTOMATION_STUDIO_DECLARED_CONSEQUENCES_METADATA_KEY, automationStudioDispatchWithNodeRetries, type AutomationStudioFailureRecord, type AutomationStudioLastingActCheck, type AutomationStudioNodeRetryReading } from "fluxiq/automation-studio";
import type { JsonObject, JsonValue } from "fluxiq/core";
import { WEB_AUTOMATION_ACTION_TYPES, type WebAutomationActionType } from "../../../../actions/types";
import { webLastingActStatement } from "../../../lasting-act-statement";
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
 * `node` is the catalog's description of the node: its definition id,
 * whether running it changes the page, and the consequences the call declared
 * (`declared`, as the call wrote them; absent on a read and on a call that
 * declared none). `noted`, when given, is told how many attempts there were.
 */
export async function webNodeDispatchWithRetries(
  run: Pick<WebNodeRun, "gateway" | "sessionId" | "request">,
  node: { definitionId: string; effect: "observe" | "mutate"; declared?: JsonValue | undefined },
  command: { actionType: string; parameters: JsonObject; metadata: JsonObject },
  noted?: { attempts?: number },
  checkEffect?: AutomationStudioLastingActCheck<WebNodeDispatchResult>
): Promise<WebNodeRetriedDispatch> {
  const outcome = await automationStudioDispatchWithNodeRetries<WebNodeDispatchResult>({
    node: { id: node.definitionId, definitionId: node.definitionId, metadata: nodeMetadata(node) },
    // Core sends nothing more once the build is cancelled between attempts.
    dispatch: async () => await run.gateway.executeAction(run.sessionId, command),
    read: (result) => webNodeRetryReading(result, command),
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
function webNodeRetryReading(result: WebNodeDispatchResult, command: { actionType: string; parameters: JsonObject }): AutomationStudioNodeRetryReading {
  if (result.status === "succeeded") return { ok: true };
  const failure = failureRecord(result.failure);
  if (!failure) return { ok: false };
  // With this domain's statement about the act behind it, as the runtime adapter states it for playback.
  const actionType = webActionType(command.actionType);
  return { ok: false, failure: actionType === undefined ? failure : webLastingActStatement(actionType, command.parameters, failure, failure) };
}

/**
 * The node as Core's act-twice gates read it, written as a saved Flow's web
 * node is: a read says it reads, and a node that changes the page carries only
 * the consequences its call declared -- the plain strings, `[]` for none --
 * under Core's own key. Never `effect: "mutate"`, which would make every
 * page-changing node a lasting act (`automationStudioNodeActLasts`).
 */
function nodeMetadata(node: { effect: "observe" | "mutate"; declared?: JsonValue | undefined }): JsonObject {
  if (node.effect === "observe") return { effect: "observe" };
  const declared = Array.isArray(node.declared) ? node.declared.filter((entry): entry is string => typeof entry === "string" && entry !== "") : [];
  return { [AUTOMATION_STUDIO_DECLARED_CONSEQUENCES_METADATA_KEY]: declared };
}

/** The command's verb when it is one of this domain's, which is when the domain can state anything about it. */
function webActionType(actionType: string): WebAutomationActionType | undefined {
  return (WEB_AUTOMATION_ACTION_TYPES as readonly string[]).includes(actionType) ? actionType as WebAutomationActionType : undefined;
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
