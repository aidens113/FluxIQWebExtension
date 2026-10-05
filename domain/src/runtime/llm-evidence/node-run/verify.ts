// Checking a step whose effect lasts, without taking it.
//
// A dry run never clears site data or logs the person out, never repeats a
// lasting effect, and checks a changing step rather than running it again
// (decision D1, 2026-09-30). Core decides which steps those are -- a step that
// changes something and declares any consequence but none
// (`AS/runtime/flow-draft/verify-only.ts`) -- and sends them
// `replay: "verify"` instead of `replay: "step"`, with where the step found the
// page. Live run `run-muntufao-7b7bc04a` is why: two dry-run replays of one
// save-for-later press moved both of a person's cart lines to the saved list.
//
// **What is checked.** Exactly what a replay would need before it pressed:
//
//   1. the step names a node this domain can run, with parameters;
//   2. those parameters resolve, by the same resolution a replay uses, so the
//      target is the one the Flow would act on;
//   3. the target is on the page and visible, then enabled -- each asked of
//      the page through `web.dom.assert`, which reads and never acts. The
//      `visible` check answers three ways: nothing matched (the target is not
//      there), it matched and is shown, or it matched and is not shown -- and
//      then the page says what hid it (`./hidden-target.ts`).
//
// Nothing that acts is dispatched, so the person's permission for the step's
// declared classes is not asked again: the gate is asked for a check with no
// consequence, because every call a replay makes goes through it. The act
// itself stays gated where it always was.
//
// **What each answer means.**
//
//   verified        -- the step could run now. Its effect was withheld.
//   present         -- the target is not on the page, or it is there and
//                      withdrawn itself while everything around it is shown,
//                      and the page is the one the step acted on (its recorded
//                      location, compared whole: `./missing-target.ts`, the
//                      same test a replayed step answers `remembered` by). That
//                      is what an effect already in place looks like: the line
//                      was saved while exploring and its save control is gone;
//                      the store was chosen and its card now says "Your store"
//                      (t193-wH, `run-munri5gr-94d7f8a0`); a "Follow" is hidden
//                      beside the "Following" that replaced it. It passes.
//   unreproducible  -- the same two, and the page is not the one the step
//                      acted on, or where it is could not be read. The steps
//                      before it no longer reach it (run 18,
//                      `run-munpwa5r-e7aefe04`: an add-to-cart replayed on the
//                      search results because the steps that reach the product
//                      page were withdrawn). It blocks.
//   failed          -- the target is there inside a closed container, or there
//                      and disabled, or hidden by something the page did not
//                      name; or the page would not answer the check, or the
//                      step does not resolve. The Flow would not run it either.
//
// A target inside a closed container is never `present`, wherever the page
// stands: a flyout, menu or panel no step before it opens is a step the Flow
// cannot take on a fresh site. Lane A's run 40 (`run-muq6lqnw-fdfa7aac`) is why:
// bigbox's "Set as my store" sits in the store chooser's flyout, the Flow never
// pressed the chip that opens it, the check read the button as not there and
// the page as the step's own, the dry run passed, and playback failed at the
// button. The answer is `failed` with `found: "hidden"`, which Core already
// reads as a step that failed its check (`AS/runtime/flow-draft/verify-only.ts`);
// no new code was needed.
//
// What this still cannot see is a control *replaced* inside a closed
// container: with the store already chosen, the chosen store's card holds
// "Your store" and no button, closed flyout or not, so the target reads as not
// there. Nothing the step recorded says what its effect looked like, so the
// page's place for it is not checked.
//
// The same page by location is not proof either: two states can share a path.
// It is the evidence this domain has without acting, it separates run 18's
// case from run 21's, and it is asked only of steps the dry run must not repeat
// anyway.
//
// Visible and enabled is not the whole of "actionable": a control covered by
// a layer passes both. A replay would have found that by pressing, and this
// does not press; playback still does.

import type { JsonObject, JsonValue } from "fluxiq/core";
import { webAutomationScopedToRow } from "../../../output-nodes";
import { WEB_AUTOMATION_FAILURE_CODES } from "../../failure";
import { webActionFailureRefusal, webActionNeedsPerson } from "../action-failure";
import { assertActive, toolMetadata, withPersonNeeded, type WebLlmEvidenceToolExecution } from "../capture";
import { webActionPermission } from "../permission";
import { present } from "../present";
import { resolveWebPlanNode } from "../plan-resolution";
import { webLlmHandleRejectionReason } from "../tool-rejection";
import { isJsonRecord } from "../untrusted-json";
import { webRunnableNode } from "./catalog";
import { webNodeHiddenTarget } from "./hidden-target";
import { webNodeReplayMissingTarget } from "./missing-target";
import {
  WEB_NODE_REPLAY_RESULT_CODES,
  webNodeReplayAnswer,
  webNodeReplayAnswerWithPage,
  webNodeReplayPermissionReason,
  type WebNodeReplayFacts
} from "./replay-answer";
import type { WebNodeRun } from "./context";

/** The read-only command every check goes out as. */
const CHECK_ACTION = "web.dom.assert";

/** The parameters that name an element, as the action schemas spell them (`actions/schemas.ts`). */
const TARGET_KEYS = ["selector", "element", "visualTarget"] as const;

/**
 * How long each check waits. The first gives a page just put back time to
 * settle, the same window an authored assertion gets; the second is asked of
 * an element already found, so it only waits out a control that enables late.
 */
const CHECKS = [
  { kind: "visible", timeoutMs: 5_000, fails: "hidden" },
  { kind: "enabled", timeoutMs: 1_000, fails: "disabled" }
] as const;

/** Check one step could run now, or that its effect is already in place, and run nothing that acts. */
export async function verifyWebOutputNode(run: WebNodeRun): Promise<WebLlmEvidenceToolExecution> {
  const value = run.request.value;
  const node = webRunnableNode(value.node);
  // A loop's body step is checked on the pass's row, as `./replay.ts` runs one.
  const parameters = isJsonRecord(value.parameters) ? webAutomationScopedToRow(value.parameters, value.item) : undefined;
  if (!node) return webNodeReplayAnswer(WEB_NODE_REPLAY_RESULT_CODES.failed, "the step names nothing this domain can run", false, { resultReason: "node_not_runnable_here", nodeId: undefined, assumed: undefined });
  if (!parameters) return webNodeReplayAnswer(WEB_NODE_REPLAY_RESULT_CODES.failed, "the step carries no parameters to check", false, { resultReason: undefined, nodeId: node.definitionId, assumed: undefined });
  const permission = await webActionPermission({ check: run.request.permission, declared: [], control: { name: undefined, kind: "step" }, verb: "check", effect: "observe" });
  if (permission.kind === "refused" || permission.kind === "invalid") {
    return webNodeReplayAnswer(WEB_NODE_REPLAY_RESULT_CODES.failed, "the check was not permitted", false, { resultReason: webNodeReplayPermissionReason(permission), nodeId: node.definitionId, assumed: undefined });
  }
  // `gatedByCaller`: resolving is not acting, and the gate was asked above.
  const { resolution: resolved, assumed } = await resolveWebPlanNode(
    { projectId: run.request.projectId, flowId: run.request.flowId, nodeDefinitionId: node.definitionId, parameters, gatedByCaller: true },
    run.stores
  );
  if (resolved.status === "refused") {
    return await webNodeReplayAnswerWithPage(run, WEB_NODE_REPLAY_RESULT_CODES.failed, "the step's parameters could not be resolved", false, {
      resultReason: webLlmHandleRejectionReason(resolved.issueCodes),
      nodeId: node.definitionId,
      assumed
    });
  }
  const target = targetOf(resolved.status === "resolved" ? resolved.parameters : parameters);
  const facts = (resultReason: WebNodeReplayFacts["resultReason"]): WebNodeReplayFacts => ({ resultReason, nodeId: node.definitionId, assumed });
  // What a passing check states the step runs with: only for an argument
  // written in handles, which resolution rewrote. A dry run checks the form the
  // draft already resolved, which resolves unchanged and states nothing.
  const ranWith = resolved.status === "resolved" ? resolvedCall(value, resolved.parameters) : undefined;
  // A step that names no element -- a navigation, a key, a tab -- has nothing
  // on the page to check. That its parameters resolve is all a check can say.
  if (!target) return passed(WEB_NODE_REPLAY_RESULT_CODES.verified, "the step names no element; its parameters resolve, and it was not run", facts(undefined), ranWith);
  for (const check of CHECKS) {
    const result = await run.gateway.executeAction(run.sessionId, {
      actionType: CHECK_ACTION,
      parameters: { ...target, assert: { kind: check.kind, timeoutMs: check.timeoutMs } },
      metadata: toolMetadata(run.request)
    });
    assertActive(run.request.signal);
    if (result.status === "succeeded") continue;
    const code = result.failure?.code;
    if (webActionNeedsPerson(result)) {
      const answered = await webNodeReplayAnswerWithPage(run, WEB_NODE_REPLAY_RESULT_CODES.failed, "the step's target could not be checked: the page needs a person", false, facts(undefined));
      return withPersonNeeded(answered, undefined);
    }
    // Nothing matched within the window: a wait in vain, which is how the
    // assertion reports a subject that never appeared.
    if (result.status === "timed_out" || code === WEB_AUTOMATION_FAILURE_CODES.TIMEOUT || code === WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND) {
      return acceptedPresent(await webNodeReplayMissingTarget(run, "verify", facts("handle_no_longer_on_page")), ranWith);
    }
    // The target was found and judged: it is there and not as a press needs it.
    if (code === WEB_AUTOMATION_FAILURE_CODES.STATE_MISMATCH) {
      const hidden = check.kind === "visible" ? webNodeHiddenTarget(result) : undefined;
      // Withdrawn itself, with everything around it shown: read as a target
      // that is gone, by the same page test.
      if (hidden === "itself") return acceptedPresent(await webNodeReplayMissingTarget(run, "verify", facts("state_not_as_asserted"), undefined, "withdrawn"), ranWith);
      const said = hidden === "enclosed"
        ? "the step's target is on the page inside a closed container that no step before it opens; it was not run"
        : `the step's target is on the page and ${check.fails}; it was not run`;
      return await webNodeReplayAnswerWithPage(run, WEB_NODE_REPLAY_RESULT_CODES.failed, said, false, facts("state_not_as_asserted"), check.fails);
    }
    const refused = webActionFailureRefusal(result);
    return await webNodeReplayAnswerWithPage(run, WEB_NODE_REPLAY_RESULT_CODES.failed, `the step's target could not be checked (${refused.code})`, false, facts(refused.detail?.reason));
  }
  return passed(WEB_NODE_REPLAY_RESULT_CODES.verified, "the step's target is on the page, visible and enabled; it was not run", facts(undefined), ranWith);
}

/**
 * A step that passed its check: `ok`, and nothing done to the page. With
 * `ranWith`, the answer states the resolved form of an argument written in
 * handles, under `draft.ranWith` as a run states it (`./run.ts`): Core checks a
 * rerun of a step whose act was already done rather than doing the act again,
 * and the step then takes the rerun's argument (`AS/runtime/llm/node-tools/
 * rerun-check.ts`, run `run-murwcaj0-40e56557` R7). A handle names nothing on
 * the next page, so without this the step would keep no form the Flow can run.
 */
function passed(code: string, said: string, about: WebNodeReplayFacts, ranWith?: JsonObject): WebLlmEvidenceToolExecution {
  const answered = webNodeReplayAnswer(code, said, true, about, false);
  return ranWith ? { ...answered, draft: { ranWith } } : answered;
}

/** An accepted missing target still needs the current resolved declaration; an unreproducible check supplies none. */
function acceptedPresent(answered: WebLlmEvidenceToolExecution, ranWith: JsonObject | undefined): WebLlmEvidenceToolExecution {
  return answered.resultCode === WEB_NODE_REPLAY_RESULT_CODES.present && ranWith
    ? { ...answered, draft: { ranWith } }
    : answered;
}

/** One library call as the Flow keeps it: the node, its resolved parameters and its declaration when it carried one (as `./run.ts` writes it). */
function resolvedCall(value: JsonObject, parameters: JsonObject): JsonObject {
  return present<{ node: JsonValue; parameters: JsonObject; consequences?: JsonValue }>({
    node: value.node ?? null,
    parameters,
    consequences: value.consequences === null ? undefined : value.consequences
  }) as unknown as JsonObject;
}

/** The keys of the step's resolved parameters that name its element, or nothing when it names none. */
function targetOf(parameters: JsonObject): JsonObject | undefined {
  const target: JsonObject = {};
  for (const key of TARGET_KEYS) if (parameters[key] !== undefined) target[key] = parameters[key]!;
  return Object.keys(target).length ? target : undefined;
}
