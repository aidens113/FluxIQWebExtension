// The account reaching the result, on both texts that leave the browser.
//
// A defence nobody can see is a defence nobody can trust, and this repository's
// two most expensive weeks were spent on facts computed and discarded (t143,
// t155). So what is asserted here is not that the sentence reads well but that
// it is *there*, on a recovered success and on an exhausted failure alike, and
// that annotating a failure record did not quietly break it.

import assert from "node:assert/strict";
import test from "node:test";
import { parseAutomationStudioFailureRecord } from "fluxiq/automation-studio";
import { WEB_AUTOMATION_FAILURE_CODES, webAutomationFailureRecord } from "@fluxiq-web-extension/domain/client";
import { recoveryAccountSentence, CLEAN_RECOVERY_ACCOUNT } from "../account";
import { recordRecovery } from "../record";
import type { RecoveryAccount } from "../account";
import type { BrowserActionResult } from "../../../types";

const RECOVERED: RecoveryAccount = { attempts: 2, absorbed: ["target_absent"], waitedMs: 250, dismissed: 0, outcome: "recovered" };
const EXHAUSTED: RecoveryAccount = { attempts: 5, absorbed: ["target_absent", "target_absent", "target_absent", "target_absent", "target_absent"], waitedMs: 3_750, dismissed: 0, outcome: "exhausted" };

function result(overrides: Partial<BrowserActionResult> = {}): BrowserActionResult {
  return {
    commandId: "c1",
    actionType: "web.dom.click",
    status: "succeeded",
    validation: { status: "passed", expected: "the click lands on the target", actual: "it landed at 10,20" },
    startedAt: 0,
    finishedAt: 1,
    ...overrides
  } as unknown as BrowserActionResult;
}

test("a clean execution is not annotated, because 'nothing went wrong' on every result buries the ones that matter", () => {
  assert.equal(recoveryAccountSentence(CLEAN_RECOVERY_ACCOUNT), undefined);
  const clean = result();
  assert.equal(recordRecovery(clean, CLEAN_RECOVERY_ACCOUNT), clean);
  assert.equal(clean.validation.status === "passed" ? clean.validation.actual : "", "it landed at 10,20");
});

test("a recovered success says which fault it absorbed, on which attempt, and what the waiting cost", () => {
  const recovered = recordRecovery(result(), RECOVERED);
  const actual = recovered.validation.status === "none" ? "" : recovered.validation.actual;
  assert.match(actual, /it landed at 10,20; the execution recovered on attempt 2 after absorbing target_absent, waiting 250 ms$/u);
});

test("an exhausted failure carries the account on the record Core stores, with the code unchanged", () => {
  const failure = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND, {
    expected: "one element matching the target",
    actual: "nothing matched"
  });
  const exhausted = recordRecovery(result({ status: "failed", validation: { status: "failed", expected: "e", actual: "nothing matched" }, failure }), EXHAUSTED);
  assert.equal(exhausted.failure?.code, WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND);
  assert.match(String(exhausted.failure?.actual), /the execution did not recover within its 5 attempts after absorbing target_absent, target_absent, target_absent, target_absent, target_absent, waiting 3750 ms$/u);
  // Core drops a record whole rather than repairing it, so the annotated record
  // has to still parse -- otherwise the annotation loses the failure.
  const parsed = parseAutomationStudioFailureRecord(exhausted.failure);
  assert.notEqual(parsed, null, "the annotated record no longer parses, so the annotation would lose the failure");
  assert.equal(parsed?.code, WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND);
});

test("a verb that spent its own timeout is one attempt, in the singular", () => {
  // The ordinary case for a wait: the verb used the command's `timeoutMs`, so
  // `budget.ts` refused the retry and the fault is recorded with no second try.
  const spent: RecoveryAccount = { attempts: 1, absorbed: ["timeout"], waitedMs: 0, dismissed: 0, outcome: "exhausted" };
  assert.equal(recoveryAccountSentence(spent), "the execution did not recover within its 1 attempt after absorbing timeout, waiting 0 ms");
});

test("a record with no `actual` of its own gains the account rather than a stray separator", () => {
  const failure = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND);
  const annotated = recordRecovery(result({ status: "failed", validation: { status: "none", reason: "not-yet-validated" }, failure }), RECOVERED);
  assert.equal(annotated.failure?.actual, "the execution recovered on attempt 2 after absorbing target_absent, waiting 250 ms");
});

test("a validation already at its bound loses its own tail rather than the whole annotation", () => {
  const long = "x".repeat(1_100);
  const annotated = recordRecovery(result({ validation: { status: "passed", expected: "e", actual: long } }), RECOVERED);
  const actual = annotated.validation.status === "none" ? "" : annotated.validation.actual;
  assert.equal(actual.length, 1_024);
  assert.ok(actual.endsWith("…"));
});

test("a record whose code is outside the closed set is left exactly as it was", () => {
  const failure = { category: "action_failed", code: "web.action.made_up", retryable: true, stage: "execution" };
  const left = recordRecovery(result({ status: "failed", validation: { status: "none", reason: "not-yet-validated" }, failure } as Partial<BrowserActionResult>), RECOVERED);
  assert.equal(left.failure?.actual, undefined);
  assert.equal(left.failure?.code, "web.action.made_up");
});
