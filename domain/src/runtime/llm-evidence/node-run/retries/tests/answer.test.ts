// Which attempt answers for a node once its retries are spent (t741 C1,
// `run-mvgo9wzn-fad4e050` step 0116): a refusal for now that caused the later
// attempts' "control gone" failures, otherwise the last attempt.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { webNodeRetriedAnswer, type WebNodeDispatchResult } from "..";
import { WEB_AUTOMATION_FAILURE_CODES, webAutomationFailureRecord, type WebAutomationFailureCode } from "../../../../failure";

function failed(code: WebAutomationFailureCode, actual = "not yet"): WebNodeDispatchResult {
  return { status: "failed", failure: webAutomationFailureRecord(code, { actual, retryAfterMs: 5_000 }) as unknown as JsonObject, error: code } as WebNodeDispatchResult;
}

const C = WEB_AUTOMATION_FAILURE_CODES;

test("a refusal for now followed only by the control gone answers, the latest refusal when there are two", () => {
  for (const gone of [C.TARGET_NOT_SHOWN, C.TARGET_NOT_FOUND, C.TARGET_NOT_ACTIONABLE]) {
    const refused = failed(C.RATE_LIMITED);
    const answers = [refused, failed(gone), failed(gone), failed(gone)];
    assert.equal(webNodeRetriedAnswer(answers, answers[3]!), refused, gone);
  }
  const first = failed(C.RATE_LIMITED);
  const second = failed(C.RATE_LIMITED);
  const answers = [first, second, failed(C.TARGET_NOT_SHOWN)];
  assert.equal(webNodeRetriedAnswer(answers, answers[2]!), second);
});

test("the last attempt answers when it is the refusal, a success, or a failure the refusal did not cause", () => {
  const refusedLast = [failed(C.TARGET_NOT_SHOWN), failed(C.RATE_LIMITED)];
  assert.equal(webNodeRetriedAnswer(refusedLast, refusedLast[1]!), refusedLast[1]);
  const allGone = [failed(C.TARGET_NOT_SHOWN), failed(C.TARGET_NOT_SHOWN)];
  assert.equal(webNodeRetriedAnswer(allGone, allGone[1]!), allGone[1]);
  const otherBetween = [failed(C.RATE_LIMITED), failed(C.NO_EFFECT), failed(C.TARGET_NOT_SHOWN)];
  assert.equal(webNodeRetriedAnswer(otherBetween, otherBetween[2]!), otherBetween[2]);
  const covered = [failed(C.RATE_LIMITED), failed(C.TARGET_NOT_ACTIONABLE, "covered: a layer")];
  assert.equal(webNodeRetriedAnswer(covered, covered[1]!), covered[1]);
  const timedOut = { status: "timed_out", error: "timed out" } as WebNodeDispatchResult;
  const withTimeout = [failed(C.RATE_LIMITED), timedOut];
  assert.equal(webNodeRetriedAnswer(withTimeout, timedOut), timedOut);
  const succeeded = { status: "succeeded", payload: { value: "ok" } } as WebNodeDispatchResult;
  const withSuccess = [failed(C.RATE_LIMITED), succeeded];
  assert.equal(webNodeRetriedAnswer(withSuccess, succeeded), succeeded);
});
