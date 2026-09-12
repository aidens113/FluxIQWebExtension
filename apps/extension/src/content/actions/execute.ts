// Routes a browser action to the verb that performs it. Action types arrive
// canonical: `domain/src/client/gateway-mapping.ts` is the one place a legacy
// dotted alias is normalized, so only canonical types are matched here.
// Anything else -- `web.browser.navigate`, `web.browser.tab`, and
// `web.browser.download`, which the background worker runs, or a type that
// reached this frame unchecked -- falls through to UNSUPPORTED_TYPE.
// Every verb runs inside one try block timed from one start, and every branch
// is awaited rather than returned, so a rejection from any of them becomes the
// caller's failure result. A returned promise settles after the try block has
// exited and its rejection escapes the catch: `executeContentAction` would
// reject rather than resolve, `message-handler.ts` would post no reply, and
// nothing upstream ends the command, because Core applies no runtime deadline
// to a web action and `timeoutMs` is deliberately kept out of the effect
// payload so a Core timer cannot displace the structured `timed_out` result the
// client reports itself. That is a hung command, not a failed one.
//
// Only the two waits were awaited until 2026-09-11, when three Wave 2 workers
// found the hole independently. It had never fired, which is why it survived
// review: of the branches that were returned, all but three were synchronous
// verbs, whose throw happens during the try block and was always caught, and
// the three asynchronous ones -- assert, extract-list and scroll -- each wrap
// their own body in a catch that routes to `deps.failure`. Those catches are a
// convention nothing enforces, so the guarantee is asserted against this file
// rather than left to them: `tests/execute.test.ts` drives a verb into an
// asynchronous rejection and fails if a branch loses its await.
//
// A caught rejection goes to `deps.failure` -- `action-runtime/results.ts` --
// which classifies it through the domain's closed set. It lands on
// ACTION_FAILED rather than UNKNOWN: the verb ran and threw a reason no code
// names, which is what that member says, and unlike UNKNOWN it is retryable,
// which is right for the detached node or torn-down frame such a rejection
// almost always is.
//
// The fallthrough is the one throw here that is not a verb misbehaving, and it
// reports UNSUPPORTED_TYPE instead. The difference is retryability, and it is
// the whole reason the two are told apart: ACTION_FAILED is retryable, and an
// action type this build has no branch for will answer the same way however
// many times Core sends it, so classifying it as a rejected verb costs a full
// retry cycle before the same refusal. `UnsupportedActionTypeError` therefore
// carries the record rather than leaving it to be inferred from a bare `Error`
// -- the same seam `resolve-target.ts` uses for its own codes, which
// `results.ts` lifts off the thrown value in `reportedFailure`.

import { WEB_AUTOMATION_FAILURE_CODES, webAutomationFailureRecord, type WebAutomationFailureRecord } from "@fluxiq-web-extension/domain/client";
import type { BrowserActionCommand, BrowserActionResult } from "../types";
import type { ContentActionDependencies } from "./types";
import { captureSnapshotAction } from "./capture-snapshot";
import { waitForSelectorAction } from "./wait-for-selector";
import { waitForTextAction } from "./wait-for-text";
import { extractAction } from "./extract";
import { clickAction } from "./click";
import { typeAction } from "./type";
import { clearAction } from "./clear";
import { selectAction } from "./select";
import { scrollAction } from "./scroll";
import { keypressAction } from "./keypress";
import { checkAction } from "./check";
import { assertAction } from "./assert";
import { extractListAction } from "./extract-list";
import { uploadAction } from "./upload";
import { dialogAction } from "./dialog";

/**
 * An action type no branch above routes: the client cannot run it at all,
 * which is UNSUPPORTED_TYPE and not a failed action.
 *
 * It carries the record rather than a message alone because the code is the
 * part that matters and nothing downstream can rediscover it: a plain `Error`
 * classifies as ACTION_FAILED, which is retryable, and no retry can make this
 * build implement a verb it does not have. `results.ts` reads `failure` off a
 * thrown value structurally and trusts it only when the code is one the closed
 * set names, so the record is built by `webAutomationFailureRecord` from that
 * set -- the wire string is never written here.
 */
class UnsupportedActionTypeError extends Error {
  readonly failure: WebAutomationFailureRecord;

  constructor(actionType: string) {
    super(`Unsupported action type: ${actionType}`);
    this.name = "UnsupportedActionTypeError";
    this.failure = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.UNSUPPORTED_TYPE, {
      expected: "an action type this content script implements",
      actual: `${actionType} has no verb in this build`
    });
  }
}

export async function executeContentAction(action: BrowserActionCommand, deps: ContentActionDependencies): Promise<BrowserActionResult> {
  const startedAt = Date.now();
  try {
    if (action.actionType === "web.dom.capture_snapshot") {
      return await captureSnapshotAction(action, deps, startedAt);
    }
    if (action.actionType === "web.dom.wait_for_selector") {
      return await waitForSelectorAction(action, deps, startedAt);
    }
    if (action.actionType === "web.dom.wait_for_text") {
      return await waitForTextAction(action, deps, startedAt);
    }
    if (action.actionType === "web.dom.extract") {
      return await extractAction(action, deps, startedAt);
    }
    if (action.actionType === "web.dom.click") {
      return await clickAction(action, deps, startedAt);
    }
    if (action.actionType === "web.dom.type") {
      return await typeAction(action, deps, startedAt);
    }
    if (action.actionType === "web.dom.clear") {
      return await clearAction(action, deps, startedAt);
    }
    if (action.actionType === "web.dom.select") {
      return await selectAction(action, deps, startedAt);
    }
    if (action.actionType === "web.dom.scroll") {
      return await scrollAction(action, deps, startedAt);
    }
    if (action.actionType === "web.dom.keypress") {
      return await keypressAction(action, deps, startedAt);
    }
    if (action.actionType === "web.dom.check") {
      return await checkAction(action, deps, startedAt);
    }
    if (action.actionType === "web.dom.assert") {
      return await assertAction(action, deps, startedAt);
    }
    if (action.actionType === "web.dom.extract_list") {
      return await extractListAction(action, deps, startedAt);
    }
    if (action.actionType === "web.dom.upload") {
      return await uploadAction(action, deps, startedAt);
    }
    if (action.actionType === "web.dom.dialog") {
      return await dialogAction(action, deps, startedAt);
    }
    throw new UnsupportedActionTypeError(action.actionType);
  } catch (error) {
    return deps.failure(action, error, startedAt);
  }
}
